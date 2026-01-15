# Manual Testing Plan for Pi Web UI

This document outlines manual verification steps for the web-ui package after the initial orchestrator implementation.

## Prerequisites

```bash
# Build and run the dev server
cd packages/web-ui
npm run dev

# The example app runs at http://localhost:5173 (or similar)
```

---

## 1. Basic Application Loading

### 1.1 Initial Load
- [ ] App loads without errors in console
- [ ] Loading spinner/state appears briefly
- [ ] App layout renders with header, sidebar (desktop), and chat area
- [ ] Theme respects system preference (light/dark)

### 1.2 Responsive Layout
- [ ] Desktop (≥1024px): Sidebar visible, header inline
- [ ] Mobile (<1024px): Sidebar hidden, hamburger menu visible
- [ ] Resize window: Layout adapts smoothly

---

## 2. Sidebar Component (`<pi-sidebar>`)

### 2.1 Empty State
- [ ] Shows empty state message when no sessions exist
- [ ] "New Chat" button visible in empty state

### 2.2 Session List
- [ ] Sessions are grouped by date (Today, Yesterday, Last 7 Days, etc.)
- [ ] Each session shows: title, preview, timestamp, message count
- [ ] Active session is highlighted
- [ ] Hover state on session items

### 2.3 Session Actions
- [ ] Click session: loads the session in chat area
- [ ] Context menu (⋮): Rename, Delete, Export options appear
- [ ] Rename: inline edit mode works, Enter saves, Escape cancels
- [ ] Delete: confirmation shown, session removed from list
- [ ] Export: downloads JSON file

### 2.4 Mobile Drawer
- [ ] Hamburger menu opens sidebar as drawer overlay
- [ ] Backdrop click closes drawer
- [ ] Session selection closes drawer
- [ ] Swipe gestures (if implemented)

---

## 3. Header Component (`<pi-header>`)

### 3.1 Display
- [ ] Shows session title (or "New Chat" for new sessions)
- [ ] Shows model name badge
- [ ] Shows thinking level indicator
- [ ] Settings button visible
- [ ] New Chat button visible

### 3.2 Interactions
- [ ] Title click enables edit mode (inline input)
- [ ] Settings button opens SettingsDialog
- [ ] New Chat button navigates to new session
- [ ] Menu button (mobile) toggles sidebar

### 3.3 Streaming State
- [ ] Streaming indicator shows when agent is responding
- [ ] Model badge updates with current model

---

## 4. Settings Dialog

### 4.1 Opening/Closing
- [ ] Opens from header settings button
- [ ] Closes with X button or backdrop click
- [ ] Closes with Escape key

### 4.2 Providers & Models Tab
- [ ] Lists available providers
- [ ] API key input fields work
- [ ] Keys are saved to IndexedDB
- [ ] Model selection works

### 4.3 Proxy Tab
- [ ] Proxy URL input works
- [ ] Settings persist after reload

---

## 5. Chat Functionality

### 5.1 Message Input
- [ ] Input field accepts text
- [ ] Send button submits message
- [ ] Enter key submits (Shift+Enter for newline)
- [ ] Input clears after send

### 5.2 Message Display
- [ ] User messages appear on right
- [ ] Assistant messages appear on left
- [ ] Markdown renders correctly
- [ ] Code blocks have syntax highlighting
- [ ] Streaming text appears progressively

### 5.3 Tool Calls (JavaScript REPL)
- [ ] Tool calls display with expandable/collapsible UI
- [ ] Tool results show output
- [ ] Artifacts created by REPL display correctly

### 5.4 Session Persistence
- [ ] After first message exchange, session is saved
- [ ] Session appears in sidebar
- [ ] URL updates with session ID
- [ ] Page reload restores session
- [ ] Direct URL navigation loads correct session

---

## 6. Toast Notifications

- [ ] Toast appears for user actions (delete, export, error)
- [ ] Toast auto-dismisses after timeout
- [ ] Multiple toasts stack properly
- [ ] Toast can be manually dismissed

---

## 7. Theme Toggle

- [ ] Theme toggle button in header
- [ ] Clicking cycles through light/dark/system
- [ ] Theme persists after reload
- [ ] Colors update correctly on toggle

---

## 8. Error Handling

### 8.1 Missing API Key
- [ ] Prompt appears when API key needed
- [ ] Dialog allows entering key
- [ ] Key is saved after entry

### 8.2 Network Errors
- [ ] Error banner displays on connection failure
- [ ] Retry mechanism works (if implemented)
- [ ] Error state can be dismissed

---

## 9. Keyboard Shortcuts

- [ ] `Cmd/Ctrl+,` opens settings
- [ ] `Cmd/Ctrl+N` creates new chat
- [ ] `Cmd/Ctrl+K` opens model selector (if implemented)
- [ ] Arrow keys navigate sidebar (if implemented)

---

## 10. URL State Management

- [ ] New session: URL has no session parameter
- [ ] After first exchange: URL gets `?session=<id>`
- [ ] Navigating to `?session=<id>` loads that session
- [ ] Invalid session ID redirects to new session

---

## Automated Verification with surf-cli

The following tests can be automated using tmux + surf-cli:

### Setup Script

```bash
#!/bin/bash
# Launch dev server in tmux
SOCKET_DIR=${TMPDIR:-/tmp}/claude-tmux-sockets
mkdir -p "$SOCKET_DIR"
SOCKET="$SOCKET_DIR/claude.sock"
SESSION=pi-webui-dev

# Kill existing session if any
tmux -S "$SOCKET" kill-session -t "$SESSION" 2>/dev/null || true

# Start dev server
tmux -S "$SOCKET" new -d -s "$SESSION" -n server
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 -- 'cd /home/will/tools/pi-web-ui/packages/web-ui && npm run dev' Enter

# Wait for server ready
sleep 5  # Or use wait-for-text.sh with "ready" pattern

echo "Dev server started. Monitor with:"
echo "  tmux -S $SOCKET attach -t $SESSION"
```

### surf-cli Verification Commands

```bash
# Setup surf directory
mkdir -p $PWD/surf-cli/{screenshots,logs}

# Navigate to app
surf go "http://localhost:5173"
surf wait.dom
surf screenshot --output $PWD/surf-cli/screenshots/01-initial-load.png

# Read page structure (accessibility tree)
surf read > $PWD/surf-cli/logs/accessibility-tree.txt

# Check for key elements
surf page.text | grep -q "New Chat" && echo "✓ New Chat visible"
surf page.text | grep -q "Settings" && echo "✓ Settings visible"

# Test sidebar toggle (mobile simulation)
surf window.resize 400 800
surf wait 0.5
surf screenshot --output $PWD/surf-cli/screenshots/02-mobile-view.png

# Click hamburger menu (find ref from accessibility tree)
surf read | grep -i "menu"  # Find the menu button ref
# surf click <ref>
surf screenshot --output $PWD/surf-cli/screenshots/03-sidebar-open.png

# Test theme toggle
surf read | grep -i "theme"  # Find theme toggle ref
# surf click <ref>
surf screenshot --output $PWD/surf-cli/screenshots/04-theme-toggled.png

# Restore desktop size
surf window.resize 1400 900
surf wait 0.5
surf screenshot --output $PWD/surf-cli/screenshots/05-desktop-view.png

# Test input interaction
surf read | grep -i "input"  # Find chat input ref
# surf click <ref>
# surf type "Hello, this is a test message"
surf screenshot --output $PWD/surf-cli/screenshots/06-message-typed.png

# Test settings dialog
surf read | grep -i "settings"  # Find settings button ref
# surf click <ref>
surf wait.dom
surf screenshot --output $PWD/surf-cli/screenshots/07-settings-dialog.png

# Close dialog
surf key Escape
surf wait.dom
surf screenshot --output $PWD/surf-cli/screenshots/08-settings-closed.png
```

### Full Automated Test Script

```bash
#!/bin/bash
set -e

WORK_DIR="$PWD/surf-cli"
mkdir -p "$WORK_DIR"/{screenshots,logs}

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$WORK_DIR/logs/test.log"; }

# 1. Navigate and verify initial load
log "Test: Initial load"
surf go "http://localhost:5173"
surf wait.dom
surf wait 1
surf screenshot --output "$WORK_DIR/screenshots/01-initial.png"
if surf page.text | grep -q "New Chat"; then
    log "✓ App loaded successfully"
else
    log "✗ App failed to load"
    exit 1
fi

# 2. Test responsive layout
log "Test: Mobile layout"
surf window.resize 400 800
surf wait 0.5
surf screenshot --output "$WORK_DIR/screenshots/02-mobile.png"
# Verify hamburger menu appears
if surf read | grep -qi "menu"; then
    log "✓ Mobile menu visible"
else
    log "✗ Mobile menu not found"
fi

# 3. Restore desktop and test settings
log "Test: Settings dialog"
surf window.resize 1400 900
surf wait 0.5
# Find and click settings (adjust ref based on actual tree)
SETTINGS_REF=$(surf read | grep -i "settings" | grep -oE 'e[0-9]+' | head -1)
if [ -n "$SETTINGS_REF" ]; then
    surf click "$SETTINGS_REF"
    surf wait.dom
    surf screenshot --output "$WORK_DIR/screenshots/03-settings.png"
    surf key Escape
    log "✓ Settings dialog works"
else
    log "✗ Settings button not found"
fi

# 4. Test theme toggle
log "Test: Theme toggle"
THEME_REF=$(surf read | grep -i "theme" | grep -oE 'e[0-9]+' | head -1)
if [ -n "$THEME_REF" ]; then
    surf click "$THEME_REF"
    surf wait 0.5
    surf screenshot --output "$WORK_DIR/screenshots/04-theme-dark.png"
    log "✓ Theme toggle works"
else
    log "✗ Theme toggle not found"
fi

# 5. Test chat input
log "Test: Chat input"
INPUT_REF=$(surf read | grep -i "message\|input\|chat" | grep -oE 'e[0-9]+' | head -1)
if [ -n "$INPUT_REF" ]; then
    surf click "$INPUT_REF"
    surf type "Hello, this is a test"
    surf screenshot --output "$WORK_DIR/screenshots/05-input.png"
    log "✓ Chat input works"
else
    log "✗ Chat input not found"
fi

log "All tests completed. Screenshots saved to $WORK_DIR/screenshots/"
```

---

## Cleanup

```bash
# Kill dev server session
SOCKET_DIR=${TMPDIR:-/tmp}/claude-tmux-sockets
SOCKET="$SOCKET_DIR/claude.sock"
tmux -S "$SOCKET" kill-session -t pi-webui-dev 2>/dev/null || true
```

---

## Notes

- surf-cli requires Chrome with surf extension running
- Element refs (`e1`, `e2`, etc.) change between page loads; always read fresh tree
- Use `surf read` to discover current element refs before clicking
- Screenshots auto-resize to 1200px; use `--full` for full resolution
