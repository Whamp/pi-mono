# Sidebar

The sidebar provides session navigation, search, and connection management. It adapts between a persistent panel (desktop) and a drawer (mobile/tablet).

## Structure

```
┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │  Connection Indicator     │  │ ← Shows mode (Browser/Remote) + status
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  [+] New Chat    [⚙️]     │  │ ← Actions bar
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  🔍 Search conversations  │  │ ← Search input
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  📁 Project Filter ▾      │  │ ← Optional folder/project filter
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  Today                    │  │ ← Date group header
│  │  ├─ ○ Session title...    │  │
│  │  └─ ○ Another session...  │  │
│  │                           │  │
│  │  Yesterday                │  │
│  │  ├─ ○ Old session...      │  │
│  │  └─ ○ ...                 │  │
│  │                           │  │
│  │  Last 7 Days              │  │
│  │  └─ ○ ...                 │  │
│  │                           │  │
│  │  Last 30 Days             │  │
│  │  └─ ○ ...                 │  │
│  │                           │  │
│  │  Older                    │  │
│  │  └─ ○ ...                 │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## Components

### Connection Indicator

Shows current connection mode and status:

```typescript
interface ConnectionIndicatorProps {
  mode: 'browser' | 'remote';
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  serverName?: string;  // For remote mode
  onClick: () => void;  // Opens connection dialog
}
```

**Visual states:**

| Mode | Status | Display |
|------|--------|---------|
| Browser | - | "🌐 Browser Mode" (green) |
| Remote | connected | "🔌 {serverName}" (green) |
| Remote | connecting | "🔌 Connecting..." (yellow, pulsing) |
| Remote | disconnected | "🔌 Disconnected" (red) |
| Remote | error | "🔌 Error" (red) |

Clicking opens the Connection Dialog to switch modes or reconnect.

### Actions Bar

```typescript
interface ActionsBarProps {
  onNewChat: () => void;
  onSettings: () => void;
}
```

**Buttons:**
- **New Chat** (`+`): Creates new session (in current mode)
- **Settings** (`⚙️`): Opens settings dialog

### Search Input

```typescript
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;  // "Search conversations"
}
```

**Behavior:**
- Filters session list as user types
- Searches in: session title, first message preview, session ID
- Debounced (300ms) for performance
- Shows "No results" when empty
- Clear button (×) when has value

### Project Filter

Optional filter for remote mode (filters by `cwd`):

```typescript
interface ProjectFilterProps {
  projects: string[];        // List of unique cwds
  selected: string | null;   // null = all projects
  onChange: (project: string | null) => void;
}
```

**Behavior:**
- Dropdown showing unique project paths
- "All Projects" option at top
- Shows project count in parentheses
- Only visible when multiple projects exist

### Session List

```typescript
interface SessionListProps {
  sessions: SessionMetadata[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onRename: (sessionId: string) => void;
}

interface SessionMetadata {
  id: string;
  title: string;
  preview: string;          // First message snippet
  lastModified: string;     // ISO timestamp
  messageCount: number;
  modelId?: string;
  cwd?: string;             // For remote sessions
  isStarred?: boolean;
}
```

### Session Item

```typescript
interface SessionItemProps {
  session: SessionMetadata;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: Event) => void;
}
```

**Structure:**

```
┌─────────────────────────────────────────┐
│ ○ Session Title                    ⋮    │ ← Title (bold if unread) + menu
│   Preview of first message...           │ ← Preview (muted)
│   12:34 PM · 5 messages                 │ ← Time + count (muted)
└─────────────────────────────────────────┘
```

**Visual states:**
- **Default**: Normal styling
- **Active**: Background highlight, accent border-left
- **Hover**: Subtle background change
- **Unread** (future): Bold title

**Context menu (⋮ or long-press):**
- Rename
- Delete
- Star/Unstar (future)
- Export (future)

### Date Group Headers

Sessions are grouped by relative date:

```typescript
type DateGroup = 
  | 'Today'
  | 'Yesterday'
  | 'Last 7 Days'
  | 'Last 30 Days'
  | 'Older'
  | string;  // Month name for older ("January 2024")

function groupSessionsByDate(sessions: SessionMetadata[]): Map<DateGroup, SessionMetadata[]>;
```

**Header styling:**
- Sticky within scroll container
- Muted text, small caps
- Subtle separator line below

## Interactions

### Session Selection

1. Click/tap session item
2. Highlight selected session
3. Load session in chat area
4. Close sidebar (mobile only)

### Session Deletion

1. Click context menu → Delete (or swipe left on mobile)
2. Show confirmation dialog: "Delete this conversation?"
3. On confirm: Delete from storage, remove from list
4. If active session: Navigate to new session or next in list

### Session Rename

1. Click context menu → Rename
2. Inline edit mode (input replaces title)
3. Enter to save, Escape to cancel
4. Update in storage

### New Chat

1. Click "+" button
2. Create new session (no messages)
3. Navigate to new session
4. Focus input area

## Mobile Adaptations

### Drawer Mode

- Full height overlay with backdrop
- Swipe right to close
- Close button in header (×)
- Safe area padding at bottom

### Touch Interactions

| Gesture | Action |
|---------|--------|
| Tap session | Select and close drawer |
| Long press | Show context menu |
| Swipe left on session | Reveal delete button |
| Swipe right from edge | Open drawer |
| Tap backdrop | Close drawer |

### Swipe to Delete

```
┌─────────────────────────────────────────┐
│ ○ Session Title           │ 🗑️ Delete  │
│   Preview...              │            │
└─────────────────────────────────────────┘
        ← Swipe left reveals delete button
```

## Virtualization

For performance with many sessions:

```typescript
interface VirtualizedSessionListProps {
  sessions: SessionMetadata[];
  itemHeight: number;  // Fixed height for virtualization
  overscan: number;    // Items to render outside viewport
}
```

**Implementation:**
- Use virtual scrolling library (e.g., `@tanstack/virtual`)
- Render only visible items + overscan buffer
- Maintain scroll position on updates
- Smooth scrolling with momentum

## Loading States

### Initial Load

```
┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░  │  │ ← Skeleton for header
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░  │  │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░  │  │ ← Skeleton sessions (3-5)
│  │  ░░░░░░░░                 │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░  │  │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░  │  │
│  │  ░░░░░░░░                 │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Empty State

```
┌─────────────────────────────────┐
│                                 │
│         💬                      │
│                                 │
│   No conversations yet          │
│                                 │
│   Start a new chat to begin     │
│                                 │
│   [+ New Chat]                  │
│                                 │
└─────────────────────────────────┘
```

### Search No Results

```
┌─────────────────────────────────┐
│  🔍 [search term        ] ×     │
│                                 │
│         🔍                      │
│                                 │
│   No results found              │
│                                 │
│   Try a different search term   │
│                                 │
└─────────────────────────────────┘
```

## Accessibility

- **Keyboard navigation**: Arrow keys to navigate, Enter to select
- **Focus management**: Focus first item on open, return focus on close
- **Screen reader**: Proper ARIA labels and roles
- **Reduced motion**: Disable drawer animations if preferred

```typescript
// ARIA attributes
<nav role="navigation" aria-label="Conversations">
  <ul role="listbox" aria-label="Session list">
    <li role="option" aria-selected={isActive}>
      {/* Session item */}
    </li>
  </ul>
</nav>
```
