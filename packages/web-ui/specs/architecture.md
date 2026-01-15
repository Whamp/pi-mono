# Architecture

## System Components

### Core Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                            │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐  │
│  │ Sidebar │ │  Chat   │ │ Artifacts│ │ Dialogs │ │ Input/Editor │  │
│  └─────────┘ └─────────┘ └──────────┘ └─────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Application Layer                             │
│  ┌──────────────────┐  ┌─────────────────┐  ┌───────────────────┐   │
│  │  SessionController│  │  MessageHandler │  │  ToolCoordinator  │   │
│  └──────────────────┘  └─────────────────┘  └───────────────────┘   │
│  ┌──────────────────┐  ┌─────────────────┐  ┌───────────────────┐   │
│  │  ModelManager    │  │  ArtifactManager│  │  AttachmentHandler│   │
│  └──────────────────┘  └─────────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Connection Layer                              │
│  ┌─────────────────────────┐    ┌─────────────────────────────────┐ │
│  │   BrowserModeAdapter    │    │    RemoteSessionAdapter         │ │
│  │  ┌───────────────────┐  │    │  ┌───────────────────────────┐  │ │
│  │  │ Agent (pi-agent)  │  │    │  │ WebSocketRPCClient        │  │ │
│  │  │ streamFn (pi-ai)  │  │    │  │ RPCEventMapper            │  │ │
│  │  └───────────────────┘  │    │  └───────────────────────────┘  │ │
│  └─────────────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Storage Layer                                 │
│  ┌────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ Settings   │ │ ProviderKeys │ │   Sessions   │ │ Connections  │  │
│  │ Store      │ │ Store        │ │   Store      │ │ Store        │  │
│  └────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│                      IndexedDBStorageBackend                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Presentation Layer

| Component | Responsibility |
|-----------|---------------|
| `Sidebar` | Session list, search, navigation, connection status |
| `Chat` | Message rendering, streaming display, scroll management |
| `Artifacts` | Artifact tabs, rendering, fullscreen, download |
| `Dialogs` | Modal interactions (settings, model picker, etc.) |
| `Input/Editor` | Message composition, attachments, voice input |

### Application Layer

| Component | Responsibility |
|-----------|---------------|
| `SessionController` | Session lifecycle, switching, branching, state sync |
| `MessageHandler` | Message queueing (steer/follow-up), prompt expansion |
| `ToolCoordinator` | Tool call display, streaming updates, result rendering |
| `ModelManager` | Model selection, thinking level, cycling |
| `ArtifactManager` | Artifact creation, updates, versioning |
| `AttachmentHandler` | File processing, image resizing, preview generation |

### Connection Layer

| Component | Responsibility |
|-----------|---------------|
| `BrowserModeAdapter` | Wraps `Agent` from pi-agent-core for browser-only mode |
| `RemoteSessionAdapter` | Wraps WebSocket RPC client for remote mode |
| `ConnectionInterface` | Unified interface implemented by both adapters |

### Storage Layer

| Store | Data |
|-------|------|
| `SettingsStore` | Theme, proxy config, default model, UI preferences |
| `ProviderKeysStore` | API keys per provider |
| `SessionsStore` | Browser-mode session data and metadata |
| `ConnectionsStore` | Remote server profiles (URL, name, last used) |

## Connection Interface

Both modes implement a unified interface:

```typescript
interface ConnectionAdapter {
  // State
  readonly isConnected: boolean;
  readonly isStreaming: boolean;
  readonly isCompacting: boolean;
  readonly model: Model | null;
  readonly thinkingLevel: ThinkingLevel;
  readonly messages: AgentMessage[];
  readonly sessionId: string | null;
  readonly sessionFile: string | null;

  // Events
  subscribe(listener: (event: SessionEvent) => void): () => void;

  // Prompting
  prompt(message: string, options?: PromptOptions): Promise<void>;
  steer(message: string): Promise<void>;
  followUp(message: string): Promise<void>;
  abort(): Promise<void>;

  // Model control
  setModel(provider: string, modelId: string): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): Promise<void>;
  cycleModel(): Promise<ModelCycleResult | null>;
  cycleThinkingLevel(): Promise<ThinkingLevel | null>;
  getAvailableModels(): Promise<Model[]>;

  // Session management
  newSession(): Promise<void>;
  switchSession(sessionPath: string): Promise<void>;
  getSessionStats(): Promise<SessionStats>;

  // Branching
  fork(entryId: string): Promise<{ text: string; cancelled: boolean }>;
  getForkMessages(): Promise<ForkableMessage[]>;

  // Compaction
  compact(instructions?: string): Promise<CompactionResult>;
  setAutoCompaction(enabled: boolean): Promise<void>;

  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
```

## Event Flow

### Browser Mode

```
User Input → MessageHandler → Agent.prompt() → pi-ai stream
                                    │
                                    ▼
                            Agent Events
                                    │
                                    ▼
                            SessionController
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
               Chat UI      ArtifactManager    SessionsStore
```

### Remote Session Mode

```
User Input → MessageHandler → WebSocketRPCClient.send()
                                        │
                                        ▼ (WebSocket)
                                    Pi Server
                                        │
                                        ▼ (Events)
                               WebSocketRPCClient.on()
                                        │
                                        ▼
                               RPCEventMapper
                                        │
                                        ▼
                               SessionController
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
               Chat UI          ArtifactManager     Local Cache
```

## Message Types

The UI handles all message types from both modes:

| Role | Source | Display |
|------|--------|---------|
| `user` | User input | User bubble |
| `user-with-attachments` | User + files | User bubble with previews |
| `assistant` | LLM response | Assistant bubble with content blocks |
| `toolResult` | Tool execution | Collapsible tool output |
| `bashExecution` | `!command` execution | Code block with output |
| `artifact` | Artifact ops | Hidden (shown in ArtifactsPanel) |
| `system-notification` | Custom extension | Alert banner |

## Tool Output Rendering

Tools are rendered based on `toolName`:

| Tool | Renderer |
|------|----------|
| `read` | File content with syntax highlighting |
| `bash` | Terminal output block |
| `edit` | Diff view (old → new) |
| `write` | File created notification |
| `grep` | Search results with line numbers |
| `find` | File list |
| `ls` | Directory listing |
| `javascript_repl` | Code + output + errors |
| `artifacts` | Artifact preview/link |
| `extract_document` | Extracted text summary |
| Custom | Generic JSON or registered renderer |

## State Synchronization

### Browser Mode
- State lives in `Agent` instance
- Persisted to IndexedDB after each message
- Restored on page load

### Remote Mode
- State lives on server
- UI receives state via events
- Local cache for offline viewing
- Reconnection syncs state from server

## Error Handling Strategy

| Error Type | Handling |
|------------|----------|
| Network disconnect | Show banner, auto-reconnect with backoff |
| API key invalid | Prompt for key, retry |
| Rate limit | Show countdown, auto-retry |
| Context overflow | Trigger compaction, retry |
| Tool error | Show in tool result, continue |
| Parse error | Log, show generic error |

## Security Considerations

### Browser Mode
- API keys stored in IndexedDB (encrypted at rest by browser)
- CORS proxy used for providers that don't support browser requests
- No server-side storage of credentials

### Remote Mode
- WebSocket connection uses WSS (TLS)
- Server authentication via token (stored in ConnectionsStore)
- No API keys transmitted from browser to server
- Server uses its own auth.json for LLM credentials
