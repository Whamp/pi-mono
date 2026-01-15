/**
 * Adapter for interacting with remote sessions via RPC.
 *
 * This adapter provides the same interface pattern as the browser Agent class,
 * but delegates to a remote session via RPCClient. It subscribes to RPC events
 * through the RPCEventMapper and updates local state accordingly.
 *
 * @module
 */

import type { AgentMessage, ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import type { RPCClient } from "../networking/RPCClient.js";
import type { RPCEventMapper, SessionEvent } from "../networking/RPCEventMapper.js";

/**
 * Adapter for remote session interaction.
 *
 * Provides an Agent-like interface for controlling remote sessions via RPC.
 * State is updated through events from the RPCEventMapper.
 *
 * @example
 * ```typescript
 * const ws = new WebSocketClient("ws://localhost:8080");
 * const rpcClient = new RPCClient(ws);
 * const eventMapper = new RPCEventMapper();
 * const adapter = new RemoteSessionAdapter(rpcClient, eventMapper);
 *
 * // Subscribe to events
 * adapter.subscribe((event) => {
 *   if (event.type === "message_update") {
 *     console.log("New message delta:", event.delta);
 *   }
 * });
 *
 * // Send a prompt
 * await adapter.sendPrompt("Hello, world!");
 * ```
 */
export class RemoteSessionAdapter {
	/**
	 * RPC client for sending commands to the remote session.
	 */
	private _rpcClient: RPCClient;

	/**
	 * Event mapper for converting RPC events to SessionEvent types.
	 */
	private eventMapper: RPCEventMapper;

	/**
	 * Set of event listeners subscribed to this adapter.
	 */
	private listeners = new Set<(event: SessionEvent) => void>();

	/**
	 * Unsubscribe function for the event mapper subscription.
	 */
	private eventMapperUnsubscribe: (() => void) | null = null;

	// ========================================================================
	// State
	// ========================================================================

	/**
	 * Accumulated messages from the session.
	 */
	private _messages: AgentMessage[] = [];

	/**
	 * Current model being used in the session.
	 */
	private _model: Model<any> | null = null;

	/**
	 * Current thinking level for the session.
	 */
	private _thinkingLevel: ThinkingLevel = "off";

	/**
	 * Whether a streaming response is currently active.
	 */
	private _isStreaming = false;

	// ========================================================================
	// Constructor
	// ========================================================================

	/**
	 * Creates a new RemoteSessionAdapter.
	 *
	 * @param rpcClient - RPC client for sending commands to the remote session
	 * @param eventMapper - Event mapper for converting RPC events to SessionEvent types
	 */
	constructor(rpcClient: RPCClient, eventMapper: RPCEventMapper) {
		this._rpcClient = rpcClient;
		this.eventMapper = eventMapper;

		// Subscribe to event mapper to receive session events
		this.eventMapperUnsubscribe = this.eventMapper.subscribe(this.handleEvent.bind(this));
	}

	// ========================================================================
	// Getters
	// ========================================================================

	/**
	 * Gets the RPC client used by this adapter.
	 * @internal
	 */
	get rpcClient(): RPCClient {
		return this._rpcClient;
	}

	/**
	 * Gets the accumulated messages from the session.
	 */
	get messages(): AgentMessage[] {
		return this._messages;
	}

	/**
	 * Gets the current model being used in the session.
	 */
	get model(): string | null {
		return this._model?.id ?? null;
	}

	/**
	 * Gets the current thinking level for the session.
	 */
	get thinkingLevel(): ThinkingLevel {
		return this._thinkingLevel;
	}

	/**
	 * Gets whether a streaming response is currently active.
	 */
	get isStreaming(): boolean {
		return this._isStreaming;
	}

	// ========================================================================
	// Public Methods (stubs - implemented in subsequent tasks)
	// ========================================================================

	/**
	 * Sends a prompt to the remote session.
	 *
	 * The prompt is sent via RPC and the response is streamed back through
	 * events. The method returns immediately after sending the prompt.
	 *
	 * @param prompt - The user's prompt text
	 */
	async sendPrompt(prompt: string): Promise<void> {
		this._isStreaming = true;

		// Add user message to local state
		const userMessage = this.createUserMessage(prompt);
		this._messages.push(userMessage);

		// Send RPC command
		await this._rpcClient.sendCommand({
			type: "prompt",
			message: prompt,
		});

		// Response streaming happens via events (already subscribed)
	}

	/**
	 * Aborts the current streaming response.
	 */
	async abort(): Promise<void> {
		await this._rpcClient.sendCommand({ type: "abort" });
		this._isStreaming = false;
	}

	/**
	 * Sets the model to use for the session.
	 *
	 * @param modelId - The model ID to use
	 */
	async setModel(modelId: string): Promise<void> {
		// Query available models to find the matching model and its provider
		const response = await this._rpcClient.sendCommand<{
			type: "response";
			command: "get_available_models";
			success: true;
			data: { models: Model<any>[] };
		}>({
			type: "get_available_models",
		});

		if (!response.success) {
			throw new Error("Failed to get available models");
		}

		// Find the model matching the modelId
		const model = response.data.models.find((m) => m.id === modelId);
		if (!model) {
			throw new Error(`Model not found: ${modelId}`);
		}

		// Send set_model command with both provider and modelId
		await this._rpcClient.sendCommand({ type: "set_model", provider: model.provider, modelId });
		this._model = model;
	}

	/**
	 * Sets the thinking level for the session.
	 *
	 * @param level - The thinking level to set
	 */
	async setThinkingLevel(level: ThinkingLevel): Promise<void> {
		await this._rpcClient.sendCommand({ type: "set_thinking_level", level });
		this._thinkingLevel = level;
	}

	/**
	 * Starts a new session.
	 */
	async newSession(): Promise<void> {
		await this._rpcClient.sendCommand({ type: "new_session" });
		this._messages = [];
		// State will be updated via events
	}

	/**
	 * Switches to a different session.
	 *
	 * @param sessionPath - The path to the session file to switch to
	 */
	async switchSession(sessionPath: string): Promise<void> {
		await this._rpcClient.sendCommand({ type: "switch_session", sessionPath });
		await this.getState();
		await this.getMessages();
	}

	/**
	 * Gets the current state of the remote session.
	 *
	 * Fetches session state from the server and updates local state.
	 * This is called on connect and reconnect to sync state.
	 */
	async getState(): Promise<void> {
		const response = await this._rpcClient.sendCommand<{
			type: "response";
			command: "get_state";
			success: true;
			data: import("../networking/rpc-types.js").RPCSessionState;
		}>({
			type: "get_state",
		});

		if (response.success) {
			this._model = response.data.model ?? null;
			this._thinkingLevel = response.data.thinkingLevel;
			this._isStreaming = response.data.isStreaming;
		}
	}

	/**
	 * Gets all messages from the remote session.
	 *
	 * Fetches all messages from the server and updates local state.
	 * This is called on connect and reconnect to sync state.
	 *
	 * @returns Array of AgentMessage objects
	 */
	async getMessages(): Promise<AgentMessage[]> {
		const response = await this._rpcClient.sendCommand<{
			type: "response";
			command: "get_messages";
			success: true;
			data: { messages: AgentMessage[] };
		}>({
			type: "get_messages",
		});

		if (response.success) {
			this._messages = response.data.messages;
		}
		return this._messages;
	}

	// ========================================================================
	// Event Subscription
	// ========================================================================

	/**
	 * Subscribes to session events from this adapter.
	 *
	 * @param listener - Function to call when events are emitted
	 * @returns Unsubscribe function that removes the listener
	 */
	subscribe(listener: (event: SessionEvent) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	// ========================================================================
	// Event Handler
	// ========================================================================

	/**
	 * Handles incoming SessionEvents from the event mapper.
	 * Updates local state and emits events to subscribed listeners.
	 *
	 * @param event - The SessionEvent to handle
	 */
	private handleEvent(event: SessionEvent): void {
		switch (event.type) {
			case "session_start":
				// Session started - could initialize state here
				break;

			case "session_end":
				// Session ended - update messages
				this._messages = event.messages;
				this._isStreaming = false;
				break;

			case "message_start":
				// Message started
				this._isStreaming = true;
				break;

			case "message_end":
				// Message completed
				this._isStreaming = false;
				break;

			case "message_update":
				// Streaming message update
				// Update local message state
				this.updateMessage(event.messageId, event.message);
				break;

			case "turn_start":
				// New turn started
				break;

			case "turn_end":
				// Turn completed - update messages with new message and tool results
				this._messages.push(event.message);
				for (const toolResult of event.toolResults) {
					this._messages.push(toolResult);
				}
				this._isStreaming = false;
				break;

			case "tool_start":
				// Tool execution started
				break;

			case "tool_update":
				// Tool execution partial result
				break;

			case "tool_end":
				// Tool execution completed
				break;
		}

		// Emit event to all subscribed listeners
		this.emit(event);
	}

	/**
	 * Updates a message in the local messages array.
	 *
	 * @param messageId - The ID of the message to update
	 * @param message - The updated message data
	 */
	private updateMessage(messageId: string, message: AgentMessage): void {
		// Find the message by ID and update it
		const index = this._messages.findIndex((m) => this.getMessageId(m) === messageId);

		if (index !== -1) {
			// Update existing message
			this._messages[index] = message;
		} else {
			// Add new message
			this._messages.push(message);
		}
	}

	/**
	 * Emits an event to all subscribed listeners.
	 *
	 * @param event - The SessionEvent to emit
	 */
	private emit(event: SessionEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (error) {
				// Log errors but don't fail other listeners
				console.error("Error in RemoteSessionAdapter listener:", error);
			}
		}
	}

	/**
	 * Generates a stable message ID from an AgentMessage.
	 *
	 * Uses the same logic as RPCEventMapper.getMessageId for consistency.
	 *
	 * @param message - The message to generate an ID for
	 * @returns A string identifier for the message
	 */
	private getMessageId(message: AgentMessage): string {
		// Use role + timestamp if available
		if ("timestamp" in message && message.timestamp) {
			return `${message.role}-${message.timestamp}`;
		}
		// Fallback: simple hash based on message role and content
		return `${message.role}-${Date.now()}`;
	}

	// ========================================================================
	// Cleanup
	// ========================================================================

	/**
	 * Cleans up resources when the adapter is no longer needed.
	 */
	destroy(): void {
		// Unsubscribe from event mapper
		if (this.eventMapperUnsubscribe) {
			this.eventMapperUnsubscribe();
			this.eventMapperUnsubscribe = null;
		}

		// Clear all listeners
		this.listeners.clear();
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	/**
	 * Creates a user message from the prompt text.
	 *
	 * @param prompt - The user's prompt text
	 * @returns A UserMessage object
	 */
	private createUserMessage(prompt: string): import("@mariozechner/pi-ai").UserMessage {
		return {
			role: "user",
			content: prompt,
			timestamp: Date.now(),
		};
	}
}
