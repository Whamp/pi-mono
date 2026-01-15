# Sessions

Session management handles creating, loading, saving, and navigating conversation history.

## Session Types

### Browser Mode Sessions

Stored entirely in IndexedDB:

```typescript
interface BrowserSession {
  id: string;                     // UUID
  title: string;                  // Display title
  model: Model;                   // Current model configuration
  thinkingLevel: ThinkingLevel;   // Thinking level
  messages: AgentMessage[];       // Full message history
  artifacts: Artifact[];          // Associated artifacts
  createdAt: string;              // ISO timestamp
  lastModified: string;           // ISO timestamp
}

interface BrowserSessionMetadata {
  id: string;
  title: string;
  createdAt: string;
  lastModified: string;
  messageCount: number;
  preview: string;                // First message snippet (50 chars)
  modelId: string | null;
  thinkingLevel: ThinkingLevel;
}
```

### Remote Mode Sessions

Reference to server-side session files:

```typescript
interface RemoteSessionReference {
  connectionId: string;           // Connection profile ID
  sessionPath: string;            // Server-side file path
  sessionId: string;              // Session UUID
  cwd: string;                    // Working directory
  cachedTitle?: string;           // Cached title
  cachedPreview?: string;         // Cached preview
  cachedAt?: string;              // Cache timestamp
}

interface RemoteSessionCache {
  reference: RemoteSessionReference;
  messages: AgentMessage[];       // Cached for offline viewing
  model: Model | null;
  thinkingLevel: ThinkingLevel;
  cachedAt: string;
}
```

## Session Lifecycle

### New Session

**Browser Mode:**
1. Generate new UUID
2. Create empty session object
3. Set default model and thinking level
4. Display empty chat
5. First message triggers save

**Remote Mode:**
1. Send `new_session` RPC command
2. Receive new session path
3. Update URL with session reference
4. Display empty chat

### Loading a Session

**Browser Mode:**
1. Read metadata from IndexedDB
2. Load full session data
3. Reconstruct agent state
4. Display messages
5. Scroll to bottom

**Remote Mode:**
1. Establish/verify connection
2. Send `switch_session` command (or connect with session parameter)
3. Receive initial state via `get_state`
4. Receive messages via `get_messages`
5. Subscribe to events
6. Display messages

### Saving (Browser Mode)

Auto-save triggers:
- After each assistant message completes
- After user message sent (optimistic)
- On page unload (if unsaved changes)

```typescript
async function saveSession(): Promise<void> {
  const state = agent.state;
  
  // Only save if there's meaningful content
  if (!hasUserAndAssistantMessage(state.messages)) return;
  
  const session = {
    id: currentSessionId,
    title: currentTitle || generateTitle(state.messages),
    model: state.model,
    thinkingLevel: state.thinkingLevel,
    messages: state.messages,
    lastModified: new Date().toISOString(),
  };
  
  const metadata = {
    id: session.id,
    title: session.title,
    lastModified: session.lastModified,
    messageCount: session.messages.length,
    preview: generatePreview(session.messages),
    modelId: session.model?.id,
  };
  
  await storage.sessions.save(session, metadata);
}
```

### Deletion

**Browser Mode:**
1. Confirm with user
2. Delete from IndexedDB
3. Remove from session list
4. Navigate to new session (if active)

**Remote Mode:**
1. Confirm with user
2. Delete local cache only (server session preserved)
3. Optionally: Request server deletion via custom RPC

## Session URL Handling

### URL Format

```
Browser Mode:
https://app.example.com/?session=<uuid>

Remote Mode:
https://app.example.com/?connection=<connection-id>&session=<path>
```

### URL Updates

```typescript
function updateUrl(sessionId: string, connectionId?: string): void {
  const url = new URL(window.location.href);
  
  if (connectionId) {
    url.searchParams.set('connection', connectionId);
  } else {
    url.searchParams.delete('connection');
  }
  
  url.searchParams.set('session', sessionId);
  window.history.replaceState({}, '', url);
}
```

### Deep Linking

1. Parse URL on app load
2. If `connection` param: Attempt remote connection
3. Load session from URL param
4. If session not found: Show error, offer to create new

## Title Generation

Auto-generate title from first user message:

```typescript
function generateTitle(messages: AgentMessage[]): string {
  const firstUserMsg = messages.find(m => 
    m.role === 'user' || m.role === 'user-with-attachments'
  );
  
  if (!firstUserMsg) return 'New Chat';
  
  const text = extractText(firstUserMsg.content);
  
  // Find sentence end
  const sentenceEnd = text.search(/[.!?]/);
  if (sentenceEnd > 0 && sentenceEnd <= 50) {
    return text.substring(0, sentenceEnd + 1);
  }
  
  // Truncate with ellipsis
  return text.length <= 50 ? text : `${text.substring(0, 47)}...`;
}
```

## Session Branching (Remote Mode)

Pi's tree-structured sessions enable branching:

### Fork

Create a new session file from a previous point:

```typescript
async function forkSession(entryId: string): Promise<void> {
  const result = await adapter.fork(entryId);
  
  if (!result.cancelled) {
    // New session created on server
    // UI receives switch_session event
    // Original message text returned for editing
    setInputValue(result.text);
  }
}
```

### Tree Navigation

Navigate within session tree (in-place):

```typescript
async function navigateTree(targetId: string): Promise<void> {
  const result = await adapter.navigateTree(targetId, { summarize: true });
  
  if (!result.cancelled) {
    // Branch switched on server
    // UI receives updated messages
    if (result.editorText) {
      setInputValue(result.editorText);
    }
  }
}
```

### Branch Visualization (Future)

```
                    [Msg 1] ─── [Msg 2] ─── [Msg 3] ─┬─ [Msg 4] ← current
                                                     │
                                                     └─ [Branch] ─── [Msg 5]
```

## Context Compaction

When conversation gets too long:

### Manual Compaction

```typescript
async function compactSession(instructions?: string): Promise<void> {
  showToast('Compacting context...');
  
  const result = await adapter.compact(instructions);
  
  // Messages before firstKeptEntryId are summarized
  // Summary becomes first message
  showToast(`Compacted: ${result.tokensBefore} → ${result.tokensAfter} tokens`);
}
```

### Auto-Compaction

Triggered automatically when context limit approached:

```typescript
// Event handler for auto_compaction_start
session.subscribe(event => {
  if (event.type === 'compaction_start') {
    showBanner('Compacting context...', 'info');
  }
  
  if (event.type === 'compaction_end') {
    hideBanner();
    if (event.willRetry) {
      showToast('Context compacted, retrying...');
    }
  }
});
```

## Session Statistics

Display session stats:

```typescript
interface SessionStats {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: number;
  duration: number;  // Calculated from timestamps
}
```

**Display (in session info dialog or header):**
```
┌──────────────────────────────────────┐
│ Session Statistics                   │
├──────────────────────────────────────┤
│ Messages: 42 (21 you, 21 assistant)  │
│ Tool calls: 15                       │
│ Tokens: 125,432 total                │
│ Cost: $0.45                          │
│ Duration: 2h 15m                     │
└──────────────────────────────────────┘
```

## Session Export

### HTML Export

```typescript
async function exportToHtml(sessionId: string): Promise<void> {
  // Remote mode: use server export
  if (mode === 'remote') {
    const result = await adapter.exportHtml();
    downloadFile(result.path);
    return;
  }
  
  // Browser mode: generate locally
  const session = await storage.sessions.get(sessionId);
  const html = generateExportHtml(session);
  downloadBlob(html, `${session.title}.html`);
}
```

### JSON Export

```typescript
async function exportToJson(sessionId: string): Promise<void> {
  const session = await storage.sessions.get(sessionId);
  const json = JSON.stringify(session, null, 2);
  downloadBlob(json, `${session.title}.json`);
}
```

## Offline Support

### Browser Mode

Full offline support:
- All sessions cached in IndexedDB
- Can browse and view all history
- Can start new sessions (queued for sync)

### Remote Mode

Read-only offline:
- Cached sessions viewable
- Cannot send new messages
- Show "Offline" indicator
- Auto-reconnect when online

```typescript
// Cache session for offline viewing
async function cacheRemoteSession(): Promise<void> {
  const messages = await adapter.getMessages();
  const state = await adapter.getState();
  
  await storage.sessionCache.set({
    reference: currentReference,
    messages,
    model: state.model,
    thinkingLevel: state.thinkingLevel,
    cachedAt: new Date().toISOString(),
  });
}
```

## Session Sync (Future)

For multi-device support:

```typescript
interface SyncState {
  lastSyncedAt: string;
  pendingChanges: number;
  conflicts: SyncConflict[];
}

// Sync via optional cloud storage
async function syncSessions(): Promise<void> {
  const local = await storage.sessions.getAllMetadata();
  const remote = await cloudStorage.getSessions();
  
  // Merge by lastModified timestamp
  // Handle conflicts with user prompt
}
```

## Error Handling

| Error | Handling |
|-------|----------|
| Session not found | Show error, offer to create new |
| Load failed | Retry with exponential backoff |
| Save failed | Queue for retry, show warning |
| Storage quota exceeded | Prompt to delete old sessions |
| Corrupt session | Attempt recovery, offer export of raw data |
