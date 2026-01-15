import type { RPCToolContentBlock } from "../networking/rpc-types.js";

/**
 * A queued message for offline storage.
 */
export interface QueuedMessage {
	/** Unique identifier (UUID) */
	id: string;
	/** Message content (text or content blocks) */
	content: string | RPCToolContentBlock[];
	/** ISO 8601 timestamp */
	timestamp: string;
	/** Current status */
	status: "pending" | "sending" | "failed";
	/** Number of retry attempts */
	retryCount: number;
}

/**
 * Offline message queue for storing messages when the user is offline.
 * Messages are persisted in IndexedDB and sent when back online.
 */
export class OfflineQueue {
	private static readonly DB_NAME = "pi-web-ui-offline-queue";
	private static readonly DB_VERSION = 1;
	private static readonly STORE_NAME = "messages";

	private db: IDBDatabase | null = null;
	private listeners: Set<(messages: QueuedMessage[]) => void> = new Set();
	private initPromise: Promise<void> | null = null;

	/**
	 * Initialize the IndexedDB database.
	 */
	async init(): Promise<void> {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(OfflineQueue.DB_NAME, OfflineQueue.DB_VERSION);

			request.onerror = () => {
				reject(new Error(`Failed to open offline queue database: ${request.error}`));
			};

			request.onsuccess = () => {
				this.db = request.result;
				this.setupEventListeners();
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create messages store with status index
				if (!db.objectStoreNames.contains(OfflineQueue.STORE_NAME)) {
					const store = db.createObjectStore(OfflineQueue.STORE_NAME, { keyPath: "id" });
					store.createIndex("status", "status", { unique: false });
					store.createIndex("timestamp", "timestamp", { unique: false });
				}
			};
		});

		return this.initPromise;
	}

	/**
	 * Set up online/offline event listeners.
	 */
	private setupEventListeners(): void {
		window.addEventListener("online", () => {
			this.notifyListeners();
		});

		window.addEventListener("offline", () => {
			this.notifyListeners();
		});
	}

	/**
	 * Notify all listeners of queue changes.
	 */
	private async notifyListeners(): Promise<void> {
		const messages = await this.getAll();
		for (const listener of this.listeners) {
			listener(messages);
		}
	}

	/**
	 * Add a message to the queue.
	 * @param content - Message content (text or content blocks)
	 * @returns The ID of the queued message
	 */
	async add(content: string | RPCToolContentBlock[]): Promise<string> {
		await this.init();

		const id = crypto.randomUUID();
		const message: QueuedMessage = {
			id,
			content,
			timestamp: new Date().toISOString(),
			status: "pending",
			retryCount: 0,
		};

		await this.put(message);

		// Only notify if offline (messages only matter when offline)
		if (!this.isOnline) {
			await this.notifyListeners();
		}

		return id;
	}

	/**
	 * Get all messages from the queue.
	 * @returns Array of all queued messages
	 */
	async getAll(): Promise<QueuedMessage[]> {
		await this.init();

		if (!this.db) {
			return [];
		}

		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(OfflineQueue.STORE_NAME, "readonly");
			const store = tx.objectStore(OfflineQueue.STORE_NAME);
			const request = store.getAll();

			request.onsuccess = () => {
				const messages = request.result as QueuedMessage[];
				// Sort by timestamp (oldest first)
				messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
				resolve(messages);
			};

			request.onerror = () => {
				reject(new Error(`Failed to get queued messages: ${request.error}`));
			};
		});
	}

	/**
	 * Get messages with a specific status.
	 * @param status - Status to filter by
	 * @returns Array of messages with the given status
	 */
	async getByStatus(status: QueuedMessage["status"]): Promise<QueuedMessage[]> {
		await this.init();

		if (!this.db) {
			return [];
		}

		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(OfflineQueue.STORE_NAME, "readonly");
			const store = tx.objectStore(OfflineQueue.STORE_NAME);
			const index = store.index("status");
			const request = index.getAll(status);

			request.onsuccess = () => {
				const messages = request.result as QueuedMessage[];
				// Sort by timestamp (oldest first)
				messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
				resolve(messages);
			};

			request.onerror = () => {
				reject(new Error(`Failed to get queued messages by status: ${request.error}`));
			};
		});
	}

	/**
	 * Update the status of a queued message.
	 * @param id - Message ID
	 * @param status - New status
	 */
	async updateStatus(id: string, status: QueuedMessage["status"]): Promise<void> {
		await this.init();

		const message = await this.getById(id);
		if (!message) {
			throw new Error(`Message ${id} not found`);
		}

		message.status = status;

		if (status === "sending") {
			message.retryCount++;
		}

		await this.put(message);
		await this.notifyListeners();
	}

	/**
	 * Remove a message from the queue.
	 * @param id - Message ID to remove
	 */
	async remove(id: string): Promise<void> {
		await this.init();

		if (!this.db) {
			return;
		}

		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(OfflineQueue.STORE_NAME, "readwrite");
			const store = tx.objectStore(OfflineQueue.STORE_NAME);
			const request = store.delete(id);

			request.onsuccess = () => {
				this.notifyListeners().catch(() => {});
				resolve();
			};

			request.onerror = () => {
				reject(new Error(`Failed to remove message: ${request.error}`));
			};
		});
	}

	/**
	 * Clear all messages from the queue.
	 */
	async clear(): Promise<void> {
		await this.init();

		if (!this.db) {
			return;
		}

		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(OfflineQueue.STORE_NAME, "readwrite");
			const store = tx.objectStore(OfflineQueue.STORE_NAME);
			const request = store.clear();

			request.onsuccess = () => {
				this.notifyListeners().catch(() => {});
				resolve();
			};

			request.onerror = () => {
				reject(new Error(`Failed to clear queue: ${request.error}`));
			};
		});
	}

	/**
	 * Get a single message by ID.
	 * @param id - Message ID
	 * @returns The message or null if not found
	 */
	private async getById(id: string): Promise<QueuedMessage | null> {
		if (!this.db) {
			return null;
		}

		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(OfflineQueue.STORE_NAME, "readonly");
			const store = tx.objectStore(OfflineQueue.STORE_NAME);
			const request = store.get(id);

			request.onsuccess = () => {
				resolve((request.result as QueuedMessage | null) ?? null);
			};

			request.onerror = () => {
				reject(new Error(`Failed to get message: ${request.error}`));
			};
		});
	}

	/**
	 * Put a message into the store.
	 * @param message - Message to store
	 */
	private async put(message: QueuedMessage): Promise<void> {
		if (!this.db) {
			return;
		}

		return new Promise((resolve, reject) => {
			const tx = this.db!.transaction(OfflineQueue.STORE_NAME, "readwrite");
			const store = tx.objectStore(OfflineQueue.STORE_NAME);
			const request = store.put(message);

			request.onsuccess = () => {
				resolve();
			};

			request.onerror = () => {
				reject(new Error(`Failed to put message: ${request.error}`));
			};
		});
	}

	/**
	 * Subscribe to queue changes.
	 * @param listener - Callback function called when queue changes
	 * @returns Unsubscribe function
	 */
	subscribe(listener: (messages: QueuedMessage[]) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Check if currently online.
	 */
	get isOnline(): boolean {
		return navigator.onLine;
	}
}

/**
 * Singleton instance of the offline queue.
 */
export const offlineQueue = new OfflineQueue();
