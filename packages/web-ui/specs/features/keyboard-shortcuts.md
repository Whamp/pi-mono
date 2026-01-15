# Keyboard Shortcuts

Global and contextual keyboard shortcuts for efficient navigation and actions.

## Overview

Keyboard shortcuts enable power users to navigate and interact with the UI without mouse/touch input. Shortcuts are:
- Platform-aware (Cmd on macOS, Ctrl on Windows/Linux)
- Context-sensitive (different behaviors based on focus)
- Discoverable (via help dialog)
- Customizable (future)

## Shortcut Reference

### Global Shortcuts

Available from anywhere in the app:

| Shortcut | macOS | Windows/Linux | Action |
|----------|-------|---------------|--------|
| New chat | `Cmd+N` | `Ctrl+N` | Create new session |
| Settings | `Cmd+,` | `Ctrl+,` | Open settings dialog |
| Model selector | `Cmd+K` | `Ctrl+K` | Open model picker |
| Toggle sidebar | `Cmd+B` | `Ctrl+B` | Show/hide sidebar |
| Toggle artifacts | `Cmd+.` | `Ctrl+.` | Show/hide artifacts panel |
| Cycle model | `Cmd+Shift+M` | `Ctrl+Shift+M` | Next model |
| Cycle thinking | `Cmd+Shift+T` | `Ctrl+Shift+T` | Next thinking level |
| Toggle theme | `Cmd+Shift+L` | `Ctrl+Shift+L` | Light/dark mode |
| Help | `Cmd+/` | `Ctrl+/` | Show keyboard shortcuts |
| Close dialog | `Escape` | `Escape` | Close active modal/dialog |

### Input Area Shortcuts

When message input is focused:

| Shortcut | macOS | Windows/Linux | Action |
|----------|-------|---------------|--------|
| Send message | `Enter` | `Enter` | Submit message |
| New line | `Shift+Enter` | `Shift+Enter` | Insert line break |
| Steer (streaming) | `Cmd+Enter` | `Ctrl+Enter` | Queue interrupting message |
| Follow-up (streaming) | `Alt+Enter` | `Alt+Enter` | Queue waiting message |
| Stop | `Escape` | `Escape` | Abort streaming |
| Clear input | `Cmd+Shift+Backspace` | `Ctrl+Shift+Backspace` | Clear message text |
| Focus input | `Cmd+J` | `Ctrl+J` | Focus message input |
| Upload file | `Cmd+U` | `Ctrl+U` | Open file picker |

### Chat Area Shortcuts

When chat area is focused:

| Shortcut | macOS | Windows/Linux | Action |
|----------|-------|---------------|--------|
| Find in chat | `Cmd+F` | `Ctrl+F` | Open find bar |
| Copy last response | `Cmd+Shift+C` | `Ctrl+Shift+C` | Copy assistant's last message |
| Scroll to bottom | `Cmd+↓` | `Ctrl+End` | Jump to latest message |
| Scroll to top | `Cmd+↑` | `Ctrl+Home` | Jump to first message |
| Focus input | `Tab` | `Tab` | Move focus to input |

### Sidebar Shortcuts

When sidebar is focused:

| Shortcut | macOS | Windows/Linux | Action |
|----------|-------|---------------|--------|
| Navigate up | `↑` | `↑` | Previous session |
| Navigate down | `↓` | `↓` | Next session |
| Select session | `Enter` | `Enter` | Open selected session |
| Delete session | `Backspace` | `Delete` | Delete (with confirm) |
| Search | `/` | `/` | Focus search input |

### Find Bar Shortcuts

When find bar is open:

| Shortcut | macOS | Windows/Linux | Action |
|----------|-------|---------------|--------|
| Next match | `Enter` or `F3` | `Enter` or `F3` | Go to next match |
| Previous match | `Shift+Enter` or `Shift+F3` | `Shift+Enter` or `Shift+F3` | Go to previous match |
| Toggle case | `Alt+C` | `Alt+C` | Toggle case sensitivity |
| Toggle regex | `Alt+R` | `Alt+R` | Toggle regex mode |
| Close | `Escape` | `Escape` | Close find bar |

### Artifacts Panel Shortcuts

When artifacts panel is focused:

| Shortcut | macOS | Windows/Linux | Action |
|----------|-------|---------------|--------|
| Previous tab | `Cmd+Shift+[` | `Ctrl+Shift+[` | Previous artifact |
| Next tab | `Cmd+Shift+]` | `Ctrl+Shift+]` | Next artifact |
| Close tab | `Cmd+W` | `Ctrl+W` | Close current artifact |
| Toggle fullscreen | `Cmd+Shift+F` | `Ctrl+Shift+F` | Fullscreen artifact |
| Copy content | `Cmd+Shift+C` | `Ctrl+Shift+C` | Copy artifact source |
| Download | `Cmd+S` | `Ctrl+S` | Download artifact |

### Dialog Shortcuts

When a dialog is open:

| Shortcut | Action |
|----------|--------|
| `Escape` | Cancel/close dialog |
| `Enter` | Confirm primary action |
| `Tab` | Next focusable element |
| `Shift+Tab` | Previous focusable element |

## Implementation

### Shortcut Registry

```typescript
interface Shortcut {
  id: string;
  key: string;                    // Key without modifiers
  modifiers: Modifier[];          // ['cmd', 'shift', etc.]
  action: () => void;
  description: string;
  category: ShortcutCategory;
  context?: ShortcutContext;      // Required focus context
  when?: () => boolean;           // Condition for availability
}

type Modifier = 'cmd' | 'ctrl' | 'alt' | 'shift' | 'meta';
type ShortcutCategory = 'global' | 'input' | 'chat' | 'sidebar' | 'artifacts' | 'dialog';
type ShortcutContext = 'input' | 'chat' | 'sidebar' | 'artifacts' | 'dialog' | 'any';

const shortcuts: Shortcut[] = [
  {
    id: 'new-chat',
    key: 'n',
    modifiers: ['cmd'],
    action: createNewSession,
    description: 'Create new chat',
    category: 'global',
  },
  {
    id: 'send-message',
    key: 'Enter',
    modifiers: [],
    action: sendMessage,
    description: 'Send message',
    category: 'input',
    context: 'input',
    when: () => !isStreaming,
  },
  // ...
];
```

### Event Handler

```typescript
function handleKeyDown(e: KeyboardEvent): void {
  const shortcut = findMatchingShortcut(e);
  if (!shortcut) return;
  
  // Check context
  if (shortcut.context && shortcut.context !== currentContext) return;
  
  // Check condition
  if (shortcut.when && !shortcut.when()) return;
  
  // Prevent default and execute
  e.preventDefault();
  shortcut.action();
}

function findMatchingShortcut(e: KeyboardEvent): Shortcut | null {
  const key = e.key.toLowerCase();
  const modifiers = getActiveModifiers(e);
  
  return shortcuts.find(s => 
    s.key.toLowerCase() === key &&
    modifiersMatch(s.modifiers, modifiers)
  ) ?? null;
}

function getActiveModifiers(e: KeyboardEvent): Modifier[] {
  const mods: Modifier[] = [];
  if (e.metaKey || e.ctrlKey) mods.push('cmd');  // Normalize meta/ctrl
  if (e.altKey) mods.push('alt');
  if (e.shiftKey) mods.push('shift');
  return mods;
}
```

### Platform Detection

```typescript
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  
  for (const mod of shortcut.modifiers) {
    switch (mod) {
      case 'cmd':
        parts.push(isMac ? '⌘' : 'Ctrl');
        break;
      case 'alt':
        parts.push(isMac ? '⌥' : 'Alt');
        break;
      case 'shift':
        parts.push(isMac ? '⇧' : 'Shift');
        break;
      case 'ctrl':
        parts.push(isMac ? '⌃' : 'Ctrl');
        break;
    }
  }
  
  parts.push(formatKey(shortcut.key));
  return parts.join(isMac ? '' : '+');
}

function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    'Enter': '↵',
    'Escape': 'Esc',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Backspace': '⌫',
    'Delete': 'Del',
    'Tab': '⇥',
  };
  return keyMap[key] ?? key.toUpperCase();
}
```

## Help Dialog

Display all available shortcuts:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Keyboard Shortcuts                                                   [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Global                                                                    │
│  ─────────────────────────────────────────────────────────────────────    │
│  ⌘N          New chat                                                     │
│  ⌘,          Open settings                                                │
│  ⌘K          Model selector                                               │
│  ⌘B          Toggle sidebar                                               │
│  ⌘.          Toggle artifacts                                             │
│  ⌘⇧M         Cycle model                                                  │
│  ⌘⇧T         Cycle thinking level                                         │
│                                                                            │
│  Messaging                                                                 │
│  ─────────────────────────────────────────────────────────────────────    │
│  ↵           Send message                                                 │
│  ⇧↵          New line                                                     │
│  ⌘↵          Steer (during streaming)                                     │
│  ⌥↵          Follow-up (during streaming)                                 │
│  Esc         Stop / Cancel                                                │
│                                                                            │
│  Search                                                                    │
│  ─────────────────────────────────────────────────────────────────────    │
│  ⌘F          Find in conversation                                         │
│  ↵ / F3      Next match                                                   │
│  ⇧↵ / ⇧F3    Previous match                                               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Help Dialog Component

```typescript
interface ShortcutsHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

function ShortcutsHelpDialog({ open, onClose }: ShortcutsHelpDialogProps) {
  const groupedShortcuts = useMemo(() => {
    return groupBy(shortcuts, s => s.category);
  }, []);
  
  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader title="Keyboard Shortcuts" />
      <DialogContent>
        {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
          <section key={category}>
            <h3>{formatCategoryName(category)}</h3>
            <table>
              {shortcuts.map(s => (
                <tr key={s.id}>
                  <td><kbd>{formatShortcut(s)}</kbd></td>
                  <td>{s.description}</td>
                </tr>
              ))}
            </table>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
```

## Focus Management

### Context Tracking

```typescript
type FocusContext = 'input' | 'chat' | 'sidebar' | 'artifacts' | 'dialog' | 'none';

const [focusContext, setFocusContext] = useState<FocusContext>('none');

// Track focus changes
useEffect(() => {
  function handleFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement;
    
    if (target.closest('[data-context="input"]')) {
      setFocusContext('input');
    } else if (target.closest('[data-context="chat"]')) {
      setFocusContext('chat');
    } else if (target.closest('[data-context="sidebar"]')) {
      setFocusContext('sidebar');
    } else if (target.closest('[data-context="artifacts"]')) {
      setFocusContext('artifacts');
    } else if (target.closest('[role="dialog"]')) {
      setFocusContext('dialog');
    } else {
      setFocusContext('none');
    }
  }
  
  document.addEventListener('focusin', handleFocusIn);
  return () => document.removeEventListener('focusin', handleFocusIn);
}, []);
```

### Focus Restoration

```typescript
const focusHistory = useRef<HTMLElement[]>([]);

function pushFocus(element: HTMLElement): void {
  focusHistory.current.push(element);
}

function popFocus(): void {
  const lastFocused = focusHistory.current.pop();
  lastFocused?.focus();
}

// Example: Restore focus after dialog closes
useEffect(() => {
  if (dialogOpen) {
    pushFocus(document.activeElement as HTMLElement);
  } else {
    popFocus();
  }
}, [dialogOpen]);
```

## Conflict Prevention

### Input Field Detection

```typescript
function shouldIgnoreShortcut(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  
  // Ignore in editable fields (unless it's a registered shortcut)
  if (target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable) {
    // Only allow shortcuts with modifiers
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      return true;
    }
  }
  
  return false;
}
```

### Browser Shortcut Conflicts

Some shortcuts conflict with browser defaults:

| Shortcut | Browser Default | Our Action | Resolution |
|----------|-----------------|------------|------------|
| `Cmd+N` | New window | New chat | Override |
| `Cmd+W` | Close tab | Close artifact | Override in artifacts context only |
| `Cmd+S` | Save page | Download artifact | Override |
| `Cmd+F` | Find in page | Find in chat | Override |

```typescript
// Prevent browser defaults for our shortcuts
function handleKeyDown(e: KeyboardEvent): void {
  const shortcut = findMatchingShortcut(e);
  if (shortcut) {
    e.preventDefault();
    e.stopPropagation();
    shortcut.action();
  }
}
```

## Mobile Considerations

Most shortcuts are desktop-only, but some work with external keyboards:

```typescript
const mobileShortcuts = shortcuts.filter(s => 
  s.category === 'global' || s.category === 'dialog'
);

// Detect external keyboard
const hasKeyboard = useRef(false);

useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Assume external keyboard if modifier keys are used
    if (e.metaKey || e.ctrlKey) {
      hasKeyboard.current = true;
    }
  }
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

## Accessibility

### Screen Reader Announcements

```typescript
function announceShortcut(shortcut: Shortcut): void {
  announce(`${shortcut.description} activated`);
}
```

### Shortcut Discovery

- Help dialog accessible via `Cmd+/` or menu
- Tooltips show shortcuts for buttons
- Context menus include shortcut hints

```typescript
interface TooltipProps {
  content: string;
  shortcut?: string;
}

// Tooltip content: "Copy message (⌘C)"
```

### Focus Indicators

Ensure visible focus for keyboard navigation:

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Custom focus styles for specific elements */
.button:focus-visible {
  box-shadow: 0 0 0 3px var(--color-accent-ring);
}
```

## Future: Custom Shortcuts

```typescript
interface CustomShortcut extends Shortcut {
  isCustom: true;
  defaultKey: string;
  defaultModifiers: Modifier[];
}

interface ShortcutSettings {
  customizations: Record<string, {
    key: string;
    modifiers: Modifier[];
  }>;
  disabled: string[];  // Shortcut IDs
}

function loadCustomShortcuts(): void {
  const settings = storage.settings.get('shortcuts');
  
  for (const [id, custom] of Object.entries(settings.customizations)) {
    const shortcut = shortcuts.find(s => s.id === id);
    if (shortcut) {
      shortcut.key = custom.key;
      shortcut.modifiers = custom.modifiers;
    }
  }
  
  // Remove disabled shortcuts
  shortcuts = shortcuts.filter(s => !settings.disabled.includes(s.id));
}
```
