# Remote Session Server Implementation Guide

This document provides specifications for implementing a WebSocket server compatible with Pi Web UI's remote session mode. The server acts as a bridge between the browser-based UI and a Pi agent running on a server.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [WebSocket Protocol](#websocket-protocol)
- [Authentication](#authentication)
- [RPC Commands](#rpc-commands)
- [RPC Responses](#rpc-responses)
- [RPC Events](#rpc-events)
- [Extension UI Protocol](#extension-ui-protocol)
- [Error Handling](#error-handling)
- [Connection Management](#connection-management)
- [Example Implementation](#example-implementation)
- [Type Definitions](#type-definitions)

---

## Overview

Remote session mode enables the web UI to connect to a Pi agent running on a server with full tool access (file system, bash, git, etc.). The server:

1. Accepts WebSocket connections from the browser
2. Authenticates clients using a token
3. Spawns or attaches to a Pi agent process running in `--mode rpc`
4. Proxies JSON commands between the WebSocket and the Pi agent's stdin
5. Streams JSON events from the Pi agent's stdout back to the WebSocket

### Key Features

- **Full tool execution**: All tools (read, write, edit, bash, etc.) run on the server
- **Session persistence**: Sessions are stored on the server and can be resumed
- **Streaming events**: Real-time streaming of agent responses, tool output, and status updates
- **Request/response correlation**: Commands support optional ID for async responses
- **Extension support**: Extensions can request UI interactions (prompts, selections, etc.)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                              Browser                                  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    WebSocketRPCClient                           │  │
│  │  - Connection management (connect, reconnect, disconnect)      │  │
│  │  - Command serialization (JSON)                                │  │
│  │  - Event deserialization (JSONL)                               │  │
│  │  - Request/response correlation (via id)                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket (wss://)
                                    │ JSONL protocol (one JSON per line)
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           Your WebSocket Server                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Connection Handler                                             │  │
│  │  - Accept WebSocket connections                                 │  │
│  │  - Validate authentication token                               │  │
│  │  - Parse connection parameters (session, cwd)                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Process Manager                                                │  │
│  │  - Spawn pi process: pi --mode rpc --session <path>            │  │
│  │  - Attach to existing session                                  │  │
│  │  - Manage process lifecycle                                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Protocol Bridge                                                │  │
│  │  - WebSocket ↔ stdin/stdout proxy                               │  │
│  │  - JSON parsing/validation                                      │  │
│  │  - Request/response correlation                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ stdin/stdout (JSONL)
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│  pi --mode rpc --session /path/to/session.jsonl                      │
│  - Full Pi capabilities                                              │
│  - All tools (read, bash, edit, write, etc.)                        │
│  - Extensions, skills, project context                              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## WebSocket Protocol

### Connection URL

```
wss://<host>:<port>/session?token=<auth_token>&session=<session_path>&cwd=<working_directory>
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | Authentication token (generated by server) |
| `session` | string | No | Path to existing session file. If omitted, creates new session |
| `cwd` | string | No | Working directory for new sessions. Defaults to server's working directory |

### Message Format

All messages are sent as **JSONL** (one JSON object per line, separated by newlines).

**Example client-to-server message (command):**
```json
{"type":"prompt","message":"Hello","id":"abc-123"}
```

**Example server-to-client message (response):**
```json
{"type":"response","command":"prompt","success":true,"id":"abc-123"}
```

**Example server-to-client message (event):**
```json
{"type":"agent_start"}
```

Multiple JSON objects can be sent in a single WebSocket message, separated by newlines.

### WebSocket Events

The server should emit connection-level events:

```typescript
// When connection is established and Pi process is ready
{ type: 'server_connected', sessionFile: string, sessionId: string }

// When connection closes
{ type: 'server_disconnected', reason: 'error' | 'close' | 'timeout', message?: string }

// On WebSocket errors
{ type: 'server_error', error: string }
```

---

## Authentication

### Token-Based Authentication

Authentication uses a simple bearer token system:

1. Server generates secure tokens (UUID or cryptographically random string)
2. Client includes token in connection URL query parameter
3. Server validates token on connection
4. Invalid tokens result in immediate connection closure (code 1008)

**Token validation flow:**

```typescript
// On WebSocket connection
const url = new URL(request.url);
const token = url.searchParams.get('token');

if (!isValidToken(token)) {
  websocket.close(1008, 'Invalid authentication token');
  return;
}

// Connection proceeds
```

### Token Management (Server-Side)

Token generation and storage are **server responsibilities**. Options include:

- Static tokens in configuration file
- Token database with expiration
- JWT tokens with claims
- Environment variables

**Example: Simple token file**

```json
{
  "tokens": {
    "client-1-token-abc123": {
      "name": "Work Laptop",
      "allowedPaths": ["/home/user/projects"],
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### Future: OAuth Integration

Server may support OAuth for multi-user scenarios:

1. OAuth2 authorization code flow
2. Access tokens as WebSocket auth
3. Refresh token handling
4. User-scoped permissions

---

## RPC Commands

All commands are sent from client to server. Commands have an optional `id` field for request/response correlation.

### Prompting Commands

#### prompt

Send a user message to the agent.

**Request:**
```typescript
{
  type: "prompt";
  message: string;
  images?: ImageContent[];
  streamingBehavior?: "steer" | "followUp";
  id?: string;
}
```

**Response (success):**
```typescript
{
  type: "response";
  command: "prompt";
  success: true;
  id?: string;
}
```

**Events (streamed):**
- `agent_start`
- `message_start`, `message_update`, `message_end`
- `turn_start`, `turn_end`
- `tool_execution_start`, `tool_execution_update`, `tool_execution_end`
- `agent_end`

#### steer

Queue a steering message (sent during agent streaming).

**Request:**
```typescript
{
  type: "steer";
  message: string;
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "steer";
  success: true;
  id?: string;
}
```

#### follow_up

Queue a follow-up message (sent after agent completes).

**Request:**
```typescript
{
  type: "follow_up";
  message: string;
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "follow_up";
  success: true;
  id?: string;
}
```

#### abort

Abort the current agent execution.

**Request:**
```typescript
{
  type: "abort";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "abort";
  success: true;
  id?: string;
}
```

### Session Commands

#### new_session

Create a new session, optionally forking from an existing one.

**Request:**
```typescript
{
  type: "new_session";
  parentSession?: string;  // Path to parent session to fork from
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "new_session";
  success: true;
  data: { cancelled: boolean };
  id?: string;
}
```

#### switch_session

Switch to a different session.

**Request:**
```typescript
{
  type: "switch_session";
  sessionPath: string;
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "switch_session";
  success: true;
  data: { cancelled: boolean };
  id?: string;
}
```

#### list_sessions

List available sessions (custom command, requires server implementation).

**Request:**
```typescript
{
  type: "list_sessions";
  cwd?: string;
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "list_sessions";
  success: true;
  data: {
    sessions: Array<{
      path: string;
      id: string;
      firstMessage: string;
      messageCount: number;
      lastModified: string;  // ISO 8601
      cwd: string;
    }>
  };
  id?: string;
}
```

### State Commands

#### get_state

Get the current session state.

**Request:**
```typescript
{
  type: "get_state";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "get_state";
  success: true;
  data: {
    model?: Model<any>;
    thinkingLevel: ThinkingLevel;
    isStreaming: boolean;
    isCompacting: boolean;
    steeringMode: "all" | "one-at-a-time";
    followUpMode: "all" | "one-at-a-time";
    sessionFile?: string;
    sessionId: string;
    autoCompactionEnabled: boolean;
    messageCount: number;
    pendingMessageCount: number;
  };
  id?: string;
}
```

#### get_session_stats

Get session statistics (token usage, cost, etc.).

**Request:**
```typescript
{
  type: "get_session_stats";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "get_session_stats";
  success: true;
  data: {
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
  };
  id?: string;
}
```

#### get_messages

Get all messages in the current session.

**Request:**
```typescript
{
  type: "get_messages";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "get_messages";
  success: true;
  data: { messages: AgentMessage[] };
  id?: string;
}
```

#### get_last_assistant_text

Get the text content of the last assistant message.

**Request:**
```typescript
{
  type: "get_last_assistant_text";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "get_last_assistant_text";
  success: true;
  data: { text: string | null };
  id?: string;
}
```

### Model Commands

#### set_model

Set the model for the current session.

**Request:**
```typescript
{
  type: "set_model";
  provider: string;   // e.g., "anthropic", "openai"
  modelId: string;    // e.g., "claude-sonnet-4-20250514"
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "set_model";
  success: true;
  data: Model<any>;
  id?: string;
}
```

#### cycle_model

Cycle to the next available model.

**Request:**
```typescript
{
  type: "cycle_model";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "cycle_model";
  success: true;
  data: {
    model: Model<any>;
    thinkingLevel: ThinkingLevel;
    isScoped: boolean;
  } | null;
  id?: string;
}
```

#### get_available_models

Get the list of available models.

**Request:**
```typescript
{
  type: "get_available_models";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "get_available_models";
  success: true;
  data: { models: Model<any>[] };
  id?: string;
}
```

### Thinking Commands

#### set_thinking_level

Set the thinking level for the agent.

**Request:**
```typescript
{
  type: "set_thinking_level";
  level: ThinkingLevel;  // "off" | "brief" | "medium" | "high"
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "set_thinking_level";
  success: true;
  id?: string;
}
```

#### cycle_thinking_level

Cycle to the next thinking level.

**Request:**
```typescript
{
  type: "cycle_thinking_level";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "cycle_thinking_level";
  success: true;
  data: { level: ThinkingLevel } | null;
  id?: string;
}
```

### Queue Mode Commands

#### set_steering_mode

Set how steering messages are delivered.

**Request:**
```typescript
{
  type: "set_steering_mode";
  mode: "all" | "one-at-a-time";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "set_steering_mode";
  success: true;
  id?: string;
}
```

#### set_follow_up_mode

Set how follow-up messages are delivered.

**Request:**
```typescript
{
  type: "set_follow_up_mode";
  mode: "all" | "one-at-a-time";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "set_follow_up_mode";
  success: true;
  id?: string;
}
```

### Compaction Commands

#### compact

Manually compact the session history.

**Request:**
```typescript
{
  type: "compact";
  customInstructions?: string;
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "compact";
  success: true;
  data: {
    summary: string;
    firstKeptEntryId: string;
    tokensBefore: number;
    details: Record<string, unknown>;
  };
  id?: string;
}
```

#### set_auto_compaction

Enable or disable automatic compaction.

**Request:**
```typescript
{
  type: "set_auto_compaction";
  enabled: boolean;
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "set_auto_compaction";
  success: true;
  id?: string;
}
```

### Retry Commands

#### set_auto_retry

Enable or disable automatic retry on transient errors.

**Request:**
```typescript
{
  type: "set_auto_retry";
  enabled: boolean;
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "set_auto_retry";
  success: true;
  id?: string;
}
```

#### abort_retry

Abort the current auto-retry attempt.

**Request:**
```typescript
{
  type: "abort_retry";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "abort_retry";
  success: true;
  id?: string;
}
```

### Bash Commands

#### bash

Execute a bash command.

**Request:**
```typescript
{
  type: "bash";
  command: string;
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "bash";
  success: true;
  data: {
    output: string;
    exitCode: number;
    cancelled: boolean;
    truncated: boolean;
    fullOutputPath: string | null;
  };
  id?: string;
}
```

#### abort_bash

Abort the current bash command.

**Request:**
```typescript
{
  type: "abort_bash";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "abort_bash";
  success: true;
  id?: string;
}
```

### Fork Commands

#### fork

Create a fork from a specific entry point.

**Request:**
```typescript
{
  type: "fork";
  entryId: string;
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "fork";
  success: true;
  data: {
    text: string;
    cancelled: boolean;
  };
  id?: string;
}
```

#### get_fork_messages

Get available fork points.

**Request:**
```typescript
{
  type: "get_fork_messages";
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "get_fork_messages";
  success: true;
  data: {
    messages: Array<{
      entryId: string;
      text: string;
    }>;
  };
  id?: string;
}
```

### Export Commands

#### export_html

Export the session as HTML.

**Request:**
```typescript
{
  type: "export_html";
  outputPath?: string;
  id?: string;
}
```

**Response:**
```typescript
{
  type: "response";
  command: "export_html";
  success: true;
  data: { path: string };
  id?: string;
}
```

---

## RPC Responses

All responses follow this structure:

```typescript
{
  type: "response";
  command: string;      // The command type this responds to
  success: boolean;     // true or false
  id?: string;          // Matches the request ID if provided
  data?: any;           // Response data (only if success: true)
  error?: string;       // Error message (only if success: false)
}
```

### Success Response Format

```typescript
{
  type: "response";
  command: "get_state";
  success: true;
  id: "abc-123",
  data: { /* ... */ }
}
```

### Error Response Format

```typescript
{
  type: "response";
  command: "set_model";
  success: false;
  id: "abc-123",
  error: "Model not found: unknown-model"
}
```

**Common error codes:**
- Invalid command type
- Invalid parameters
- Model not found
- Session not found
- Permission denied
- Server internal error

---

## RPC Events

Events are streamed from server to client as they occur. Events do NOT have an `id` field and are not correlated with requests.

### Agent Lifecycle Events

#### agent_start

Emitted when the agent begins processing a prompt.

```typescript
{
  type: "agent_start";
}
```

#### agent_end

Emitted when the agent completes. Contains all messages generated.

```typescript
{
  type: "agent_end";
  messages: AgentMessage[];
}
```

### Turn Events

#### turn_start

Emitted when a new turn begins.

```typescript
{
  type: "turn_start";
}
```

#### turn_end

Emitted when a turn completes.

```typescript
{
  type: "turn_end";
  message: AgentMessage;
  toolResults: AgentMessage[];
}
```

### Message Events

#### message_start

Emitted when a new message begins.

```typescript
{
  type: "message_start";
  message: AgentMessage;
}
```

#### message_update

Emitted during streaming of assistant messages. Contains the partial message and delta event.

```typescript
{
  type: "message_update";
  message: AgentMessage;
  assistantMessageEvent: AssistantMessageDeltaEvent;
}
```

**AssistantMessageDeltaEvent types:**

```typescript
// Beginning of message
{ type: "start"; partial: AgentMessage }

// Text streaming
{ type: "text_start"; contentIndex: number; partial: AgentMessage }
{ type: "text_delta"; contentIndex: number; delta: string; partial: AgentMessage }
{ type: "text_end"; contentIndex: number; content: string; partial: AgentMessage }

// Thinking streaming
{ type: "thinking_start"; contentIndex: number; partial: AgentMessage }
{ type: "thinking_delta"; contentIndex: number; delta: string; partial: AgentMessage }
{ type: "thinking_end"; contentIndex: number; content: string; partial: AgentMessage }

// Tool call streaming
{ type: "toolcall_start"; contentIndex: number; partial: AgentMessage }
{ type: "toolcall_delta"; contentIndex: number; delta: string; partial: AgentMessage }
{ type: "toolcall_end"; contentIndex: number; toolCall: RPCToolCall; partial: AgentMessage }

// Message completion
{ type: "done"; reason: "stop" | "length" | "toolUse"; message: AgentMessage }

// Error
{ type: "error"; reason: "aborted" | "error"; error: AgentMessage }
```

#### message_end

Emitted when a message completes.

```typescript
{
  type: "message_end";
  message: AgentMessage;
}
```

### Tool Execution Events

#### tool_execution_start

Emitted when a tool begins execution.

```typescript
{
  type: "tool_execution_start";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}
```

#### tool_execution_update

Emitted as tool output streams (e.g., bash output).

```typescript
{
  type: "tool_execution_update";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  partialResult: {
    content: Array<{
      type: "text" | "image";
      text?: string;
      source?: {
        type: "base64";
        mediaType: string;
        data: string;
      };
    }>;
    details: {
      truncation: "max_output" | null;
      fullOutputPath: string | null;
    };
  };
}
```

#### tool_execution_end

Emitted when a tool completes.

```typescript
{
  type: "tool_execution_end";
  toolCallId: string;
  toolName: string;
  result: RPCToolResult;
  isError: boolean;
}
```

### Compaction Events

#### auto_compaction_start

Emitted when automatic compaction begins.

```typescript
{
  type: "auto_compaction_start";
  reason: "threshold" | "overflow";
}
```

#### auto_compaction_end

Emitted when automatic compaction completes.

```typescript
{
  type: "auto_compaction_end";
  result: RPCompactionResult | null;
  aborted: boolean;
  willRetry: boolean;
}
```

### Retry Events

#### auto_retry_start

Emitted when automatic retry begins.

```typescript
{
  type: "auto_retry_start";
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  errorMessage: string;
}
```

#### auto_retry_end

Emitted when automatic retry completes.

```typescript
{
  type: "auto_retry_end";
  success: boolean;
  attempt: number;
  finalError?: string;
}
```

### Hook Events

#### hook_error

Emitted when a hook throws an error.

```typescript
{
  type: "hook_error";
  hookPath: string;
  event: string;
  error: string;
}
```

---

## Extension UI Protocol

Extensions can request UI interactions from the client. This is a request/response pattern initiated by the server.

### Extension UI Request

The server sends a request for UI interaction:

```typescript
// Select dropdown
{
  type: "extension_ui_request";
  id: string;  // Unique ID for correlation
  method: "select";
  title: string;
  options: string[];
  timeout?: number;  // milliseconds
}

// Confirm dialog
{
  type: "extension_ui_request";
  id: string;
  method: "confirm";
  title: string;
  message: string;
  timeout?: number;
}

// Text input
{
  type: "extension_ui_request";
  id: string;
  method: "input";
  title: string;
  placeholder?: string;
  timeout?: number;
}

// Editor (multi-line)
{
  type: "extension_ui_request";
  id: string;
  method: "editor";
  title: string;
  prefill?: string;
}

// Notification
{
  type: "extension_ui_request";
  id: string;
  method: "notify";
  message: string;
  notifyType?: "info" | "warning" | "error";
}

// Status bar
{
  type: "extension_ui_request";
  id: string;
  method: "setStatus";
  statusKey: string;
  statusText: string | undefined;
}

// Widget
{
  type: "extension_ui_request";
  id: string;
  method: "setWidget";
  widgetKey: string;
  widgetLines: string[] | undefined;
}

// Title
{
  type: "extension_ui_request";
  id: string;
  method: "setTitle";
  title: string;
}

// Editor text
{
  type: "extension_ui_request";
  id: string;
  method: "set_editor_text";
  text: string;
}
```

### Extension UI Response

The client responds to the request:

```typescript
// Value response (for select, input, editor)
{
  type: "extension_ui_response";
  id: string;  // Matches request ID
  value: string;
}

// Confirm response
{
  type: "extension_ui_response";
  id: string;
  confirmed: boolean;
}

// Cancelled (timeout or user cancelled)
{
  type: "extension_ui_response";
  id: string;
  cancelled: true;
}
```

---

## Error Handling

### Error Response Format

All failed commands use this format:

```typescript
{
  type: "response";
  command: string;    // The command that failed
  success: false;
  id?: string;        // Matches request ID if provided
  error: string;      // Human-readable error message
}
```

### Common Errors

| Error | When it occurs | Recommended action |
|-------|----------------|-------------------|
| `Invalid authentication token` | Token is invalid or expired | Client should prompt for new token |
| `Session not found` | Session path doesn't exist | Offer to create new session or list available |
| `Model not found` | Provider/modelId combination invalid | Use `get_available_models` to list valid options |
| `Permission denied` | Token doesn't have required permissions | Inform user and suggest contacting admin |
| `Command not supported` | Command not implemented | Document unsupported commands |
| `Invalid parameters` | Command has malformed parameters | Validate client input before sending |
| `Agent is already running` | Prompt sent while agent streaming | Wait for `agent_end` before sending next prompt |
| `No active agent to abort` | `abort` sent when agent not running | Ignore or check state first |

### Connection Errors

WebSocket-level errors should be reported via `server_error` events:

```typescript
{
  type: "server_error";
  error: "Failed to spawn Pi process: command not found"
}
```

**Close codes:**
- `1000`: Normal closure
- `1008`: Policy violation (invalid auth token)
- `1011`: Internal error (server crashed)

---

## Connection Management

### Reconnection Strategy

Clients implement exponential backoff reconnection:

```typescript
interface ReconnectionConfig {
  maxRetries: number;        // Default: 5
  initialDelayMs: number;    // Default: 1000
  maxDelayMs: number;        // Default: 30000
  backoffMultiplier: number; // Default: 2
}
```

**Reconnection flow:**

1. Client detects disconnection
2. Show "Reconnecting..." UI
3. Calculate delay: `min(initialDelayMs * multiplier^attempt, maxDelayMs)`
4. Attempt reconnection
5. On success: sync state via `get_state` + `get_messages`
6. On failure: increment attempt, repeat up to `maxRetries`
7. After max retries: show "Connection Lost" with manual retry button

### State Synchronization

After reconnection, client should:

```typescript
// 1. Get current state
const state = await sendCommand({ type: 'get_state' });

// 2. Get all messages
const messages = await sendCommand({ type: 'get_messages' });

// 3. Update local state
model = state.data.model;
thinkingLevel = state.data.thinkingLevel;
isStreaming = state.data.isStreaming;
allMessages = messages.data.messages;
```

Server should also emit a state synced event:

```typescript
{
  type: 'state_synced',
  state: RpcSessionState,
  messages: AgentMessage[]
}
```

---

## Example Implementation

### Reference Implementation

The reference implementation is in `packages/coding-agent/src/modes/rpc/`:

- **`rpc-types.ts`**: Complete type definitions for commands, responses, and events
- **`rpc-mode.ts`**: RPC mode implementation (stdin/stdout protocol)
- **`rpc-client.ts`**: Client library for embedding Pi in other applications

### Simple WebSocket Server (Node.js)

```typescript
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { readline } from 'readline';

// Configuration
const PORT = 3000;
const AUTH_TOKEN = process.env.PI_AUTH_TOKEN || 'your-secret-token';

// Create WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server listening on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const sessionPath = url.searchParams.get('session');
  const cwd = url.searchParams.get('cwd') || process.cwd();

  // Validate authentication
  if (token !== AUTH_TOKEN) {
    ws.close(1008, 'Invalid authentication token');
    return;
  }

  console.log(`Client connected. Session: ${sessionPath || '(new)'}, CWD: ${cwd}`);

  // Spawn Pi process
  const piArgs = ['--mode', 'rpc'];
  if (sessionPath) {
    piArgs.push('--session', sessionPath);
  }

  const pi = spawn('pi', piArgs, {
    cwd,
    stdio: ['pipe', 'pipe', 'inherit']
  });

  // Read Pi's stdout line by line
  const piStdout = readline.createInterface({
    input: pi.stdout,
    crlfDelay: Infinity
  });

  // Forward Pi events to WebSocket
  piStdout.on('line', (line) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(line);
    }
  });

  // Forward WebSocket commands to Pi
  ws.on('message', (data) => {
    if (pi.stdin.writable) {
      pi.stdin.write(data.toString() + '\n');
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
    pi.kill('SIGTERM');
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    ws.send(JSON.stringify({
      type: 'server_error',
      error: error.message
    }));
  });

  pi.on('error', (error) => {
    console.error('Pi process error:', error);
    ws.send(JSON.stringify({
      type: 'server_error',
      error: `Pi process error: ${error.message}`
    }));
    ws.close();
  });

  pi.on('exit', (code, signal) => {
    console.log(`Pi process exited: ${code} (${signal})`);
    if (ws.readyState === ws.OPEN) {
      ws.close(1011, 'Pi process terminated');
    }
  });

  // Send connected event
  ws.send(JSON.stringify({
    type: 'server_connected',
    sessionFile: sessionPath || 'new',
    sessionId: crypto.randomUUID()
  }));
});
```

### Client Connection Example (Browser)

```typescript
import { WebSocketClient } from './WebSocketClient';
import { RPCClient } from './RPCClient';
import type { RPCCommandWithoutId, RPCEvent } from './rpc-types';

// Create WebSocket connection
const ws = new WebSocketClient('wss://server:3000/session?token=abc-123&session=/path/to/session.jsonl');

// Wrap with RPC client
const rpc = new RPCClient(ws);

// Subscribe to events
rpc.subscribe((event: RPCEvent) => {
  switch (event.type) {
    case 'agent_start':
      console.log('Agent started');
      break;
    case 'message_update':
      const { assistantMessageEvent } = event;
      if (assistantMessageEvent.type === 'text_delta') {
        process.stdout.write(assistantMessageEvent.delta);
      }
      break;
    case 'tool_execution_end':
      console.log(`Tool ${event.toolName} completed`);
      break;
  }
});

// Connect and send a prompt
ws.connect();
ws.subscribe((wsEvent) => {
  if (wsEvent.type === 'open') {
    // Connection established
    rpc.sendCommand({
      type: 'prompt',
      message: 'List all TypeScript files in src/'
    });
  }
});
```

---

## Type Definitions

### Core Types

```typescript
// AgentMessage - from @mariozechner/pi-agent-core
interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: Array<{
    type: 'text';
    text: string;
  } | {
    type: 'image';
    source: {
      type: 'base64';
      mediaType: string;
      data: string;
    };
  } | {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
  } | {
    type: 'tool_result';
    tool_use_id: string;
    content: Array<{ type: 'text'; text: string }>;
  }>;
}

// Model - from @mariozechner/pi-ai
interface Model<T = Record<string, unknown>> {
  id: string;
  provider: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  supportsImages: boolean;
  supportsTools: boolean;
  thinking?: boolean;
  metadata?: T;
}

// ThinkingLevel - from @mariozechner/pi-agent-core
type ThinkingLevel = 'off' | 'brief' | 'medium' | 'high';

// ImageContent - from @mariozechner/pi-ai
type ImageContent = {
  type: 'image';
  source: {
    type: 'base64';
    mediaType: string;
    data: string;
  };
};
```

### Supporting Types

```typescript
// Tool call
interface RPCToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// Tool result
interface RPCToolResult {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      mediaType: string;
      data: string;
    };
  }>;
  details: {
    truncation: 'max_output' | null;
    fullOutputPath: string | null;
  };
}

// Compaction result
interface RPCompactionResult {
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  details: Record<string, unknown>;
}

// Bash result
interface RPCBashResult {
  output: string;
  exitCode: number;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath: string | null;
}

// Session stats
interface RPCSessionStats {
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
```

---

## Additional Resources

- **Web UI Code**: `packages/web-ui/src/networking/`
  - `rpc-types.ts`: Complete type definitions
  - `RPCClient.ts`: Request/response correlation implementation
  - `WebSocketClient.ts`: WebSocket wrapper with reconnection
  - `RPCEventMapper.ts`: Event mapping to unified session events

- **Coding Agent Code**: `packages/coding-agent/src/modes/rpc/`
  - `rpc-types.ts`: Source RPC protocol types
  - `rpc-mode.ts`: stdin/stdout RPC mode implementation
  - `rpc-client.ts`: Embedded client library

- **Specs**: `packages/web-ui/specs/modes/remote-session-mode.md`
  - Architecture overview
  - Connection management details
  - Event mapping reference
