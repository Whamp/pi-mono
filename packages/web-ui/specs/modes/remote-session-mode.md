# Remote Session Mode

Remote session mode enables connecting to an existing Pi terminal session running on a server. This is the key feature that differentiates Pi Web UI from other chat interfaces—the ability to resume and interact with sessions that have full tool access (file system, bash, etc.).

## Overview

In remote mode:
- Pi runs on a server with `--mode rpc` (wrapped in a WebSocket server)
- The web UI connects via WebSocket
- All tool execution happens on the server
- The UI renders events streamed from the server

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                              Browser                                  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    RemoteSessionAdapter                         │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  WebSocketRPCClient                                       │  │  │
│  │  │  - Connection management (connect, reconnect, disconnect) │  │  │
│  │  │  - Command serialization (JSON)                           │  │  │
│  │  │  - Event deserialization                                  │  │  │
│  │  │  - Request/response correlation (via id)                  │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  RPCEventMapper                                           │  │  │
│  │  │  - Maps RPC events to unified SessionEvent                │  │  │
│  │  │  - Handles streaming deltas                               │  │  │
│  │  │  - Accumulates partial messages                           │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Local Cache                                              │  │  │
│  │  │  - Session snapshots for offline viewing                  │  │  │
│  │  │  - Connection profiles                                    │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket (wss://)
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           Pi Server                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  WebSocket Server (wrapper)                                     │  │
│  │  - Accepts WebSocket connections                                │  │
│  │  - Authenticates with token                                     │  │
│  │  - Spawns or attaches to pi process                            │  │
│  │  - Proxies stdin/stdout ↔ WebSocket                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                    │                                  │
│                                    ▼                                  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  pi --mode rpc --session /path/to/session.jsonl                │  │
│  │  - Full Pi capabilities                                        │  │
│  │  - All tools (read, bash, edit, write)                         │  │
│  │  - Extensions                                                   │  │
│  │  - Skills                                                       │  │
│  │  - Project context (AGENTS.md)                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Server Component

A lightweight WebSocket server is required to bridge the browser to Pi's RPC mode. This server:

1. Accepts WebSocket connections
2. Authenticates clients (token-based)
3. Manages Pi process lifecycle
4. Proxies JSON commands/events between WebSocket and Pi stdin/stdout

### Server API

```typescript
// Connection URL format
wss://<host>:<port>/session?token=<auth_token>&session=<session_path>

// Query parameters
interface ConnectionParams {
  token: string;              // Authentication token
  session?: string;           // Session file path (optional, creates new if omitted)
  cwd?: string;               // Working directory for new sessions
}
```

### Server Events

The server forwards all Pi RPC events plus connection-level events:

```typescript
// Server-specific events
interface ServerConnectedEvent {
  type: 'server_connected';
  sessionFile: string;
  sessionId: string;
}

interface ServerDisconnectedEvent {
  type: 'server_disconnected';
  reason: 'error' | 'close' | 'timeout';
  message?: string;
}

interface ServerErrorEvent {
  type: 'server_error';
  error: string;
}
```

## Connection Profiles

Users can save connection profiles for quick access:

```typescript
interface ConnectionProfile {
  id: string;                // UUID
  name: string;              // Display name (e.g., "Work Laptop")
  url: string;               // WebSocket URL (wss://...)
  token: string;             // Auth token (stored securely)
  lastUsed: string;          // ISO timestamp
  lastSessionPath?: string;  // Last used session path
}
```

Stored in `ConnectionsStore` (IndexedDB).

## RPC Command Mapping

The adapter maps UI actions to RPC commands:

| UI Action | RPC Command |
|-----------|-------------|
| Send message | `prompt` |
| Send during streaming | `prompt` with `streamingBehavior` |
| Queue steering message | `steer` |
| Queue follow-up | `follow_up` |
| Abort | `abort` |
| Change model | `set_model` |
| Change thinking | `set_thinking_level` |
| Cycle model | `cycle_model` |
| Cycle thinking | `cycle_thinking_level` |
| New session | `new_session` |
| Load session | `switch_session` |
| Get messages | `get_messages` |
| Get state | `get_state` |
| Get stats | `get_session_stats` |
| Fork | `fork` |
| Get fork points | `get_fork_messages` |
| Compact | `compact` |
| Set auto-compact | `set_auto_compaction` |
| Run bash | `bash` |
| Abort bash | `abort_bash` |
| Export HTML | `export_html` |

## Event Mapping

RPC events are mapped to unified `SessionEvent`:

| RPC Event | SessionEvent |
|-----------|--------------|
| `agent_start` | `session_start` |
| `agent_end` | `session_end` with messages |
| `message_start` | `message_start` |
| `message_update` | `message_update` with delta |
| `message_end` | `message_end` |
| `turn_start` | `turn_start` |
| `turn_end` | `turn_end` with message + tool results |
| `tool_execution_start` | `tool_start` |
| `tool_execution_update` | `tool_update` |
| `tool_execution_end` | `tool_end` |
| `auto_compaction_start` | `compaction_start` |
| `auto_compaction_end` | `compaction_end` |
| `auto_retry_start` | `retry_start` |
| `auto_retry_end` | `retry_end` |
| `hook_error` | `extension_error` |

## Streaming Message Updates

The adapter accumulates streaming deltas to maintain current message state:

```typescript
class RPCEventMapper {
  private currentMessage: AgentMessage | null = null;
  private currentToolCalls: Map<string, ToolCall> = new Map();

  handleEvent(rpcEvent: RPCEvent): SessionEvent[] {
    switch (rpcEvent.type) {
      case 'message_update':
        const delta = rpcEvent.assistantMessageEvent;
        switch (delta.type) {
          case 'text_delta':
            this.appendText(delta.contentIndex, delta.delta);
            break;
          case 'thinking_delta':
            this.appendThinking(delta.contentIndex, delta.delta);
            break;
          case 'toolcall_delta':
            this.appendToolCallArgs(delta.contentIndex, delta.delta);
            break;
          case 'toolcall_end':
            this.finalizeToolCall(delta.contentIndex, delta.toolCall);
            break;
        }
        return [{ type: 'message_update', message: this.currentMessage, delta }];
      // ... other cases
    }
  }
}
```

## Connection Management

### Connection States

```
┌─────────────┐     connect()     ┌──────────────┐
│ Disconnected│ ─────────────────▶│ Connecting   │
└─────────────┘                   └──────────────┘
       ▲                                 │
       │                                 ▼
       │                          ┌──────────────┐
       │   error/close            │  Connected   │
       └──────────────────────────└──────────────┘
       │                                 │
       │                                 │ network error
       │                                 ▼
       │                          ┌──────────────┐
       └──────────────────────────│ Reconnecting │
           max retries            └──────────────┘
```

### Reconnection Strategy

```typescript
interface ReconnectionConfig {
  maxRetries: number;        // Default: 5
  initialDelayMs: number;    // Default: 1000
  maxDelayMs: number;        // Default: 30000
  backoffMultiplier: number; // Default: 2
}
```

On disconnect:
1. Show "Reconnecting..." banner
2. Attempt reconnection with exponential backoff
3. On success: sync state via `get_state` + `get_messages`
4. On failure after max retries: show "Connection Lost" with manual retry button

### State Synchronization

After reconnection:

```typescript
async syncState(): Promise<void> {
  // 1. Get current state
  const state = await this.sendCommand({ type: 'get_state' });
  
  // 2. Get all messages
  const messages = await this.sendCommand({ type: 'get_messages' });
  
  // 3. Update local state
  this.model = state.data.model;
  this.thinkingLevel = state.data.thinkingLevel;
  this.isStreaming = state.data.isStreaming;
  this.messages = messages.data.messages;
  
  // 4. Emit state_synced event
  this.emit({ type: 'state_synced', state, messages });
}
```

## Local Caching

For offline viewing and faster initial load:

```typescript
interface CachedSession {
  connectionId: string;      // Connection profile ID
  sessionPath: string;       // Server-side path
  messages: AgentMessage[];  // Cached messages
  model: Model | null;
  thinkingLevel: ThinkingLevel;
  cachedAt: string;          // ISO timestamp
}
```

**Cache invalidation:**
- On connect: compare server message count with cache
- If different: fetch fresh messages
- If same: use cache, verify with checksums in background

## Authentication

### Token-Based Auth

Simple bearer token authentication:

```typescript
// Server validates token on connection
wss://server:port/session?token=abc123&session=/path/to/session.jsonl

// Token is stored in ConnectionProfile
// Token generation/management is server-side (out of scope for web UI)
```

### Future: OAuth Integration

Potential future enhancement:
- OAuth flow for server authentication
- Refresh token handling
- Multi-user server support

## Error Handling

| Error | UI Response |
|-------|-------------|
| Connection refused | Show error, offer retry |
| Auth failed (401) | Prompt for new token |
| Session not found | Offer to create new or list available |
| Pi process crashed | Show error, offer restart |
| Network timeout | Retry with backoff |
| Rate limit (429) | Show countdown, auto-retry |
| Server error (5xx) | Show error, offer retry |

## Tool Output Handling

Tool outputs are streamed from the server:

```typescript
// tool_execution_update contains accumulated output
{
  type: 'tool_execution_update',
  toolCallId: 'call_123',
  toolName: 'bash',
  args: { command: 'npm test' },
  partialResult: {
    content: [{ type: 'text', text: 'Running tests...\n✓ test 1' }],
    details: { truncation: null, fullOutputPath: null }
  }
}
```

The UI updates the tool output display on each `tool_execution_update`, showing the latest `partialResult.content`.

## Image Handling

Images in tool results (e.g., screenshots from read tool) are base64 encoded:

```typescript
{
  type: 'image',
  source: {
    type: 'base64',
    mediaType: 'image/png',
    data: '...'
  }
}
```

The UI renders these inline or in a lightbox view.

## Session Listing

To list available sessions on the server:

```typescript
// Custom RPC command (requires server implementation)
{ type: 'list_sessions', cwd?: string }

// Response
{
  type: 'response',
  command: 'list_sessions',
  success: true,
  data: {
    sessions: [
      {
        path: '/path/to/session.jsonl',
        id: 'abc123',
        firstMessage: 'Refactor the auth module...',
        messageCount: 42,
        lastModified: '2024-01-15T10:30:00Z',
        cwd: '/home/user/project'
      }
    ]
  }
}
```

## Limitations

| Limitation | Reason |
|------------|--------|
| No local tool execution | Tools run on server |
| Server required | Can't work fully offline |
| Latency | Additional network hop |
| No direct file access | Files are on server |
| Session tied to server | Can't transfer sessions between servers |
