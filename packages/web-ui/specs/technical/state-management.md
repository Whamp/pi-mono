# State Management

Application state architecture, persistence, and synchronization.

## Overview

Pi Web UI manages several types of state:
- **UI State**: Transient visual state (dialogs, selections)
- **Session State**: Current conversation and agent state
- **Persistent State**: Settings, sessions, connections (IndexedDB)
- **Remote State**: Server-side session state (remote mode)

## State Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      UI State                              │  │
│  │  - Dialog open states                                      │  │
│  │  - Sidebar/artifacts visibility                            │  │
│  │  - Active selections                                       │  │
│  │  - Form values                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Session State                           │  │
│  │  - Current mode (browser/remote)                          │  │
│  │  - Connection status                                       │  │
│  │  - Messages                                                │  │
│  │  - Streaming state                                         │  │
│  │  - Model/thinking level                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Persistent State                          │  │
│  │  - Settings                      ──┐                       │  │
│  │  - API keys                        │                       │  │
│  │  - Sessions (browser mode)         ├──▶ IndexedDB          │  │
│  │  - Connection profiles             │                       │  │
│  │  - Session cache                 ──┘                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Remote Mode)
┌─────────────────────────────────────────────────────────────────┐
│                       Remote State                               │
│  - Session file on server                                        │
│  - Agent state on server                                         │
│  - Tool execution state                                          │
└─────────────────────────────────────────────────────────────────┘
```

## State Definitions

### UI State

```typescript
interface UIState {
  // Layout
  sidebarOpen: boolean;
  artifactsOpen: boolean;
  activeArtifactId: string | null;
  
  // Dialogs
  activeDialog: DialogType | null;
  dialogProps: Record<string, unknown>;
  
  // Chat
  scrollPosition: 'bottom' | 'manual';
  findBarOpen: boolean;
  findQuery: string;
  findMatches: FindMatch[];
  currentFindIndex: number;
  
  // Input
  inputValue: string;
  inputAttachments: Attachment[];
  inputFocused: boolean;
  
  // Selections
  selectedMessageId: string | null;
  expandedToolCalls: Set<string>;
  expandedThinking: Set<string>;
  
  // Mobile
  activeSheet: string | null;
  contextMenuTarget: string | null;
}

type DialogType = 
  | 'settings'
  | 'model-selector'
  | 'api-key'
  | 'connection'
  | 'session-list'
  | 'confirm'
  | 'shortcuts';
```

### Session State

```typescript
interface SessionState {
  // Mode
  mode: 'browser' | 'remote';
  
  // Connection (remote mode)
  connectionId: string | null;
  connectionStatus: ConnectionStatus;
  
  // Current session
  sessionId: string | null;
  sessionPath: string | null;  // Remote mode
  sessionTitle: string;
  
  // Agent state
  model: Model | null;
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  isCompacting: boolean;
  isRetrying: boolean;
  
  // Messages
  messages: AgentMessage[];
  pendingMessage: AgentMessage | null;  // During streaming
  
  // Artifacts
  artifacts: Artifact[];
  
  // Usage
  usage: UsageStats;
}

type ConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
}
```

### Settings State

```typescript
interface SettingsState {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  fontSize: 'sm' | 'md' | 'lg';
  showTimestamps: boolean;
  collapseThinking: boolean;
  
  // Defaults
  defaultModel: string | null;
  defaultThinkingLevel: ThinkingLevel;
  
  // Behavior
  autoCompaction: boolean;
  autoRetry: boolean;
  
  // Proxy
  proxy: {
    enabled: boolean;
    url: string;
  };
}
```

## State Management Approach

### Store Pattern

```typescript
interface Store<T> {
  getState(): T;
  setState(updater: Partial<T> | ((prev: T) => Partial<T>)): void;
  subscribe(listener: (state: T) => void): () => void;
}

function createStore<T>(initialState: T): Store<T> {
  let state = initialState;
  const listeners = new Set<(state: T) => void>();
  
  return {
    getState: () => state,
    
    setState: (updater) => {
      const updates = typeof updater === 'function' 
        ? updater(state) 
        : updater;
      state = { ...state, ...updates };
      listeners.forEach(listener => listener(state));
    },
    
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

### React Integration

```typescript
function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  const [selected, setSelected] = useState(() => selector(store.getState()));
  
  useEffect(() => {
    return store.subscribe((state) => {
      const next = selector(state);
      if (!shallowEqual(selected, next)) {
        setSelected(next);
      }
    });
  }, [store, selector]);
  
  return selected;
}

// Usage
const messages = useStore(sessionStore, s => s.messages);
const isStreaming = useStore(sessionStore, s => s.isStreaming);
```

## State Initialization

### App Bootstrap

```typescript
async function initializeApp(): Promise<void> {
  // 1. Initialize storage
  const db = await initDatabase();
  const storage = createStorageService(db);
  
  // 2. Load settings
  const settings = await storage.settings.get();
  settingsStore.setState(settings);
  
  // 3. Apply theme
  applyTheme(settings.theme);
  
  // 4. Check URL for session/connection
  const urlParams = parseUrlParams();
  
  // 5. Initialize session
  if (urlParams.connection) {
    // Remote mode: Connect to server
    await initRemoteMode(urlParams.connection, urlParams.session);
  } else if (urlParams.session) {
    // Browser mode: Load session
    await initBrowserMode(urlParams.session);
  } else {
    // New session
    await initBrowserMode(null);
  }
}
```

### Browser Mode Initialization

```typescript
async function initBrowserMode(sessionId: string | null): Promise<void> {
  sessionStore.setState({ mode: 'browser' });
  
  if (sessionId) {
    // Load existing session
    const session = await storage.sessions.get(sessionId);
    if (session) {
      sessionStore.setState({
        sessionId: session.id,
        sessionTitle: session.title,
        messages: session.messages,
        model: session.model,
        thinkingLevel: session.thinkingLevel,
        artifacts: session.artifacts,
      });
      return;
    }
    // Session not found, fall through to create new
  }
  
  // Create new session
  const newSession = createNewSession();
  sessionStore.setState({
    sessionId: newSession.id,
    sessionTitle: newSession.title,
    messages: [],
    model: getDefaultModel(),
    thinkingLevel: settingsStore.getState().defaultThinkingLevel,
    artifacts: [],
  });
}
```

### Remote Mode Initialization

```typescript
async function initRemoteMode(
  connectionId: string, 
  sessionPath: string | null
): Promise<void> {
  sessionStore.setState({ 
    mode: 'remote',
    connectionId,
    connectionStatus: 'connecting',
  });
  
  // Get connection profile
  const connection = await storage.connections.get(connectionId);
  if (!connection) {
    sessionStore.setState({ connectionStatus: 'error' });
    showError('Connection profile not found');
    return;
  }
  
  try {
    // Connect to server
    await wsManager.connect({
      url: connection.url,
      token: connection.token,
      sessionPath,
    });
    
    sessionStore.setState({ connectionStatus: 'connected' });
    
    // Fetch initial state
    await syncRemoteState();
  } catch (error) {
    sessionStore.setState({ connectionStatus: 'error' });
    showError('Failed to connect');
  }
}
```

## State Synchronization

### Browser Mode Persistence

```typescript
// Auto-save after each assistant message
sessionStore.subscribe(async (state) => {
  if (state.mode !== 'browser') return;
  if (!state.sessionId) return;
  if (state.isStreaming) return;  // Wait for completion
  
  const session = {
    id: state.sessionId,
    title: state.sessionTitle,
    model: state.model,
    thinkingLevel: state.thinkingLevel,
    messages: state.messages,
    artifacts: state.artifacts,
    lastModified: new Date().toISOString(),
  };
  
  await storage.sessions.save(session);
});
```

### Remote Mode Sync

```typescript
// Sync state from server after reconnection
async function syncRemoteState(): Promise<void> {
  const [stateResponse, messagesResponse] = await Promise.all([
    wsManager.send({ type: 'get_state' }),
    wsManager.send({ type: 'get_messages' }),
  ]);
  
  sessionStore.setState({
    sessionId: stateResponse.data.sessionId,
    sessionPath: stateResponse.data.sessionFile,
    sessionTitle: generateTitle(messagesResponse.data.messages),
    model: stateResponse.data.model,
    thinkingLevel: stateResponse.data.thinkingLevel,
    isStreaming: stateResponse.data.isStreaming,
    messages: messagesResponse.data.messages,
  });
  
  // Cache for offline viewing
  await cacheRemoteSession();
}
```

### Event Handling

```typescript
// Handle events from remote server
wsManager.on('event', (event: RPCEvent) => {
  switch (event.type) {
    case 'agent_start':
      sessionStore.setState({ isStreaming: true });
      break;
      
    case 'agent_end':
      sessionStore.setState({ 
        isStreaming: false,
        messages: event.messages,
      });
      break;
      
    case 'message_update':
      handleMessageUpdate(event);
      break;
      
    case 'tool_execution_update':
      handleToolUpdate(event);
      break;
      
    case 'auto_compaction_start':
      sessionStore.setState({ isCompacting: true });
      break;
      
    case 'auto_compaction_end':
      sessionStore.setState({ isCompacting: false });
      break;
  }
});
```

## Action Handlers

### Message Actions

```typescript
const sessionActions = {
  async sendMessage(content: string, attachments: Attachment[]): Promise<void> {
    const state = sessionStore.getState();
    
    if (state.mode === 'browser') {
      await browserAdapter.prompt(content, attachments);
    } else {
      await wsManager.send({
        type: 'prompt',
        content: buildContent(content, attachments),
      });
    }
  },
  
  async steer(content: string): Promise<void> {
    const state = sessionStore.getState();
    
    if (state.mode === 'browser') {
      await browserAdapter.steer(content);
    } else {
      await wsManager.send({ type: 'steer', message: content });
    }
    
    toast.info('Message queued (will interrupt)');
  },
  
  async abort(): Promise<void> {
    const state = sessionStore.getState();
    
    if (state.mode === 'browser') {
      await browserAdapter.abort();
    } else {
      await wsManager.send({ type: 'abort' });
    }
  },
};
```

### Model Actions

```typescript
const modelActions = {
  async setModel(provider: string, modelId: string): Promise<void> {
    const state = sessionStore.getState();
    
    if (state.mode === 'browser') {
      const model = getModelById(modelId);
      sessionStore.setState({ model });
    } else {
      await wsManager.send({ type: 'set_model', provider, modelId });
      // State updated via event
    }
    
    toast.success(`Model: ${getModelName(modelId)}`);
  },
  
  async setThinkingLevel(level: ThinkingLevel): Promise<void> {
    const state = sessionStore.getState();
    
    if (state.mode === 'browser') {
      sessionStore.setState({ thinkingLevel: level });
    } else {
      await wsManager.send({ type: 'set_thinking_level', level });
    }
    
    toast.success(`Thinking: ${level}`);
  },
  
  async cycleModel(): Promise<void> {
    const state = sessionStore.getState();
    
    if (state.mode === 'browser') {
      const nextModel = getNextModelInCycle(state.model);
      sessionStore.setState({ model: nextModel });
      toast.success(`Model: ${nextModel.name}`);
    } else {
      const result = await wsManager.send({ type: 'cycle_model' });
      toast.success(`Model: ${result.data.model.name}`);
    }
  },
};
```

## Derived State

### Computed Values

```typescript
const selectors = {
  canSend: (state: SessionState): boolean => {
    return !state.isStreaming && 
           !state.isCompacting &&
           (state.mode === 'browser' || state.connectionStatus === 'connected');
  },
  
  hasApiKey: (state: SessionState, provider: string): boolean => {
    const keys = storage.providerKeys.getAll();
    return keys.some(k => k.provider === provider);
  },
  
  availableModels: (state: SessionState): Model[] => {
    if (state.mode === 'remote') {
      return remoteModels;  // Fetched from server
    }
    
    // Filter by available API keys
    return allModels.filter(m => selectors.hasApiKey(state, m.provider));
  },
  
  totalTokens: (state: SessionState): number => {
    return state.usage.inputTokens + state.usage.outputTokens;
  },
  
  estimatedCost: (state: SessionState): number => {
    return state.usage.cost;
  },
};
```

### Memoized Selectors

```typescript
const createMemoizedSelector = <T, S>(
  selector: (state: T) => S,
  equalityFn: (a: S, b: S) => boolean = shallowEqual
): (state: T) => S => {
  let lastState: T | undefined;
  let lastResult: S | undefined;
  
  return (state: T): S => {
    if (lastState !== undefined && state === lastState) {
      return lastResult!;
    }
    
    const result = selector(state);
    
    if (lastResult !== undefined && equalityFn(result, lastResult)) {
      return lastResult;
    }
    
    lastState = state;
    lastResult = result;
    return result;
  };
};

// Usage
const selectMessages = createMemoizedSelector(
  (state: SessionState) => state.messages,
  (a, b) => a.length === b.length && a.every((m, i) => m.id === b[i].id)
);
```

## State Debugging

### Development Tools

```typescript
// Enable state logging in development
if (process.env.NODE_ENV === 'development') {
  sessionStore.subscribe((state) => {
    console.log('[Session State]', state);
  });
  
  uiStore.subscribe((state) => {
    console.log('[UI State]', state);
  });
}
```

### State Inspection

```typescript
// Expose stores for debugging
if (process.env.NODE_ENV === 'development') {
  (window as any).__PI_STORES__ = {
    session: sessionStore,
    ui: uiStore,
    settings: settingsStore,
  };
}
```

## Error Recovery

### State Reset

```typescript
function resetSessionState(): void {
  sessionStore.setState({
    mode: 'browser',
    connectionId: null,
    connectionStatus: 'disconnected',
    sessionId: null,
    sessionPath: null,
    sessionTitle: 'New Chat',
    model: getDefaultModel(),
    thinkingLevel: settingsStore.getState().defaultThinkingLevel,
    isStreaming: false,
    isCompacting: false,
    isRetrying: false,
    messages: [],
    pendingMessage: null,
    artifacts: [],
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 },
  });
}
```

### Recovery from Corrupt State

```typescript
function validateAndRecoverState(state: SessionState): SessionState {
  // Validate messages
  const validMessages = state.messages.filter(m => 
    m && m.id && m.role && m.content
  );
  
  // Validate model
  const validModel = state.model && isValidModel(state.model)
    ? state.model
    : getDefaultModel();
  
  return {
    ...state,
    messages: validMessages,
    model: validModel,
    // Reset streaming flags if they're stuck
    isStreaming: false,
    isCompacting: false,
    isRetrying: false,
  };
}
```
