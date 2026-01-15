import type { ConnectionState, ReconnectionConfig } from "./connection-types.js";

const DEFAULT_RECONNECTION: ReconnectionConfig = {
	maxRetries: 5,
	initialDelayMs: 1000,
	maxDelayMs: 30000,
	backoffMultiplier: 2,
};

/**
 * WebSocket event types emitted by WebSocketClient
 */
export type WebSocketEvent =
	| { type: "open" }
	| { type: "close"; code: number; reason: string }
	| { type: "error"; error: Event }
	| { type: "message"; data: string }
	| { type: "reconnecting"; attempt: number; delay: number }
	| { type: "reconnected" }
	| { type: "failed"; reason: string };

/**
 * Event listener type for WebSocket events
 */
export type WebSocketListener = (event: WebSocketEvent) => void;

/**
 * Minimal WebSocket wrapper class for RPC communication.
 * Handles connection lifecycle and event emission with automatic reconnection.
 */
export class WebSocketClient {
	private ws: WebSocket | null = null;
	private listeners = new Set<WebSocketListener>();
	private _state: ConnectionState = "disconnected";
	private reconnectionConfig: ReconnectionConfig | null = null;
	private enableReconnection = true;
	private attemptCount = 0;
	private reconnectionTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly url: string,
		config?: {
			reconnection?: ReconnectionConfig;
			enableReconnection?: boolean;
		},
	) {
		if (config) {
			this.reconnectionConfig = config.reconnection ?? DEFAULT_RECONNECTION;
			this.enableReconnection = config.enableReconnection ?? true;
		}
	}

	/**
	 * Current connection state
	 */
	get state(): ConnectionState {
		return this._state;
	}

	/**
	 * Open WebSocket connection
	 */
	connect(): void {
		if (this._state !== "disconnected") {
			return;
		}

		this._state = "connecting";
		this.ws = new WebSocket(this.url);

		this.ws.addEventListener("open", this.handleOpen);
		this.ws.addEventListener("message", this.handleMessage);
		this.ws.addEventListener("error", this.handleError);
		this.ws.addEventListener("close", this.handleClose);
	}

	/**
	 * Close WebSocket connection
	 */
	disconnect(): void {
		// Clear any pending reconnection timer
		if (this.reconnectionTimer !== null) {
			clearTimeout(this.reconnectionTimer);
			this.reconnectionTimer = null;
		}

		// Reset reconnection state
		this.attemptCount = 0;

		if (this.ws === null) {
			return;
		}

		// Remove listeners before closing
		this.ws.removeEventListener("open", this.handleOpen);
		this.ws.removeEventListener("message", this.handleMessage);
		this.ws.removeEventListener("error", this.handleError);
		this.ws.removeEventListener("close", this.handleClose);

		this.ws.close();
		this.ws = null;
		this._state = "disconnected";
	}

	/**
	 * Send message through WebSocket
	 * @throws {Error} If WebSocket is not connected
	 */
	send(data: string): void {
		if (this.ws === null || this._state !== "connected") {
			throw new Error("WebSocket is not connected");
		}

		this.ws.send(data);
	}

	/**
	 * Subscribe to WebSocket events
	 * @param listener Callback function for events
	 * @returns Unsubscribe function
	 */
	subscribe(listener: WebSocketListener): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	private emit(event: WebSocketEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	private readonly handleOpen = (): void => {
		// If reconnecting, emit reconnected event
		if (this._state === "reconnecting") {
			this.emit({ type: "reconnected" });
		}

		this._state = "connected";
		this.attemptCount = 0;
		this.emit({ type: "open" });
	};

	private readonly handleMessage = (event: MessageEvent): void => {
		this.emit({ type: "message", data: event.data });
	};

	private readonly handleError = (event: Event): void => {
		this.emit({ type: "error", error: event });
		this.attemptReconnection();
	};

	private readonly handleClose = (event: CloseEvent): void => {
		this._state = "disconnected";
		this.emit({ type: "close", code: event.code, reason: event.reason });
		this.attemptReconnection();
	};

	/**
	 * Calculate exponential backoff delay for reconnection attempt
	 */
	private calculateBackoffDelay(): number {
		if (this.reconnectionConfig === null) {
			return DEFAULT_RECONNECTION.initialDelayMs;
		}

		const delay =
			this.reconnectionConfig.initialDelayMs * this.reconnectionConfig.backoffMultiplier ** this.attemptCount;
		return Math.min(delay, this.reconnectionConfig.maxDelayMs);
	}

	/**
	 * Attempt to reconnect using exponential backoff
	 */
	private attemptReconnection(): void {
		// Clear any existing timer
		if (this.reconnectionTimer !== null) {
			clearTimeout(this.reconnectionTimer);
			this.reconnectionTimer = null;
		}

		// Check if reconnection is enabled
		if (!this.enableReconnection) {
			return;
		}

		// Get config
		const config = this.reconnectionConfig ?? DEFAULT_RECONNECTION;

		// Check if max retries reached
		if (this.attemptCount >= config.maxRetries) {
			this.emit({
				type: "failed",
				reason: `Max reconnection attempts (${config.maxRetries}) reached`,
			});
			this.attemptCount = 0;
			return;
		}

		// Calculate delay for this attempt
		const delay = this.calculateBackoffDelay();
		this.attemptCount++;

		// Set state to reconnecting
		this._state = "reconnecting";

		// Emit reconnecting event
		this.emit({ type: "reconnecting", attempt: this.attemptCount, delay });

		// Schedule reconnection
		this.reconnectionTimer = setTimeout(() => {
			this.reconnectionTimer = null;
			this.connect();
		}, delay);
	}
}
