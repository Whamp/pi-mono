import type { RPCToolContentBlock } from "../networking/rpc-types.js";
import type { QueuedMessage } from "./offline-queue.js";

/**
 * Sync event types emitted during the sync process.
 */
export type SyncEvent =
	| { type: "sync_start"; count: number }
	| { type: "sync_progress"; sent: number; total: number }
	| { type: "sync_complete"; sent: number; failed: number }
	| { type: "sync_error"; messageId: string; error: string };

/**
 * Maximum number of retry attempts for failed messages.
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Delay between retry attempts (in milliseconds).
 */
const RETRY_DELAY_MS = 1000;

/**
 * SyncManager processes the offline queue when the device comes back online.
 *
 * It automatically triggers a sync operation when the browser detects
 * an online event, processing all pending messages in queue order.
 */
export class SyncManager {
	private listeners: Set<(event: SyncEvent) => void> = new Set();
	private isSyncing = false;

	/**
	 * Create a new SyncManager.
	 *
	 * @param queue - The offline queue to read from and update
	 * @param sendFn - Function to send message content to the server
	 */
	constructor(
		private queue: {
			getByStatus: (status: QueuedMessage["status"]) => Promise<QueuedMessage[]>;
			updateStatus: (id: string, status: QueuedMessage["status"]) => Promise<void>;
			remove: (id: string) => Promise<void>;
		},
		private sendFn: (content: string | RPCToolContentBlock[]) => Promise<void>,
	) {
		// Listen for online events to trigger auto-sync
		window.addEventListener("online", () => {
			void this.sync();
		});
	}

	/**
	 * Start the sync process for all pending messages.
	 *
	 * This method is automatically called when the browser detects
	 * an online event, but can also be called manually.
	 *
	 * @returns Promise that resolves when sync completes
	 */
	async sync(): Promise<void> {
		// Prevent concurrent syncs
		if (this.isSyncing) {
			return;
		}

		// Only sync if online
		if (!navigator.onLine) {
			return;
		}

		this.isSyncing = true;

		try {
			// Get all pending messages (already sorted by timestamp)
			const messages = await this.queue.getByStatus("pending");

			if (messages.length === 0) {
				this.isSyncing = false;
				return;
			}

			this.emit({ type: "sync_start", count: messages.length });

			let sent = 0;
			let failed = 0;

			for (const msg of messages) {
				// Skip messages that exceed retry limit
				if (msg.retryCount >= MAX_RETRY_ATTEMPTS) {
					await this.queue.updateStatus(msg.id, "failed");
					failed++;
					this.emit({
						type: "sync_error",
						messageId: msg.id,
						error: `Max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded`,
					});
					continue;
				}

				// Mark as sending
				await this.queue.updateStatus(msg.id, "sending");

				try {
					// Attempt to send the message
					await this.sendFn(msg.content);

					// Success - remove from queue
					await this.queue.remove(msg.id);
					sent++;

					// Emit progress event
					this.emit({
						type: "sync_progress",
						sent,
						total: messages.length,
					});
				} catch (e) {
					// Failed - update status and emit error
					const error = String(e);
					await this.queue.updateStatus(msg.id, "failed");
					failed++;

					this.emit({
						type: "sync_error",
						messageId: msg.id,
						error,
					});

					// If message has retries left, requeue it with delay
					if (msg.retryCount < MAX_RETRY_ATTEMPTS) {
						setTimeout(
							() => {
								void this.retryMessage(msg);
							},
							RETRY_DELAY_MS * (msg.retryCount + 1),
						);
					}
				}
			}

			// Emit completion event
			this.emit({
				type: "sync_complete",
				sent,
				failed,
			});
		} finally {
			this.isSyncing = false;
		}
	}

	/**
	 * Retry a single failed message.
	 *
	 * @param msg - The message to retry
	 */
	private async retryMessage(msg: QueuedMessage): Promise<void> {
		// Check if message still exists and is failed
		const failedMessages = await this.queue.getByStatus("failed");
		const messageToRetry = failedMessages.find((m) => m.id === msg.id);

		if (!messageToRetry) {
			return;
		}

		// Mark as pending to retry
		await this.queue.updateStatus(msg.id, "pending");

		// Trigger sync to process requeued message
		if (navigator.onLine && !this.isSyncing) {
			await this.sync();
		}
	}

	/**
	 * Subscribe to sync events.
	 *
	 * @param listener - Callback function for sync events
	 * @returns Unsubscribe function
	 */
	subscribe(listener: (event: SyncEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Emit an event to all listeners.
	 *
	 * @param event - The event to emit
	 */
	private emit(event: SyncEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (e) {
				// Log but don't throw - one bad listener shouldn't break others
				console.error("Error in sync event listener:", e);
			}
		}
	}

	/**
	 * Check if a sync is currently in progress.
	 */
	get syncing(): boolean {
		return this.isSyncing;
	}
}
