/**
 * Maps RPC events from the remote session to UI-friendly SessionEvent types.
 *
 * This component converts the raw RPC protocol events into a more ergonomic
 * event format for the UI. Basic lifecycle events are mapped directly,
 * while streaming deltas are handled incrementally.
 *
 * @module
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, TextContent, ThinkingContent, ToolCall } from "@mariozechner/pi-ai";
import type {
	RPCAgentEndEvent,
	RPCAgentStartEvent,
	RPCEvent,
	RPCMessageEndEvent,
	RPCMessageStartEvent,
	RPCMessageUpdateEvent,
	RPCToolCall,
	RPCToolExecutionEndEvent,
	RPCToolExecutionStartEvent,
	RPCToolExecutionUpdateEvent,
	RPCTurnEndEvent,
	RPCTurnStartEvent,
} from "./rpc-types.js";

// ============================================================================
// SessionEvent Types (UI-friendly event format)
// ============================================================================

/**
 * UI-friendly session events emitted by the mapper.
 * These provide a simpler, more uniform interface for consuming components.
 */
export type SessionEvent =
	// Lifecycle events
	| { type: "session_start" }
	| { type: "session_end"; messages: AgentMessage[] }
	// Message events
	| { type: "message_start"; messageId: string; role: string }
	| { type: "message_end"; messageId: string }
	| { type: "message_update"; messageId: string; message: AgentMessage; delta: unknown }
	// Turn events
	| { type: "turn_start" }
	| { type: "turn_end"; message: AgentMessage; toolResults: AgentMessage[] }
	// Tool events
	| { type: "tool_start"; toolCallId: string; toolName: string }
	| { type: "tool_update"; toolCallId: string; partialResult: unknown }
	| { type: "tool_end"; toolCallId: string; result: unknown };

// ============================================================================
// RPCEventMapper Class
// ============================================================================

/**
 * Maps RPC events to SessionEvent types and emits them to subscribers.
 *
 * The mapper handles the translation between the detailed RPC protocol
 * events and the simpler SessionEvent format used by UI components.
 *
 * @example
 * ```typescript
 * const mapper = new RPCEventMapper();
 *
 * // Subscribe to UI events
 * const unsubscribe = mapper.subscribe((event) => {
 *   if (event.type === "session_start") {
 *     console.log("Session started");
 *   } else if (event.type === "message_update") {
 *     console.log("Message delta:", event.delta);
 *   }
 * });
 *
 * // Feed RPC events into the mapper
 * mapper.handleEvent({ type: "agent_start" });
 * mapper.handleEvent({ type: "message_start", message: {...} });
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
export class RPCEventMapper {
	/**
	 * Set of event listeners subscribed to this mapper.
	 */
	private listeners = new Set<(event: SessionEvent) => void>();

	/**
	 * Current message ID being accumulated from streaming deltas.
	 */
	private currentMessageId: string | null = null;

	/**
	 * Current message state being accumulated from streaming deltas.
	 */
	private currentMessage: AssistantMessage | null = null;

	/**
	 * Current content blocks being accumulated, indexed by contentIndex.
	 * Maps contentIndex to the content block (TextContent, ThinkingContent, or ToolCall).
	 */
	private currentContent = new Map<number, TextContent | ThinkingContent | ToolCall>();

	/**
	 * Accumulated tool call arguments (JSON strings) by contentIndex.
	 * Tool call deltas are JSON fragments that need to be accumulated and parsed.
	 */
	private toolCallArgs = new Map<number, string>();

	/**
	 * Processes an incoming RPC event and emits corresponding SessionEvent(s).
	 *
	 * This method maps each RPC event type to one or more SessionEvent types.
	 * Basic lifecycle events map directly, while streaming events require
	 * incremental state tracking (handled in future tasks).
	 *
	 * @param rpcEvent - The RPC event to process
	 */
	handleEvent(rpcEvent: RPCEvent): void {
		switch (rpcEvent.type) {
			// Session lifecycle events
			case "agent_start":
				this.handleAgentStart(rpcEvent);
				break;

			case "agent_end":
				this.handleAgentEnd(rpcEvent);
				break;

			// Turn events
			case "turn_start":
				this.handleTurnStart(rpcEvent);
				break;

			case "turn_end":
				this.handleTurnEnd(rpcEvent);
				break;

			// Message events
			case "message_start":
				this.handleMessageStart(rpcEvent);
				break;

			case "message_end":
				this.handleMessageEnd(rpcEvent);
				break;

			// Message updates (streaming deltas)
			case "message_update":
				this.handleMessageUpdate(rpcEvent);
				break;

			// Tool execution events - handled in next task
			case "tool_execution_start":
				this.handleToolExecutionStart(rpcEvent);
				break;

			case "tool_execution_update":
				this.handleToolExecutionUpdate(rpcEvent);
				break;

			case "tool_execution_end":
				this.handleToolExecutionEnd(rpcEvent);
				break;

			// Events not mapped in this version
			case "auto_compaction_start":
			case "auto_compaction_end":
			case "auto_retry_start":
			case "auto_retry_end":
			case "hook_error":
				// These events are informational but don't map to SessionEvent
				// in this version. They may be added in future iterations.
				break;
		}
	}

	/**
	 * Subscribes a listener to receive SessionEvent emissions.
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
	// Event Handlers
	// ========================================================================

	/**
	 * Handles agent_start event - emits session_start.
	 */
	private handleAgentStart(_event: RPCAgentStartEvent): void {
		this.emit({ type: "session_start" });
	}

	/**
	 * Handles agent_end event - emits session_end with all messages.
	 */
	private handleAgentEnd(event: RPCAgentEndEvent): void {
		this.emit({ type: "session_end", messages: event.messages });
	}

	/**
	 * Handles turn_start event - emits turn_start.
	 */
	private handleTurnStart(_event: RPCTurnStartEvent): void {
		this.emit({ type: "turn_start" });
	}

	/**
	 * Handles turn_end event - emits turn_end with message and tool results.
	 */
	private handleTurnEnd(event: RPCTurnEndEvent): void {
		this.emit({ type: "turn_end", message: event.message, toolResults: event.toolResults });
	}

	/**
	 * Handles message_start event - emits message_start with message ID and role.
	 * Also initializes streaming state for assistant messages.
	 */
	private handleMessageStart(event: RPCMessageStartEvent): void {
		const message = event.message;
		this.currentMessageId = this.getMessageId(message);
		this.emit({ type: "message_start", messageId: this.currentMessageId, role: message.role });

		// Initialize streaming state for assistant messages
		if (message.role === "assistant") {
			this.currentMessage = message as AssistantMessage;
			this.currentContent.clear();
			this.toolCallArgs.clear();
		}
	}

	/**
	 * Handles message_update event - processes streaming deltas and emits message_update.
	 */
	private handleMessageUpdate(event: RPCMessageUpdateEvent): void {
		const delta = event.assistantMessageEvent;

		switch (delta.type) {
			case "text_delta":
				this.appendText(delta.contentIndex, delta.delta);
				break;

			case "thinking_delta":
				this.appendThinking(delta.contentIndex, delta.delta);
				break;

			case "toolcall_delta":
				this.appendToolCallArgs(delta.contentIndex, delta.delta);
				break;

			case "toolcall_end":
				this.finalizeToolCall(delta.contentIndex, delta.toolCall);
				break;

			case "text_start":
			case "text_end":
			case "thinking_start":
			case "thinking_end":
			case "toolcall_start":
			case "start":
			case "done":
			case "error":
				// These events don't require delta accumulation
				break;
		}

		// Build accumulated message and emit update
		const accumulatedMessage = this.buildMessage();
		if (accumulatedMessage) {
			this.emit({
				type: "message_update",
				messageId: this.currentMessageId ?? "",
				message: accumulatedMessage,
				delta,
			});
		}
	}

	/**
	 * Handles message_end event - emits message_end and clears streaming state.
	 */
	private handleMessageEnd(event: RPCMessageEndEvent): void {
		const message = event.message;
		this.emit({ type: "message_end", messageId: this.getMessageId(message) });

		// Clear streaming state
		this.currentMessage = null;
		this.currentMessageId = null;
		this.currentContent.clear();
		this.toolCallArgs.clear();
	}

	/**
	 * Handles tool_execution_start event - emits tool_start.
	 */
	private handleToolExecutionStart(event: RPCToolExecutionStartEvent): void {
		this.emit({ type: "tool_start", toolCallId: event.toolCallId, toolName: event.toolName });
	}

	/**
	 * Handles tool_execution_update event - emits tool_update with partial result.
	 */
	private handleToolExecutionUpdate(event: RPCToolExecutionUpdateEvent): void {
		this.emit({ type: "tool_update", toolCallId: event.toolCallId, partialResult: event.partialResult });
	}

	/**
	 * Handles tool_execution_end event - emits tool_end with result.
	 */
	private handleToolExecutionEnd(event: RPCToolExecutionEndEvent): void {
		this.emit({ type: "tool_end", toolCallId: event.toolCallId, result: event.result });
	}

	// ========================================================================
	// Utilities
	// ========================================================================

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
				console.error("Error in SessionEvent listener:", error);
			}
		}
	}

	/**
	 * Generates a stable message ID from an AgentMessage.
	 *
	 * Messages don't have a canonical ID in the protocol, so we generate
	 * one based on message properties. This may be improved in the future
	 * if the protocol adds explicit message IDs.
	 *
	 * @param message - The message to generate an ID for
	 * @returns A string identifier for the message
	 */
	private getMessageId(message: AgentMessage): string {
		// Use role + timestamp if available, otherwise fallback to a hash
		if ("timestamp" in message && message.timestamp) {
			return `${message.role}-${message.timestamp}`;
		}
		// Fallback: simple hash based on message role and content
		return `${message.role}-${Date.now()}`;
	}

	// ========================================================================
	// Streaming Delta Accumulation Helpers
	// ========================================================================

	/**
	 * Appends text delta to the content block at the specified index.
	 *
	 * @param contentIndex - The index of the text content block
	 * @param delta - The text delta to append
	 */
	private appendText(contentIndex: number, delta: string): void {
		let content = this.currentContent.get(contentIndex);

		if (!content || content.type !== "text") {
			// Initialize new text content block
			content = { type: "text", text: "" };
			this.currentContent.set(contentIndex, content);
		}

		content.text += delta;
	}

	/**
	 * Appends thinking delta to the content block at the specified index.
	 *
	 * @param contentIndex - The index of the thinking content block
	 * @param delta - The thinking delta to append
	 */
	private appendThinking(contentIndex: number, delta: string): void {
		let content = this.currentContent.get(contentIndex);

		if (!content || content.type !== "thinking") {
			// Initialize new thinking content block
			content = { type: "thinking", thinking: "" };
			this.currentContent.set(contentIndex, content);
		}

		content.thinking += delta;
	}

	/**
	 * Appends JSON fragment to tool call arguments at the specified index.
	 * Tool call arguments arrive as JSON fragments that are accumulated
	 * and parsed when toolcall_end arrives.
	 *
	 * @param contentIndex - The index of the tool call content block
	 * @param delta - The JSON fragment to append
	 */
	private appendToolCallArgs(contentIndex: number, delta: string): void {
		const currentArgs = this.toolCallArgs.get(contentIndex) ?? "";
		this.toolCallArgs.set(contentIndex, currentArgs + delta);
	}

	/**
	 * Finalizes a tool call with the complete tool call data from toolcall_end.
	 *
	 * @param contentIndex - The index of the tool call content block
	 * @param toolCall - The complete tool call with arguments
	 */
	private finalizeToolCall(contentIndex: number, toolCall: RPCToolCall): void {
		// Convert RPCToolCall to ToolCall format
		const toolCallContent: ToolCall = {
			type: "toolCall",
			id: toolCall.id,
			name: toolCall.name,
			arguments: toolCall.arguments,
		};
		this.currentContent.set(contentIndex, toolCallContent);
		this.toolCallArgs.delete(contentIndex);
	}

	/**
	 * Builds the current accumulated message from the partial message and content.
	 *
	 * @returns The accumulated AssistantMessage or null if no current message
	 */
	private buildMessage(): AssistantMessage | null {
		if (!this.currentMessage) {
			return null;
		}

		// Sort content blocks by index and build the content array
		const sortedIndices = Array.from(this.currentContent.keys()).sort((a, b) => a - b);
		const content: (TextContent | ThinkingContent | ToolCall)[] = [];

		for (const index of sortedIndices) {
			const block = this.currentContent.get(index);
			if (block) {
				content.push(block);
			}
		}

		// Return a new message with accumulated content
		return {
			...this.currentMessage,
			content,
		};
	}
}
