import type { RPCCommand, RPCCommandWithoutId, RPCEvent, RPCResponse } from "./rpc-types.js";
import type { WebSocketClient, WebSocketEvent, WebSocketListener } from "./WebSocketClient.js";

/**
 * Default timeout for pending requests (30 seconds)
 */
const DEFAULT_REQUEST_TIMEOUT = 30000;

/**
 * Error thrown when a request times out
 */
export class RequestTimeoutError extends Error {
	constructor(id: string) {
		super(`Request ${id} timed out after ${DEFAULT_REQUEST_TIMEOUT}ms`);
		this.name = "RequestTimeoutError";
	}
}

/**
 * Error thrown when a request fails
 */
export class RequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RequestError";
	}
}

/**
 * Pending request state
 */
export interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
}

/**
 * RPC client that handles request/response correlation on top of WebSocket.
 *
 * Features:
 * - Assigns unique IDs to commands for request/response matching
 * - Returns Promises that resolve with responses
 * - Emits streaming events separately
 * - Handles request timeouts
 * - Parses JSONL (one JSON object per line)
 */
export class RPCClient {
	private ws: WebSocketClient;
	private pending = new Map<string, PendingRequest>();
	private eventListeners = new Set<(event: RPCEvent) => void>();
	private messageListener: WebSocketListener | null = null;

	constructor(ws: WebSocketClient) {
		this.ws = ws;
		this.messageListener = this.handleMessage.bind(this);
		this.ws.subscribe(this.messageListener);
	}

	/**
	 * Send a command and wait for the response
	 * @param command The command to send (without an ID)
	 * @returns Promise that resolves with the response data
	 */
	async sendCommand<T>(command: RPCCommandWithoutId): Promise<T> {
		const id = crypto.randomUUID();
		const fullCommand = { ...command, id } as RPCCommand;

		return new Promise<T>((resolve, reject) => {
			// Set up timeout
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				reject(new RequestTimeoutError(id));
			}, DEFAULT_REQUEST_TIMEOUT);

			// Store pending request
			this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });

			// Send the command
			try {
				this.ws.send(JSON.stringify(fullCommand));
			} catch (error) {
				this.pending.delete(id);
				clearTimeout(timeout);
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	/**
	 * Subscribe to streaming events
	 * @param listener Callback for events (non-response messages)
	 * @returns Unsubscribe function
	 */
	subscribe(listener: (event: RPCEvent) => void): () => void {
		this.eventListeners.add(listener);

		return () => {
			this.eventListeners.delete(listener);
		};
	}

	/**
	 * Clean up resources and close connection
	 */
	disconnect(): void {
		if (this.messageListener !== null) {
			// Note: WebSocketClient doesn't expose unsubscribe, we just stop processing
			this.messageListener = null;
		}

		// Reject all pending requests
		for (const [, { reject, timeout }] of this.pending.entries()) {
			clearTimeout(timeout);
			reject(new RequestError("Connection closed"));
		}
		this.pending.clear();

		this.ws.disconnect();
	}

	/**
	 * Handle incoming WebSocket messages
	 */
	private handleMessage(event: WebSocketEvent): void {
		if (event.type !== "message") {
			return;
		}

		// Parse JSONL - one JSON object per line
		const lines = event.data.split("\n").filter((line) => line.trim() !== "");

		for (const line of lines) {
			try {
				const parsed = JSON.parse(line);

				// Check if this is a response with an ID
				if (this.isResponse(parsed) && parsed.id !== undefined) {
					this.handleResponse(parsed);
				} else if (this.isEvent(parsed)) {
					// Emit as streaming event
					this.emitEvent(parsed);
				}
			} catch (error) {
				// Ignore malformed JSON
				console.error("Failed to parse message:", line, error);
			}
		}
	}

	/**
	 * Check if a parsed message is an RPC response
	 */
	private isResponse(parsed: unknown): parsed is RPCResponse {
		if (typeof parsed !== "object" || parsed === null) {
			return false;
		}

		return "type" in parsed && parsed.type === "response";
	}

	/**
	 * Check if a parsed message is an RPC event
	 */
	private isEvent(parsed: unknown): parsed is RPCEvent {
		if (typeof parsed !== "object" || parsed === null) {
			return false;
		}

		// Events have a type but are not "response" type
		return "type" in parsed && parsed.type !== "response";
	}

	/**
	 * Handle a response message
	 */
	private handleResponse(response: RPCResponse): void {
		const { id } = response;

		if (id === undefined) {
			return;
		}

		const pending = this.pending.get(id);
		if (pending === undefined) {
			// No matching pending request, ignore
			return;
		}

		// Clear timeout
		clearTimeout(pending.timeout);
		this.pending.delete(id);

		// Resolve or reject based on success
		if (response.success) {
			// Extract data if present, otherwise return the response
			const data = "data" in response ? response.data : response;
			pending.resolve(data);
		} else {
			pending.reject(new RequestError(response.error));
		}
	}

	/**
	 * Emit an event to all listeners
	 */
	private emitEvent(event: RPCEvent): void {
		for (const listener of this.eventListeners) {
			try {
				listener(event);
			} catch (error) {
				console.error("Error in event listener:", error);
			}
		}
	}
}
