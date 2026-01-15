# Orchestration Plan: Production Web UI for LLM Chat

**Created**: 2026-01-14
**Objective**: Transform the existing packages/web-ui/example demo app into a production-quality web UI for chatting with LLMs, implementing the features specified in packages/web-ui/specs/
**Baseline checks**: `npm run check` (biome lint + TypeScript)

## Scope & Features

Based on the comprehensive specs in `packages/web-ui/specs/`, the target features are:

### Core Features (Phase 1) ✅ Complete
- [x] Streaming responses with markdown rendering (existing)
- [x] Code syntax highlighting (existing)
- [x] Tool/function calling display (existing)
- [x] Thinking/reasoning display (existing)
- [x] Model selection (existing)
- [x] File/image attachments (existing)
- [x] Basic session persistence (existing)

### Session Management (Phase 2) ✅ Complete
- [x] Sidebar with session list (grouped by date)
- [x] Session search/filter
- [x] Session rename (inline editing)
- [x] Session delete with confirmation
- [x] Session export (JSON)
- [x] Improved session metadata (usage tracking)

### Layout & Navigation (Phase 3) ✅ Complete
- [x] Responsive 3-panel layout (sidebar, chat, artifacts)
- [x] Collapsible sidebar with drawer mode on mobile/tablet
- [x] Header with session title and controls
- [x] Artifacts panel with overlay mode on mobile
- [x] Proper safe area handling for mobile

### Mobile Experience (Phase 4) ✅ Complete
- [x] Touch-optimized interactions
- [x] Swipe gestures (sidebar open/close, session delete)
- [x] Keyboard avoidance
- [x] Safe area insets

### Polish & UX (Phase 5) ✅ Complete
- [x] Keyboard shortcuts
- [x] Toast notifications
- [x] Loading skeletons
- [x] Empty states
- [x] Error handling UI
- [x] Settings preferences

### Browser Compatibility (Phase 6) ✅ Complete
- [x] Fix pi-ai Node.js module usage for browser
- [x] Add accessible labels to icon buttons

### Advanced Search (Phase 7) ✅ Complete
- [x] In-conversation search (Cmd+F find bar)
- [x] Advanced search filters (date, type, model)
- [x] Search result highlighting
- [x] Search result navigation

### Advanced Artifacts (Phase 8) ✅ Complete
- [x] Artifact version history
- [x] Artifact fullscreen mode
- [x] JSON viewer with collapsible nodes

### Session Enhancements (Phase 9) ✅ Complete
- [x] Session statistics display
- [x] HTML export for sessions
- [x] Session info dialog

### Advanced Keyboard Shortcuts (Phase 10) ✅ Complete
- [x] Keyboard shortcuts help dialog (Cmd+/)
- [x] Context-aware shortcuts (sidebar, chat, artifacts)
- [x] Copy last response shortcut
- [x] Scroll shortcuts

### Mobile Enhancements (Phase 11) ✅ Complete
- [x] Bottom sheet for actions on mobile
- [x] Pull-to-refresh for session list
- [x] Gesture-based artifact navigation

### Advanced Notifications (Phase 12) ✅ Complete
- [x] Banner notifications for persistent alerts
- [x] Connection status indicator
- [x] Rate limit countdown display
- [x] Context overflow warning

### Remote Session Mode (Phase 13) 🔧 In Progress
- [ ] RPC types and interfaces
- [ ] WebSocket client with reconnection
- [ ] RPC event mapping
- [ ] Connection profiles storage and UI
- [ ] Remote session adapter
- [ ] Enhanced connection status
- [ ] Remote sessions dialog
- [ ] Session caching
- [ ] Compaction and fork UI
- [ ] Server documentation

### Offline Support (Phase 14) 📋 Planned
- [ ] Service worker for asset caching
- [ ] Offline queue for pending messages
- [ ] Offline indicator
- [ ] Background sync on reconnect

### Data Management (Phase 15) 📋 Planned
- [ ] Storage quota management UI
- [ ] Import/export all data
- [ ] Storage cleanup tools
- [ ] Session migration on version upgrades

---

## Phase 1: Foundation Setup ✅ Complete

### Prerequisites
The example app already has working:
- ChatPanel, AgentInterface components
- MessageEditor, MessageList components
- IndexedDB storage (SessionsStore, SettingsStore, ProviderKeysStore)
- Tool renderers and artifacts panel
- Model selector dialog

---

## Task List

### Phase 2: Session Management ✅ Complete

- [x] **Task 1**: Create Sidebar component shell
- [x] **Task 2**: Create SessionItem sub-component
- [x] **Task 3**: Implement date grouping for session list
- [x] **Task 4**: Implement sidebar search
- [x] **Task 5**: Add session context menu
- [x] **Task 6**: Implement inline session rename
- [x] **Task 7**: Add session export
- [x] **Task 8**: Enhance session metadata tracking

### Phase 3: Layout & Navigation ✅ Complete

- [x] **Task 9**: Create AppLayout component
- [x] **Task 10**: Implement sidebar drawer mode
- [x] **Task 11**: Create Header component
- [x] **Task 12**: Integrate artifacts panel in layout
- [x] **Task 13**: Refactor example app to use new layout
- [x] **Task 14**: Add safe area handling for mobile

### Phase 4: Mobile Experience ✅ Complete

- [x] **Task 15**: Add swipe gesture for sidebar
- [x] **Task 16**: Add swipe-to-delete for sessions
- [x] **Task 17**: Optimize touch targets
- [x] **Task 18**: Handle virtual keyboard

### Phase 5: Polish & UX ✅ Complete

- [x] **Task 19**: Create Toast notification component
- [x] **Task 20**: Add loading skeletons
- [x] **Task 21**: Add empty states
- [x] **Task 22**: Implement keyboard shortcuts
- [x] **Task 23**: Improve error handling UI
- [x] **Task 24**: Add settings preferences
- [x] **Task 25**: Final polish and cleanup
- [x] **Task 26**: Update package exports

---

## Phase 6: Browser Compatibility & Fixes ✅ Complete

These issues were discovered during manual testing (2026-01-14):

- [x] **Task 27**: Fix pi-ai browser compatibility ✅ COMPLETED 2026-01-14
  - **Files**: `packages/ai/README.md`
  - **Description**: Documented browser bundler configuration for using pi-ai in browsers. Added Vite config example and stub file implementations.
  - **Verification**: `npm run check` passes, README has clear documentation
  - **Notes**: Approach: document required bundler configuration rather than modifying ai package internals. Providers google-gemini-cli and openai-codex require Node.js and don't work in browsers.

- [x] **Task 28**: Add accessible labels to icon buttons ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/components/Header.ts`, `packages/web-ui/example/src/main.ts`
  - **Description**: Theme toggle and other icon-only buttons lack accessible labels. Add `aria-label` or `title` attributes to all icon buttons.
  - **Verification**: All buttons show labels in accessibility tree (`surf read`)
  - **Regression check**: `npm run check` passes
  - **Notes**: Added aria-labels to ConsoleBlock, AttachmentTile, MessageEditor, SessionListDialog. Most buttons already had labels. mini-lit Button component limitation noted (uses title, not aria-label).

---

## Phase 7: Advanced Search ✅ Complete (specs/features/search.md)

- [x] **Task 29**: Implement in-conversation search (Cmd+F) ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/components/FindBar.ts`, `packages/web-ui/src/components/AgentInterface.ts`
  - **Description**: Added find bar for searching within current conversation. Supports Cmd/Ctrl+F, Enter/Shift+Enter navigation, case-sensitive and regex toggles.
  - **Verification**: Cmd+F opens find bar, matches highlighted, navigation works
  - **Regression check**: `npm run check` passes

- [x] **Task 30**: Enhance sidebar search with advanced filters ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`, `packages/web-ui/src/components/SearchFilters.ts`
  - **Description**: Added filter dropdowns for date range (Today, Last 7 Days, Last 30 Days, All time) and model. Includes filter toggle button, active filter chips, and dynamic model list from session metadata.
  - **Verification**: Filters narrow search results correctly
  - **Regression check**: `npm run check` passes

- [x] **Task 31**: Add search result highlighting ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/utils/search-utils.ts`, `packages/web-ui/src/components/MessageList.ts`
  - **Description**: Implemented DOM-based highlighting using TreeWalker. Current match emphasized with outline, other matches have yellow background. CSS variables added to app.css.
  - **Verification**: Matches visible with yellow highlight, current match has border
  - **Regression check**: `npm run check` passes

- [x] **Task 32**: Add search result navigation ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/components/FindBar.ts`
  - **Description**: Added scroll-to-match behavior in MessageList. When navigating matches, view scrolls smoothly to center the current match. F3/Shift+F3 shortcuts work.
  - **Verification**: Can navigate between all matches with keyboard
  - **Regression check**: `npm run check` passes

---

## Phase 8: Advanced Artifacts ✅ Complete (specs/ui/artifacts.md)

- [x] **Task 33**: Add artifact version history ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/tools/artifacts/artifacts.ts`
  - **Description**: Extended Artifact interface with versions array. Updates push new versions. Added version dropdown in footer to view previous versions.
  - **Verification**: Can view previous artifact versions via dropdown
  - **Regression check**: `npm run check` passes

- [x] **Task 34**: Add artifact fullscreen mode ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/tools/artifacts/artifacts.ts`, `packages/web-ui/src/tools/artifacts/FullscreenArtifact.ts`
  - **Description**: Added fullscreen overlay with prev/next navigation. Entry via button or double-click, exit via Escape or close button.
  - **Verification**: Double-click or button enters fullscreen, Escape exits
  - **Regression check**: `npm run check` passes

- [x] **Task 35**: Add JSON viewer with collapsible nodes ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/tools/artifacts/JsonViewer.ts`
  - **Description**: Created collapsible JSON tree view with syntax highlighting, expand/collapse nodes, and copy path on click.
  - **Verification**: Can expand/collapse JSON nodes, copy paths
  - **Regression check**: `npm run check` passes

---

## Phase 9: Session Enhancements ✅ Complete (specs/features/sessions.md)

- [x] **Task 36**: Add session statistics display ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/dialogs/SessionInfoDialog.ts`, `packages/web-ui/src/components/Sidebar.ts`
  - **Description**: Created session info dialog showing title, created/modified dates, duration, message counts, token usage, and cost. Added "Info" option to session context menu.
  - **Verification**: Stats display correctly for sessions with usage data
  - **Regression check**: `npm run check` passes

- [x] **Task 37**: Add HTML export for sessions ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/utils/export-utils.ts`
  - **Description**: Added exportSessionAsHtml function that generates standalone HTML with embedded CSS, styled messages, code syntax highlighting, and timestamps. Renamed existing export to "Export as JSON".
  - **Verification**: Exported HTML renders correctly in browser
  - **Regression check**: `npm run check` passes

- [x] **Task 38**: Add session info dialog ✅ COMPLETED 2026-01-14 (merged with Task 36)
  - **Files**: `packages/web-ui/src/dialogs/SessionInfoDialog.ts`
  - **Description**: Completed as part of Task 36 - SessionInfoDialog shows all session details.
  - **Verification**: Dialog opens from session context menu, shows all info
  - **Regression check**: `npm run check` passes

---

## Phase 10: Advanced Keyboard Shortcuts ✅ Complete (specs/features/keyboard-shortcuts.md)

- [x] **Task 39**: Add keyboard shortcuts help dialog ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/dialogs/ShortcutsHelpDialog.ts`
  - **Description**: Created dialog showing all shortcuts grouped by category (Navigation, Chat, Find, Help). Platform-aware display (⌘ on Mac, Ctrl on Windows).
  - **Verification**: Cmd+/ opens dialog with all shortcuts listed
  - **Regression check**: `npm run check` passes

- [x] **Task 40**: Add context-aware shortcuts ✅ COMPLETED 2026-01-14
  - **Files**: `packages/web-ui/src/utils/keyboard-shortcuts.ts`, `packages/web-ui/src/components/Sidebar.ts`, `packages/web-ui/src/tools/artifacts/artifacts.ts`
  - **Description**: Added contextual shortcut support. Sidebar: ↑/↓ navigation, Enter to select, / for search. Artifacts: Cmd+Shift+[/] for tabs, Cmd+W to close.
  - **Verification**: Shortcuts work only in appropriate context
  - **Regression check**: `npm run check` passes

- [x] **Task 41**: Add copy last response shortcut ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/AgentInterface.ts`
  - **Description**: Added Cmd+Shift+C to copy last assistant message to clipboard with toast confirmation.
  - **Verification**: Shortcut copies correct content, shows toast
  - **Regression check**: `npm run check` passes

- [x] **Task 42**: Add scroll shortcuts ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/AgentInterface.ts`
  - **Description**: Added Cmd+↓/Cmd+End for scroll to bottom, Cmd+↑/Cmd+Home for scroll to top with smooth scrolling.
  - **Verification**: Shortcuts scroll chat area appropriately
  - **Regression check**: `npm run check` passes

---

## Phase 11: Mobile Enhancements ✅ Complete (specs/mobile/)

- [x] **Task 43**: Add bottom sheet component ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/BottomSheet.ts`
  - **Description**: Created reusable bottom sheet with slide-up animation, backdrop dismissal, handle bar, focus trap, and accessibility attributes.
  - **Verification**: Bottom sheet opens/closes with animation, backdrop dismisses
  - **Regression check**: `npm run check` passes

- [x] **Task 44**: Use bottom sheet for mobile menus ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`
  - **Description**: Added mobile detection (< 768px). Context menu now shows as BottomSheet on mobile with larger touch targets.
  - **Verification**: Menus slide up from bottom on mobile
  - **Regression check**: `npm run check` passes

- [x] **Task 45**: Add pull-to-refresh for session list ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`
  - **Description**: Added touch handlers for pull gesture on mobile. Visual indicator with rotating refresh icon, "Pull to refresh"/"Release to refresh" text, and spinner during refresh.
  - **Verification**: Pull gesture triggers session list reload
  - **Regression check**: `npm run check` passes

- [x] **Task 46**: Add gesture-based artifact navigation ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/tools/artifacts/artifacts.ts`
  - **Description**: Added mobile swipe gestures: left/right to switch tabs, swipe down to close fullscreen.
  - **Verification**: Swipe gestures navigate/close artifacts
  - **Regression check**: `npm run check` passes

---

## Phase 12: Advanced Notifications ✅ Complete (specs/features/notifications.md)

- [x] **Task 47**: Add banner notification component ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/Banner.ts`, `packages/web-ui/src/utils/banner.ts`
  - **Description**: Created persistent banner component with info/warning/error variants, optional action button, and dismiss button. Added showBanner/dismissBanner utilities.
  - **Verification**: `showBanner()` displays persistent notification
  - **Regression check**: `npm run check` passes

- [x] **Task 48**: Add connection status indicator ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/ConnectionStatus.ts`, `packages/web-ui/src/components/Header.ts`
  - **Description**: Created connection indicator using navigator.onLine and online/offline events. Green Wifi when connected, red WifiOff when offline. Integrated into header.
  - **Verification**: Status updates on connection changes
  - **Regression check**: `npm run check` passes

- [x] **Task 49**: Add rate limit countdown display ✅ ALREADY IMPLEMENTED (Phase 5)
  - **Files**: `packages/web-ui/src/components/ErrorBanner.ts`
  - **Description**: ErrorBanner already supports rate-limit type with countdown timer and auto-retry. The retryAfter prop triggers countdown, and onRetry is called when countdown reaches zero.
  - **Verification**: Countdown displays and auto-retries
  - **Regression check**: `npm run check` passes

- [x] **Task 50**: Add context overflow warning ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/ContextWarning.ts`, `packages/web-ui/src/components/AgentInterface.ts`
  - **Description**: Created warning component that shows when context exceeds 80% of maxContextTokens. Added token tracking to AgentInterface with maxContextTokens and onCompact props.
  - **Verification**: Warning appears at threshold, compact button works
  - **Regression check**: `npm run check` passes

---

## Phase 13: Remote Session Mode ✅ Complete (specs/modes/remote-session-mode.md)

**Note**: This phase is broken into small, self-contained tasks. Each task is independently verifiable.

### Phase 13a: Core Types & Interfaces

- [x] **Task 51**: Define RPC types and interfaces ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/networking/rpc-types.ts`
  - **Description**: Defined 23 RPC command types, 14 event types, and supporting types. Types mirror coding-agent RPC protocol.
  - **Verification**: `npm run check` passes, types are exported

- [x] **Task 52**: Define connection profile types ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/networking/connection-types.ts`
  - **Description**: Defined ConnectionProfile, ConnectionState, ConnectionOptions, ReconnectionConfig types.
  - **Verification**: `npm run check` passes

### Phase 13b: WebSocket Infrastructure

- [x] **Task 53**: Create basic WebSocket wrapper ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/networking/WebSocketClient.ts`
  - **Description**: Created WebSocketClient class with connect/disconnect/send, event emitter pattern, connection state tracking.
  - **Verification**: `npm run check` passes

- [x] **Task 54**: Add reconnection logic to WebSocket ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/networking/WebSocketClient.ts`
  - **Description**: Added exponential backoff reconnection (1s→2s→4s→...→30s max), maxRetries config, reconnecting/reconnected/failed events.
  - **Verification**: `npm run check` passes

- [x] **Task 55**: Add request/response correlation ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/networking/RPCClient.ts`
  - **Description**: Created RPCClient that wraps WebSocketClient. Assigns IDs, tracks pending requests, resolves Promises on response, emits streaming events separately. 30s timeout.
  - **Verification**: `npm run check` passes

### Phase 13c: Event Mapping

- [x] **Task 56**: Create basic RPC event mapper ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/networking/RPCEventMapper.ts`
  - **Description**: Created mapper for lifecycle events (agent_start/end, message_start/end, turn_start/end, tool_start/end) to SessionEvent types.
  - **Verification**: `npm run check` passes

- [x] **Task 57**: Add streaming delta accumulation ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/networking/RPCEventMapper.ts`
  - **Description**: Added state tracking for current message. Handles text_delta, thinking_delta, toolcall_delta, toolcall_end. Accumulates content and emits message_update events.
  - **Verification**: `npm run check` passes

- [x] **Task 58**: Add tool execution event mapping ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/networking/RPCEventMapper.ts`
  - **Description**: Added tool_execution_update handling to emit tool_update SessionEvent with partialResult.
  - **Verification**: `npm run check` passes

### Phase 13d: Connection Profiles Storage

- [x] **Task 59**: Create connection profiles store ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/storage/stores/connections-store.ts`
  - **Description**: Created IndexedDB store for ConnectionProfile with add, get, getAll, update, delete, getByUrl methods.
  - **Verification**: `npm run check` passes

- [x] **Task 60**: Create connection profiles dialog ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/dialogs/ConnectionsDialog.ts`
  - **Description**: Created modal dialog with list/add/edit views, delete confirmation, and connect callback. Integrated ConnectionsStore into AppStorage.
  - **Verification**: `npm run check` passes

### Phase 13e: Remote Session Adapter

- [x] **Task 61**: Create RemoteSessionAdapter shell ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/adapters/RemoteSessionAdapter.ts`
  - **Description**: Created adapter with state tracking (messages, model, thinkingLevel, isStreaming), event subscription, and stub methods for RPC commands.
  - **Verification**: `npm run check` passes

- [x] **Task 62**: Implement prompt command in adapter ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/adapters/RemoteSessionAdapter.ts`
  - **Description**: Implemented sendPrompt() that creates user message, sets streaming state, and sends RPC prompt command. Fixed TypeScript issue with Omit on discriminated unions.
  - **Verification**: `npm run check` passes

- [x] **Task 63**: Implement state sync in adapter ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/adapters/RemoteSessionAdapter.ts`
  - **Description**: Implemented getState() to fetch model/thinkingLevel/isStreaming, and getMessages() to fetch all messages from remote session.
  - **Verification**: `npm run check` passes

- [x] **Task 64**: Implement remaining adapter commands ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/adapters/RemoteSessionAdapter.ts`
  - **Description**: Implemented abort(), setModel() (with model lookup), setThinkingLevel(), newSession(), switchSession(). All adapter methods now fully functional.
  - **Verification**: `npm run check` passes

### Phase 13f: Enhanced Connection Status

- [x] **Task 65**: Enhance ConnectionStatus for remote mode ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/ConnectionStatus.ts`
  - **Description**: Added mode prop (browser/remote), connectionState prop, reconnectAttempt prop. Shows connecting/reconnecting with pulse animation.
  - **Verification**: `npm run check` passes

### Phase 13g: Remote Session UI

- [x] **Task 66**: Create remote sessions dialog ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/dialogs/RemoteSessionsDialog.ts`
  - **Description**: Created dialog to browse remote sessions. Shows preview, message count, last modified. Handles loading/empty/error states.
  - **Verification**: `npm run check` passes

- [x] **Task 67**: Add session cache store ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/storage/stores/session-cache-store.ts`
  - **Description**: Created IndexedDB store for CachedSession objects with compound key, CRUD operations, and prune method for cache management.
  - **Verification**: `npm run check` passes

### Phase 13h: Advanced Features

- [x] **Task 68**: Add compaction dialog ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/dialogs/CompactionDialog.ts`
  - **Description**: Created dialog showing current/max tokens, optional instructions textarea, and result view with before/after stats.
  - **Verification**: `npm run check` passes

- [x] **Task 69**: Add fork indicator component ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/ForkIndicator.ts`
  - **Description**: Created component with GitBranch icon, dropdown showing branches with preview/fork point, switch-branch event emission.
  - **Verification**: `npm run check` passes

### Phase 13i: Server (Separate Effort)

- [x] **Task 70**: Document server requirements ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/docs/remote-session-server.md`
  - **Description**: Created comprehensive documentation covering WebSocket protocol, all 24 RPC commands, 14 events, auth, error handling, and example implementation.
  - **Verification**: `npm run check` passes

---

## Phase 14: Offline Support ✅ Complete (specs/technical/storage.md)

- [x] **Task 71**: Add service worker for asset caching ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/example/public/sw.js`, `packages/web-ui/src/utils/sw-register.ts`
  - **Description**: Created service worker with cache-first for static assets, network-first for API. Registration utility with update detection and cache control.
  - **Verification**: `npm run check` passes
  - **Regression check**: `npm run check` passes

- [x] **Task 72**: Add offline queue for pending messages ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/offline/offline-queue.ts`
  - **Description**: Created IndexedDB-backed queue with add/getAll/updateStatus/remove methods. Tracks status (pending/sending/failed), listens to online/offline events.
  - **Verification**: `npm run check` passes
  - **Regression check**: `npm run check` passes

- [x] **Task 73**: Add offline indicator ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/OfflineIndicator.ts`
  - **Description**: Created banner showing offline status with pending message count. Auto-subscribes to queue, animates on appear/disappear.
  - **Verification**: `npm run check` passes
  - **Regression check**: `npm run check` passes

- [x] **Task 74**: Add background sync on reconnect ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/offline/sync-manager.ts`
  - **Description**: Created SyncManager that auto-syncs on online event. Processes queue, emits progress events, handles retry with backoff.
  - **Verification**: `npm run check` passes
  - **Regression check**: `npm run check` passes

---

## Phase 15: Data Management ✅ Complete (specs/technical/storage.md)

- [x] **Task 75**: Add storage quota management UI ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/components/StorageQuota.ts`
  - **Description**: Created component showing storage usage/quota with progress bar, category breakdown, and warning indicators for high usage.
  - **Verification**: `npm run check` passes
  - **Regression check**: `npm run check` passes

- [x] **Task 76**: Add import/export all data ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/utils/data-export.ts`
  - **Description**: Created exportAllData, downloadExport, importData (merge/replace), parseExportData utilities. Added clear/getAll methods to stores.
  - **Verification**: `npm run check` passes
  - **Regression check**: `npm run check` passes
  - **Notes**: API keys NOT exported for security.

- [x] **Task 77**: Add storage cleanup tools ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/utils/storage-cleanup.ts`
  - **Description**: Created cleanupStorage, getCleanupPreview, factoryReset, getStorageStats utilities. Supports age/size filters, cache clearing, and full reset.
  - **Verification**: `npm run check` passes
  - **Regression check**: `npm run check` passes

- [x] **Task 78**: Add data migration on version upgrades ✅ COMPLETED 2026-01-15
  - **Files**: `packages/web-ui/src/storage/migrations.ts`
  - **Description**: Created migration system with version tracking, sequential execution, error handling. Empty migrations array ready for future upgrades.
  - **Verification**: `npm run check` passes
  - **Regression check**: `npm run check` passes

---

## Progress Log
<!-- Workers append completion notes here -->

### 2026-01-14: Manual Testing Results

Performed automated verification with surf-cli. Results:
- ✅ App loads successfully (after browser compatibility workaround)
- ✅ Sidebar visible with New Chat, Settings, Search, empty state
- ✅ Header visible with menu, title, model badge, controls
- ✅ Chat area with suggestion cards, input, attachments, thinking toggle
- ✅ Settings dialog opens with Providers & Models, Proxy tabs
- ✅ Theme toggle works (dark ↔ light)
- ✅ Chat input accepts text

Issues found:
- ⚠️ `@mariozechner/pi-ai` requires Node.js module stubs for browser (Task 27)
- ⚠️ Theme toggle button lacks accessible label (Task 28)

Screenshots saved to: `packages/web-ui/surf-cli/screenshots/`

---

## Blocking Issues
<!-- Workers document blockers here for orchestrator review -->

### Browser Compatibility (High Priority)

The `@mariozechner/pi-ai` package is not browser-compatible due to Node.js imports:
- `node:crypto` in `google-gemini-cli.ts` (createHash for content hashing)
- `node:fs` in `stream.ts` (existsSync for credential detection)
- `node:os` in `stream.ts`, `openai-codex-responses.ts` (homedir, hostname)
- `node:path` in various files

**Impact**: Example app requires Vite workaround stubs to load.

**Options**:
1. Create browser-specific export (`@mariozechner/pi-ai/browser`)
2. Use dynamic imports for Node-only code
3. Document required bundler configuration

---

## References

- Specs directory: `packages/web-ui/specs/`
- Overview: `packages/web-ui/specs/overview.md`
- Architecture: `packages/web-ui/specs/architecture.md`
- UI specs: `packages/web-ui/specs/ui/`
- Feature specs: `packages/web-ui/specs/features/`
- Mobile specs: `packages/web-ui/specs/mobile/`
- Technical specs: `packages/web-ui/specs/technical/`
- Styling specs: `packages/web-ui/specs/styling/`

## Existing Components Reference

Components in `packages/web-ui/src/`:
- `ChatPanel.ts` - High-level chat wrapper
- `components/AgentInterface.ts` - Core chat UI
- `components/MessageEditor.ts` - Input with attachments
- `components/MessageList.ts` - Message rendering
- `components/Messages.ts` - Individual message components
- `components/StreamingMessageContainer.ts` - Streaming display
- `dialogs/` - ModelSelector, SettingsDialog, SessionListDialog, etc.
- `storage/` - IndexedDB stores
- `tools/` - Tool renderers, artifacts
- `utils/` - Various utilities
