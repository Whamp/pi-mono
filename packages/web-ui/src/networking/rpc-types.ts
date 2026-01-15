/**
 * RPC protocol types for WebSocket communication with remote Pi sessions.
 *
 * These types mirror the RPC protocol used by `pi --mode rpc` for communication
 * over stdin/stdout. The WebSocket client serializes these types to JSON lines
 * and receives JSON lines back, mapping them to unified SessionEvent types.
 *
 * @see packages/coding-agent/src/modes/rpc/rpc-types.ts for the source RPC types
 * @see packages/web-ui/specs/modes/remote-session-mode.md for architecture details
 */

import type { AgentMessage, ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { ImageContent, Model } from "@mariozechner/pi-ai";

// ============================================================================
// RPC Commands (sent from client to server)
// ============================================================================

/**
 * Helper type to create a command without the `id` field.
 * Omit doesn't distribute over unions, so we need this helper.
 */
export type RPCCommandWithoutId = {
	[K in RPCCommand["type"]]: Extract<RPCCommand, { type: K }> extends infer T ? Omit<T, "id"> : never;
}[RPCCommand["type"]];

/**
 * All RPC command types that can be sent to the remote Pi session.
 * Each command has an optional `id` field for request/response correlation.
 */
export type RPCCommand =
	// Prompting
	| { id?: string; type: "prompt"; message: string; images?: ImageContent[]; streamingBehavior?: "steer" | "followUp" }
	| { id?: string; type: "steer"; message: string }
	| { id?: string; type: "follow_up"; message: string }
	| { id?: string; type: "abort" }
	| { id?: string; type: "new_session"; parentSession?: string }

	// State
	| { id?: string; type: "get_state" }

	// Model
	| { id?: string; type: "set_model"; provider: string; modelId: string }
	| { id?: string; type: "cycle_model" }
	| { id?: string; type: "get_available_models" }

	// Thinking
	| { id?: string; type: "set_thinking_level"; level: ThinkingLevel }
	| { id?: string; type: "cycle_thinking_level" }

	// Queue modes
	| { id?: string; type: "set_steering_mode"; mode: "all" | "one-at-a-time" }
	| { id?: string; type: "set_follow_up_mode"; mode: "all" | "one-at-a-time" }

	// Compaction
	| { id?: string; type: "compact"; customInstructions?: string }
	| { id?: string; type: "set_auto_compaction"; enabled: boolean }

	// Retry
	| { id?: string; type: "set_auto_retry"; enabled: boolean }
	| { id?: string; type: "abort_retry" }

	// Bash
	| { id?: string; type: "bash"; command: string }
	| { id?: string; type: "abort_bash" }

	// Session
	| { id?: string; type: "get_session_stats" }
	| { id?: string; type: "export_html"; outputPath?: string }
	| { id?: string; type: "switch_session"; sessionPath: string }
	| { id?: string; type: "fork"; entryId: string }
	| { id?: string; type: "get_fork_messages" }
	| { id?: string; type: "get_last_assistant_text" }

	// Messages
	| { id?: string; type: "get_messages" };

/**
 * Union type of all RPC command type strings.
 */
export type RPCCommandType = RPCCommand["type"];

// ============================================================================
// RPC Session State
// ============================================================================

/**
 * Current state of a remote Pi session.
 * Returned by the `get_state` command.
 */
export interface RPCSessionState {
	/** Current model (may be undefined) */
	model?: Model<any>;
	/** Current thinking level */
	thinkingLevel: ThinkingLevel;
	/** Whether the agent is currently streaming */
	isStreaming: boolean;
	/** Whether a compaction is in progress */
	isCompacting: boolean;
	/** How steering messages are delivered */
	steeringMode: "all" | "one-at-a-time";
	/** How follow-up messages are delivered */
	followUpMode: "all" | "one-at-a-time";
	/** Path to the session file on the server */
	sessionFile?: string;
	/** Unique session identifier */
	sessionId: string;
	/** Whether auto-compaction is enabled */
	autoCompactionEnabled: boolean;
	/** Number of messages in the session */
	messageCount: number;
	/** Number of pending (not yet sent) messages */
	pendingMessageCount: number;
}

// ============================================================================
// RPC Responses (sent from server to client)
// ============================================================================

/**
 * Success responses with data.
 * Each response type corresponds to a command type.
 */
export type RPCSuccessResponse =
	// Prompting (async - events follow)
	| { id?: string; type: "response"; command: "prompt"; success: true }
	| { id?: string; type: "response"; command: "steer"; success: true }
	| { id?: string; type: "response"; command: "follow_up"; success: true }
	| { id?: string; type: "response"; command: "abort"; success: true }
	| { id?: string; type: "response"; command: "new_session"; success: true; data: { cancelled: boolean } }

	// State
	| { id?: string; type: "response"; command: "get_state"; success: true; data: RPCSessionState }

	// Model
	| {
			id?: string;
			type: "response";
			command: "set_model";
			success: true;
			data: Model<any>;
	  }
	| {
			id?: string;
			type: "response";
			command: "cycle_model";
			success: true;
			data: { model: Model<any>; thinkingLevel: ThinkingLevel; isScoped: boolean } | null;
	  }
	| {
			id?: string;
			type: "response";
			command: "get_available_models";
			success: true;
			data: { models: Model<any>[] };
	  }

	// Thinking
	| { id?: string; type: "response"; command: "set_thinking_level"; success: true }
	| {
			id?: string;
			type: "response";
			command: "cycle_thinking_level";
			success: true;
			data: { level: ThinkingLevel } | null;
	  }

	// Queue modes
	| { id?: string; type: "response"; command: "set_steering_mode"; success: true }
	| { id?: string; type: "response"; command: "set_follow_up_mode"; success: true }

	// Compaction
	| { id?: string; type: "response"; command: "compact"; success: true; data: RPCompactionResult }
	| { id?: string; type: "response"; command: "set_auto_compaction"; success: true }

	// Retry
	| { id?: string; type: "response"; command: "set_auto_retry"; success: true }
	| { id?: string; type: "response"; command: "abort_retry"; success: true }

	// Bash
	| { id?: string; type: "response"; command: "bash"; success: true; data: RPCBashResult }
	| { id?: string; type: "response"; command: "abort_bash"; success: true }

	// Session
	| { id?: string; type: "response"; command: "get_session_stats"; success: true; data: RPCSessionStats }
	| { id?: string; type: "response"; command: "export_html"; success: true; data: { path: string } }
	| { id?: string; type: "response"; command: "switch_session"; success: true; data: { cancelled: boolean } }
	| { id?: string; type: "response"; command: "fork"; success: true; data: { text: string; cancelled: boolean } }
	| {
			id?: string;
			type: "response";
			command: "get_fork_messages";
			success: true;
			data: { messages: Array<{ entryId: string; text: string }> };
	  }
	| {
			id?: string;
			type: "response";
			command: "get_last_assistant_text";
			success: true;
			data: { text: string | null };
	  }

	// Messages
	| { id?: string; type: "response"; command: "get_messages"; success: true; data: { messages: AgentMessage[] } };

/**
 * Error response for any failed command.
 */
export type RPCErrorResponse = { id?: string; type: "response"; command: string; success: false; error: string };

/**
 * Union of all response types (success and error).
 */
export type RPCResponse = RPCSuccessResponse | RPCErrorResponse;

// ============================================================================
// RPC Events (sent from server to client)
// ============================================================================

/**
 * Emitted when the agent begins processing a prompt.
 */
export interface RPCAgentStartEvent {
	type: "agent_start";
}

/**
 * Emitted when the agent completes. Contains all messages generated during this run.
 */
export interface RPCAgentEndEvent {
	type: "agent_end";
	messages: AgentMessage[];
}

/**
 * Emitted when a new turn begins.
 */
export interface RPCTurnStartEvent {
	type: "turn_start";
}

/**
 * Emitted when a turn completes. Includes assistant message and tool results.
 */
export interface RPCTurnEndEvent {
	type: "turn_end";
	message: AgentMessage;
	toolResults: AgentMessage[];
}

/**
 * Emitted when a message begins.
 */
export interface RPCMessageStartEvent {
	type: "message_start";
	message: AgentMessage;
}

/**
 * Emitted when a message completes.
 */
export interface RPCMessageEndEvent {
	type: "message_end";
	message: AgentMessage;
}

/**
 * Streaming delta event types for assistant messages.
 * These are emitted as the assistant generates content.
 */
export type RPCAssistantMessageDeltaEvent =
	| { type: "start"; partial: AgentMessage }
	| { type: "text_start"; contentIndex: number; partial: AgentMessage }
	| { type: "text_delta"; contentIndex: number; delta: string; partial: AgentMessage }
	| { type: "text_end"; contentIndex: number; content: string; partial: AgentMessage }
	| { type: "thinking_start"; contentIndex: number; partial: AgentMessage }
	| { type: "thinking_delta"; contentIndex: number; delta: string; partial: AgentMessage }
	| { type: "thinking_end"; contentIndex: number; content: string; partial: AgentMessage }
	| { type: "toolcall_start"; contentIndex: number; partial: AgentMessage }
	| { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AgentMessage }
	| { type: "toolcall_end"; contentIndex: number; toolCall: RPCToolCall; partial: AgentMessage }
	| { type: "done"; reason: "stop" | "length" | "toolUse"; message: AgentMessage }
	| { type: "error"; reason: "aborted" | "error"; error: AgentMessage };

/**
 * Emitted during streaming of assistant messages.
 * Contains both the partial message and a streaming delta event.
 */
export interface RPCMessageUpdateEvent {
	type: "message_update";
	message: AgentMessage;
	assistantMessageEvent: RPCAssistantMessageDeltaEvent;
}

/**
 * Emitted when a tool begins execution.
 */
export interface RPCToolExecutionStartEvent {
	type: "tool_execution_start";
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
}

/**
 * Emitted when tool execution progresses (streaming output).
 * The `partialResult` contains accumulated output so far.
 */
export interface RPCToolExecutionUpdateEvent {
	type: "tool_execution_update";
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
	partialResult: RPCToolResult;
}

/**
 * Emitted when a tool completes execution.
 */
export interface RPCToolExecutionEndEvent {
	type: "tool_execution_end";
	toolCallId: string;
	toolName: string;
	result: RPCToolResult;
	isError: boolean;
}

/**
 * Emitted when automatic compaction begins.
 */
export interface RPCAutoCompactionStartEvent {
	type: "auto_compaction_start";
	reason: "threshold" | "overflow";
}

/**
 * Emitted when automatic compaction completes.
 */
export interface RPCAutoCompactionEndEvent {
	type: "auto_compaction_end";
	result: RPCompactionResult | null;
	aborted: boolean;
	willRetry: boolean;
}

/**
 * Emitted when automatic retry begins after a transient error.
 */
export interface RPCAutoRetryStartEvent {
	type: "auto_retry_start";
	attempt: number;
	maxAttempts: number;
	delayMs: number;
	errorMessage: string;
}

/**
 * Emitted when automatic retry completes (success or final failure).
 */
export interface RPCAutoRetryEndEvent {
	type: "auto_retry_end";
	success: boolean;
	attempt: number;
	finalError?: string;
}

/**
 * Emitted when a hook throws an error.
 */
export interface RPCHookErrorEvent {
	type: "hook_error";
	hookPath: string;
	event: string;
	error: string;
}

/**
 * Union of all RPC event types.
 * Events are streamed from the server and do NOT include an `id` field.
 */
export type RPCEvent =
	| RPCAgentStartEvent
	| RPCAgentEndEvent
	| RPCTurnStartEvent
	| RPCTurnEndEvent
	| RPCMessageStartEvent
	| RPCMessageUpdateEvent
	| RPCMessageEndEvent
	| RPCToolExecutionStartEvent
	| RPCToolExecutionUpdateEvent
	| RPCToolExecutionEndEvent
	| RPCAutoCompactionStartEvent
	| RPCAutoCompactionEndEvent
	| RPCAutoRetryStartEvent
	| RPCAutoRetryEndEvent
	| RPCHookErrorEvent;

/**
 * Union type of all RPC event type strings.
 */
export type RPCEventType = RPCEvent["type"];

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Tool call representation.
 */
export interface RPCToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

/**
 * Tool result content blocks.
 */
export type RPCToolContentBlock =
	| { type: "text"; text: string }
	| { type: "image"; source: { type: "base64"; mediaType: string; data: string } };

/**
 * Tool result details.
 */
export interface RPCToolResultDetails {
	truncation: "max_output" | null;
	fullOutputPath: string | null;
}

/**
 * Tool result returned from tool execution.
 */
export interface RPCToolResult {
	content: RPCToolContentBlock[];
	details: RPCToolResultDetails;
}

/**
 * Compaction result from manual or automatic compaction.
 */
export interface RPCompactionResult {
	summary: string;
	firstKeptEntryId: string;
	tokensBefore: number;
	details: Record<string, unknown>;
}

/**
 * Bash execution result.
 */
export interface RPCBashResult {
	output: string;
	exitCode: number;
	cancelled: boolean;
	truncated: boolean;
	fullOutputPath: string | null;
}

/**
 * Session statistics including token usage and cost.
 */
export interface RPCSessionStats {
	sessionFile: string;
	sessionId: string;
	userMessages: number;
	assistantMessages: number;
	toolCalls: number;
	toolResults: number;
	totalMessages: number;
	tokens: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
	cost: number;
}

// ============================================================================
// Extension UI Types (optional - for future use)
// ============================================================================

/**
 * Extension UI request events (server requesting user input from client).
 */
export type RPCExtensionUIRequest =
	| { type: "extension_ui_request"; id: string; method: "select"; title: string; options: string[]; timeout?: number }
	| { type: "extension_ui_request"; id: string; method: "confirm"; title: string; message: string; timeout?: number }
	| {
			type: "extension_ui_request";
			id: string;
			method: "input";
			title: string;
			placeholder?: string;
			timeout?: number;
	  }
	| { type: "extension_ui_request"; id: string; method: "editor"; title: string; prefill?: string }
	| {
			type: "extension_ui_request";
			id: string;
			method: "notify";
			message: string;
			notifyType?: "info" | "warning" | "error";
	  }
	| {
			type: "extension_ui_request";
			id: string;
			method: "setStatus";
			statusKey: string;
			statusText: string | undefined;
	  }
	| {
			type: "extension_ui_request";
			id: string;
			method: "setWidget";
			widgetKey: string;
			widgetLines: string[] | undefined;
	  }
	| { type: "extension_ui_request"; id: string; method: "setTitle"; title: string }
	| { type: "extension_ui_request"; id: string; method: "set_editor_text"; text: string };

/**
 * Extension UI response (client responding to extension request).
 */
export type RPCExtensionUIResponse =
	| { type: "extension_ui_response"; id: string; value: string }
	| { type: "extension_ui_response"; id: string; confirmed: boolean }
	| { type: "extension_ui_response"; id: string; cancelled: true };
