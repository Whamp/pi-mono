# Orchestration Plan: Production Web UI for LLM Chat

**Created**: 2026-01-14
**Objective**: Transform the existing packages/web-ui/example demo app into a production-quality web UI for chatting with LLMs, implementing the features specified in packages/web-ui/specs/
**Baseline checks**: `npm run check` (biome lint + TypeScript)

## Scope & Features

Based on the comprehensive specs in `packages/web-ui/specs/`, the target features are:

### Core Features (Phase 1)
- [x] Streaming responses with markdown rendering (existing)
- [x] Code syntax highlighting (existing)
- [x] Tool/function calling display (existing)
- [x] Thinking/reasoning display (existing)
- [x] Model selection (existing)
- [x] File/image attachments (existing)
- [x] Basic session persistence (existing)

### Session Management (Phase 2)
- [ ] Sidebar with session list (grouped by date)
- [ ] Session search/filter
- [ ] Session rename (inline editing)
- [ ] Session delete with confirmation
- [ ] Session export (JSON)
- [ ] Improved session metadata (usage tracking)

### Layout & Navigation (Phase 3)
- [ ] Responsive 3-panel layout (sidebar, chat, artifacts)
- [ ] Collapsible sidebar with drawer mode on mobile/tablet
- [ ] Header with session title and controls
- [ ] Artifacts panel with overlay mode on mobile
- [ ] Proper safe area handling for mobile

### Mobile Experience (Phase 4)
- [ ] Touch-optimized interactions
- [ ] Swipe gestures (sidebar open/close, session delete)
- [ ] Bottom navigation patterns
- [ ] Keyboard avoidance
- [ ] Safe area insets

### Polish & UX (Phase 5)
- [ ] Keyboard shortcuts
- [ ] Toast notifications
- [ ] Loading skeletons
- [ ] Empty states
- [ ] Error handling UI
- [ ] Settings preferences

### Optional/Future
- [ ] Remote session mode (WebSocket RPC)
- [ ] Authentication
- [ ] Session branching
- [ ] Voice input

---

## Phase 1: Foundation Setup

### Prerequisites
The example app already has working:
- ChatPanel, AgentInterface components
- MessageEditor, MessageList components
- IndexedDB storage (SessionsStore, SettingsStore, ProviderKeysStore)
- Tool renderers and artifacts panel
- Model selector dialog

---

## Task List

### Phase 2: Session Management

- [x] **Task 1**: Create Sidebar component shell
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`, `packages/web-ui/src/index.ts`
  - **Description**: Create a new `<pi-sidebar>` component with the basic structure (header, search, session list area). Use mini-lit patterns. Implement minimal props: `sessions`, `activeSessionId`, `onSelect`, `onNewChat`.
  - **Verification**: Component renders without errors, can be instantiated with `document.createElement('pi-sidebar')`
  - **Regression check**: `npm run check` passes
  - **Notes**: Follow structure from `specs/ui/sidebar.md`. Use `customElement` decorator. Use Tailwind classes.

- [x] **Task 2**: Create SessionItem sub-component
  - **Files**: `packages/web-ui/src/components/SessionItem.ts`
  - **Description**: Create a session list item component showing title, preview, timestamp, message count. Include context menu trigger (⋮). Support active/hover states.
  - **Verification**: Component renders with mock data, visual states work
  - **Regression check**: `npm run check` passes
  - **Notes**: See `specs/ui/sidebar.md` for layout. Include relative date formatting.

- [x] **Task 3**: Implement date grouping for session list
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`, `packages/web-ui/src/utils/date-utils.ts`
  - **Description**: Create utility function to group sessions by date (Today, Yesterday, Last 7 Days, Last 30 Days, Older). Render sticky group headers in sidebar.
  - **Verification**: Sessions display in correct date groups with headers
  - **Regression check**: `npm run check` passes
  - **Notes**: Use `Intl.DateTimeFormat` for locale-aware formatting.

- [x] **Task 4**: Implement sidebar search
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`
  - **Description**: Add search input to sidebar. Filter sessions by title and preview text. Debounce search (300ms). Show "No results" state.
  - **Verification**: Searching filters session list in real-time
  - **Regression check**: `npm run check` passes
  - **Notes**: Fuzzy search optional, exact substring match is fine for v1.

- [x] **Task 5**: Add session context menu
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`, `packages/web-ui/src/components/SessionItem.ts`
  - **Description**: Implement context menu with Rename and Delete options. Use mini-lit DropdownMenu or similar pattern. Wire up delete with confirmation dialog.
  - **Verification**: Context menu opens on click, actions work
  - **Regression check**: `npm run check` passes
  - **Notes**: Use existing ConfirmDialog pattern or create simple one.

- [x] **Task 6**: Implement inline session rename
  - **Files**: `packages/web-ui/src/components/SessionItem.ts`, `packages/web-ui/src/components/Sidebar.ts`
  - **Description**: When Rename selected, transform title into editable input. Enter saves, Escape cancels. Update SessionsStore.
  - **Verification**: Can rename sessions, persists to IndexedDB
  - **Regression check**: `npm run check` passes
  - **Notes**: Similar to existing title editing in main.ts but within the sidebar.

- [x] **Task 7**: Add session export
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`, `packages/web-ui/src/utils/export-utils.ts`
  - **Description**: Add Export to context menu. Export session as JSON file download.
  - **Verification**: Exported JSON contains full session data
  - **Regression check**: `npm run check` passes
  - **Notes**: Use `Blob` and `URL.createObjectURL` for download.

- [x] **Task 8**: Enhance session metadata tracking
  - **Files**: `packages/web-ui/src/storage/stores/sessions-store.ts`, `packages/web-ui/example/src/main.ts`
  - **Description**: Track cumulative token usage and cost per session. Update metadata on each agent_end. Display in session list or info.
  - **Verification**: Session metadata includes accurate usage stats
  - **Regression check**: `npm run check` passes
  - **Notes**: Usage already tracked per message, need to aggregate.

### Phase 3: Layout & Navigation

- [x] **Task 9**: Create AppLayout component
  - **Files**: `packages/web-ui/src/components/AppLayout.ts`, `packages/web-ui/src/index.ts`
  - **Description**: Create `<pi-app-layout>` that orchestrates sidebar, main content (chat), and artifacts panel. Handle responsive breakpoints (mobile <768px, tablet 768-1024px, desktop ≥1024px).
  - **Verification**: Layout renders correctly at all breakpoints
  - **Regression check**: `npm run check` passes
  - **Notes**: See `specs/ui/layout.md`. Use CSS custom properties for breakpoints.

- [x] **Task 10**: Implement sidebar drawer mode (completed as part of Task 9)
  - **Files**: `packages/web-ui/src/components/AppLayout.ts`, `packages/web-ui/src/components/Sidebar.ts`
  - **Description**: On mobile/tablet, sidebar becomes a drawer that slides in from left. Add backdrop overlay. Handle open/close state.
  - **Verification**: Sidebar animates smoothly, backdrop closes it
  - **Regression check**: `npm run check` passes
  - **Notes**: Use CSS transforms for performance. Add `will-change: transform`.

- [x] **Task 11**: Create Header component
  - **Files**: `packages/web-ui/src/components/Header.ts`, `packages/web-ui/src/index.ts`
  - **Description**: Create `<pi-header>` with hamburger menu (mobile), session title (editable), model badge, and actions (new chat, settings). Move relevant controls from current header.
  - **Verification**: Header displays all controls, menu toggles sidebar
  - **Regression check**: `npm run check` passes
  - **Notes**: See `specs/ui/header.md`. Model badge shows current model.

- [x] **Task 12**: Integrate artifacts panel in layout (verified, no changes needed)
  - **Files**: `packages/web-ui/src/components/AppLayout.ts`
  - **Description**: Position ArtifactsPanel as side panel on desktop (≥1280px) or overlay on smaller screens. Handle collapse/expand state.
  - **Verification**: Artifacts panel shows correctly at all sizes
  - **Regression check**: `npm run check` passes
  - **Notes**: Existing ArtifactsPanel already has overlay prop.

- [x] **Task 13**: Refactor example app to use new layout
  - **Files**: `packages/web-ui/example/src/main.ts`, `packages/web-ui/example/src/app.css`
  - **Description**: Replace current render logic with `<pi-app-layout>`. Wire up sidebar, header, and chat panel. Maintain all existing functionality.
  - **Verification**: App works identically but with new layout structure
  - **Regression check**: `npm run check` passes
  - **Notes**: This is the big integration task. Test thoroughly.

- [x] **Task 14**: Add safe area handling for mobile
  - **Files**: `packages/web-ui/src/components/AppLayout.ts`, `packages/web-ui/src/app.css`
  - **Description**: Add `env(safe-area-inset-*)` handling for notched devices. Apply to layout container and input area.
  - **Verification**: No content hidden behind notches/home indicators
  - **Regression check**: `npm run check` passes
  - **Notes**: Use Safari Web Inspector device simulator to test.

### Phase 4: Mobile Experience

- [x] **Task 15**: Add swipe gesture for sidebar
  - **Files**: `packages/web-ui/src/components/AppLayout.ts`, `packages/web-ui/src/utils/gesture-utils.ts`
  - **Description**: Detect swipe from left edge to open sidebar. Detect swipe left on open sidebar to close.
  - **Verification**: Swipe gestures work on touch devices
  - **Regression check**: `npm run check` passes
  - **Notes**: Use touch events (touchstart, touchmove, touchend). Consider pointer events for unified handling.

- [x] **Task 16**: Add swipe-to-delete for sessions
  - **Files**: `packages/web-ui/src/components/SessionItem.ts`
  - **Description**: On mobile, swiping left on a session item reveals delete button. Tapping delete removes session (with confirmation).
  - **Verification**: Swipe reveals delete, action works
  - **Regression check**: `npm run check` passes
  - **Notes**: Common mobile pattern. Add spring-back animation.

- [x] **Task 17**: Optimize touch targets
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`, `packages/web-ui/src/components/Header.ts`, `packages/web-ui/src/components/MessageEditor.ts`
  - **Description**: Ensure all interactive elements have minimum 44x44px touch targets. Add appropriate spacing.
  - **Verification**: All buttons/links easily tappable on mobile
  - **Regression check**: `npm run check` passes
  - **Notes**: Audit with mobile device or simulator.

- [x] **Task 18**: Handle virtual keyboard
  - **Files**: `packages/web-ui/src/components/MessageEditor.ts`
  - **Description**: When virtual keyboard opens on mobile, adjust layout to keep input visible. Use `visualViewport` API.
  - **Verification**: Input stays visible when keyboard opens
  - **Regression check**: `npm run check` passes
  - **Notes**: See `specs/ui/input.md` for implementation details.

### Phase 5: Polish & UX

- [x] **Task 19**: Create Toast notification component
  - **Files**: `packages/web-ui/src/components/Toast.ts`, `packages/web-ui/src/utils/toast.ts`, `packages/web-ui/src/index.ts`
  - **Description**: Create `<pi-toast>` component and `showToast()` utility. Support success/error/info variants. Auto-dismiss after 3s.
  - **Verification**: `showToast('Message')` displays toast briefly
  - **Regression check**: `npm run check` passes
  - **Notes**: Position fixed at bottom-center. Stack multiple toasts.

- [x] **Task 20**: Add loading skeletons
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`, `packages/web-ui/src/components/MessageList.ts`
  - **Description**: Show skeleton loading states while sessions load and while waiting for first token.
  - **Verification**: Skeletons display during loading
  - **Regression check**: `npm run check` passes
  - **Notes**: Use CSS animations for shimmer effect.

- [x] **Task 21**: Add empty states
  - **Files**: `packages/web-ui/src/components/Sidebar.ts`, `packages/web-ui/src/components/MessageList.ts`
  - **Description**: Show friendly empty states: "No conversations yet" in sidebar, welcome message with suggested prompts in chat.
  - **Verification**: Empty states display when appropriate
  - **Regression check**: `npm run check` passes
  - **Notes**: See `specs/ui/chat.md` and `specs/ui/sidebar.md`.

- [x] **Task 22**: Implement keyboard shortcuts
  - **Files**: `packages/web-ui/src/utils/keyboard-shortcuts.ts`, `packages/web-ui/src/components/AppLayout.ts`
  - **Description**: Add global keyboard shortcut handler. Implement: Cmd+B (toggle sidebar), Cmd+N (new chat), Cmd+K (search), Escape (close modals/sidebar).
  - **Verification**: Shortcuts work as expected
  - **Regression check**: `npm run check` passes
  - **Notes**: See `specs/features/keyboard-shortcuts.md`.

- [x] **Task 23**: Improve error handling UI
  - **Files**: `packages/web-ui/src/components/ErrorBanner.ts`, `packages/web-ui/src/components/AgentInterface.ts`
  - **Description**: Create error banner component. Show clear error states for: rate limit (with retry timer), network error (with retry button), context overflow.
  - **Verification**: Errors display with actionable UI
  - **Regression check**: `npm run check` passes
  - **Notes**: See `specs/technical/error-handling.md` and `specs/ui/chat.md`.

- [x] **Task 24**: Add settings preferences
  - **Files**: `packages/web-ui/src/dialogs/SettingsDialog.ts`, `packages/web-ui/src/storage/stores/settings-store.ts`
  - **Description**: Add preferences tab to settings: default model, default thinking level, theme preference, sidebar collapsed by default.
  - **Verification**: Preferences persist and apply
  - **Regression check**: `npm run check` passes
  - **Notes**: Already have SettingsStore, extend with new keys.

- [x] **Task 25**: Final polish and cleanup
  - **Files**: Various
  - **Description**: Review all components for consistency. Ensure animations are smooth (60fps). Verify accessibility (ARIA labels, focus management). Clean up any TODOs.
  - **Verification**: Manual review passes, no console errors
  - **Regression check**: `npm run check` passes
  - **Notes**: Test on real devices if possible.

---

## Export Index Updates

After all component tasks, ensure `packages/web-ui/src/index.ts` exports all new components:

- [x] **Task 26**: Update package exports
  - **Files**: `packages/web-ui/src/index.ts`
  - **Description**: Export all new components (AppLayout, Sidebar, SessionItem, Header, Toast, ErrorBanner) and utilities (toast, keyboard shortcuts, gesture utils, date utils, export utils).
  - **Verification**: All exports accessible via `@mariozechner/pi-web-ui`
  - **Regression check**: `npm run check` passes
  - **Notes**: Maintain backwards compatibility with existing exports.

---

## Progress Log
<!-- Workers append completion notes here -->

---

## Blocking Issues
<!-- Workers document blockers here for orchestrator review -->

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
