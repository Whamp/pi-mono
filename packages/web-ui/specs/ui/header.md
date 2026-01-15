# Header

The header provides session context, controls, and status indicators. It adapts between desktop (inline with chat) and mobile (fixed top bar).

## Structure

### Desktop Header

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [≡] Session Title (editable)              [Model Badge] [⚙️] [🌓]         │
└────────────────────────────────────────────────────────────────────────────┘
```

### Mobile Header

```
┌─────────────────────────────────────┐
│ [≡]  Session Title          [⋮]    │
└─────────────────────────────────────┘
```

## Components

### Menu Button (Mobile)

```typescript
interface MenuButtonProps {
  onClick: () => void;
  hasUnread?: boolean;  // Future: badge for new sessions
}
```

**Desktop:** Hidden (sidebar always visible)
**Mobile:** Hamburger icon (≡), opens sidebar drawer

### Session Title

```typescript
interface SessionTitleProps {
  title: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (newTitle: string) => void;
  onCancel: () => void;
}
```

**Display mode:**
```
┌─────────────────────────────────────┐
│ Refactor authentication module  [✏️]│
└─────────────────────────────────────┘
```

**Edit mode:**
```
┌─────────────────────────────────────┐
│ [Refactor authentication module   ] │ ← Input field
│                      [Cancel] [Save]│
└─────────────────────────────────────┘
```

**Behavior:**
- Click title or edit icon to enter edit mode
- Enter to save, Escape to cancel
- Auto-generate from first message if not set
- Truncate with ellipsis on overflow

**Mobile:** Title click opens action menu (Rename, Export, Delete)

### Connection Status Badge

```typescript
interface ConnectionStatusProps {
  mode: 'browser' | 'remote';
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  serverName?: string;
  onClick: () => void;  // Opens connection dialog
}
```

**States:**

| Mode | Status | Display |
|------|--------|---------|
| Browser | - | 🌐 (subtle, no text on mobile) |
| Remote | connected | 🟢 {name} |
| Remote | connecting | 🟡 Connecting... (pulsing) |
| Remote | disconnected | 🔴 Disconnected |
| Remote | error | ⚠️ Error |

**Desktop:** Full text visible
**Mobile:** Icon only, tap for details

### Model Badge

```typescript
interface ModelBadgeProps {
  model: Model | null;
  thinkingLevel: ThinkingLevel;
  onClick: () => void;  // Opens model selector
}
```

**Display:**
```
┌───────────────────────────────────┐
│ 🤖 claude-sonnet-4 · thinking: M │
└───────────────────────────────────┘
```

**Thinking level abbreviations:**
| Level | Short |
|-------|-------|
| off | - |
| minimal | min |
| low | L |
| medium | M |
| high | H |
| xhigh | XH |

**Mobile:** Abbreviated or icon only:
```
┌─────────────┐
│ 🤖 sonnet-4 │
└─────────────┘
```

### Streaming Indicator

During streaming, show activity:

```typescript
interface StreamingIndicatorProps {
  isStreaming: boolean;
  isCompacting: boolean;
  isRetrying: boolean;
  retryInfo?: {
    attempt: number;
    maxAttempts: number;
    delayMs: number;
  };
}
```

**States:**
- **Streaming:** "● Responding..." (with animated dot)
- **Compacting:** "📦 Compacting context..."
- **Retrying:** "🔄 Retrying (2/3) in 5s..."

### Settings Button

```typescript
interface SettingsButtonProps {
  onClick: () => void;
}
```

Opens settings dialog. Icon: ⚙️ (gear)

### Theme Toggle

```typescript
interface ThemeToggleProps {
  theme: 'light' | 'dark' | 'system';
  onToggle: () => void;
}
```

**Icons:**
- Light: ☀️
- Dark: 🌙
- System: 💻 (auto)

Click cycles through modes.

### More Menu (Mobile)

```typescript
interface MoreMenuProps {
  onRename: () => void;
  onExport: () => void;
  onDelete: () => void;
  onSettings: () => void;
  onNewChat: () => void;
}
```

**Dropdown:**
```
┌─────────────────────┐
│ ✏️ Rename           │
│ 📤 Export           │
│ 🗑️ Delete           │
│ ───────────────────│
│ ⚙️ Settings         │
│ + New Chat          │
└─────────────────────┘
```

## Context-Specific Headers

### Empty Session

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [≡] New Chat                              [Model Badge] [⚙️] [🌓]         │
└────────────────────────────────────────────────────────────────────────────┘
```

### Remote Session (Connected)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [≡] Refactor auth  🟢 Work Laptop        [Model Badge] [⚙️] [🌓]         │
└────────────────────────────────────────────────────────────────────────────┘
```

### Remote Session (Disconnected)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [≡] Refactor auth  🔴 Disconnected [Reconnect]  [Model Badge] [⚙️]        │
└────────────────────────────────────────────────────────────────────────────┘
```

## Breadcrumb (Remote Mode, Future)

For remote sessions, show project path:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [≡] ~/projects/my-app > Refactor auth     [Model Badge] [⚙️] [🌓]        │
└────────────────────────────────────────────────────────────────────────────┘
```

## Responsive Behavior

### Desktop (≥1024px)

- Full header with all elements visible
- Session title editable inline
- Model badge with full text
- All action buttons visible

### Tablet (768px - 1023px)

- Menu button visible
- Title truncated if long
- Model badge abbreviated
- Settings in more menu

### Mobile (<768px)

- Compact header (fixed position)
- Menu and more buttons only
- Title truncated aggressively
- All settings in more menu

## Layout CSS

```css
.header {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background);
  
  @media (max-width: 767px) {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-header);
    height: 48px;
    padding: 0 8px;
  }
}

.header-title {
  flex: 1;
  min-width: 0;
  margin: 0 16px;
  
  @media (max-width: 767px) {
    margin: 0 8px;
    font-size: 14px;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  
  @media (max-width: 767px) {
    gap: 4px;
  }
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+,` | Open settings |
| `Cmd/Ctrl+K` | Open model selector |
| `Cmd/Ctrl+N` | New chat |
| `Cmd/Ctrl+E` | Edit title |

## Accessibility

- **ARIA landmarks**: `role="banner"`
- **Focus order**: Menu → Title → Model → Actions
- **Keyboard navigation**: Tab through elements
- **Screen reader**: Announce status changes
