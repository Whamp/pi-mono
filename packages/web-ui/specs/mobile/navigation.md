# Mobile Navigation

Touch gestures, navigation patterns, and mobile-specific interactions.

## Overview

Mobile navigation emphasizes:
- Gesture-based interactions
- Single-handed usability
- Quick access to common actions
- Predictable drawer/panel behavior

## Gesture System

### Core Gestures

| Gesture | Location | Action |
|---------|----------|--------|
| Swipe right | Left edge (20px) | Open sidebar |
| Swipe left | Open sidebar | Close sidebar |
| Swipe left | Right edge (20px) | Open artifacts |
| Swipe right | Open artifacts | Close artifacts |
| Pull down | Top of chat (at top) | Refresh (remote mode) |
| Swipe left | Session item | Reveal delete |
| Tap | Backdrop | Close overlay |
| Long press | Message | Show context menu |
| Pinch | Image/artifact | Zoom |
| Double tap | Artifact | Toggle fullscreen |

### Gesture Implementation

```typescript
interface GestureConfig {
  direction: 'horizontal' | 'vertical';
  threshold: number;          // Minimum distance in px
  velocityThreshold: number;  // Minimum velocity in px/ms
  edgeWidth?: number;         // Edge gesture trigger zone
}

const EDGE_GESTURE_CONFIG: GestureConfig = {
  direction: 'horizontal',
  threshold: 50,
  velocityThreshold: 0.3,
  edgeWidth: 20,
};

function useEdgeGesture(
  side: 'left' | 'right',
  onGesture: () => void,
  config: GestureConfig = EDGE_GESTURE_CONFIG
) {
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  
  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    const edgeZone = side === 'left' 
      ? touch.clientX < config.edgeWidth!
      : touch.clientX > window.innerWidth - config.edgeWidth!;
    
    if (edgeZone) {
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    }
  }
  
  function handleTouchEnd(e: TouchEvent) {
    if (!touchStart.current) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const deltaTime = Date.now() - touchStart.current.time;
    
    // Check if horizontal swipe
    if (Math.abs(deltaX) < Math.abs(deltaY)) {
      touchStart.current = null;
      return;
    }
    
    const distance = Math.abs(deltaX);
    const velocity = distance / deltaTime;
    
    const correctDirection = side === 'left' ? deltaX > 0 : deltaX < 0;
    
    if (correctDirection && 
        (distance > config.threshold || velocity > config.velocityThreshold)) {
      onGesture();
    }
    
    touchStart.current = null;
  }
  
  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);
}
```

### Gesture Feedback

Visual feedback during gestures:

```css
/* Sidebar peek during edge swipe */
.sidebar-peek {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--color-accent);
  opacity: 0;
  transition: opacity 0.15s;
}

.sidebar-peek.active {
  opacity: 1;
}

/* Drawer progress indicator */
.drawer-progress {
  transform: translateX(calc(var(--progress) * 100% - 100%));
  transition: transform 0.05s;
}
```

## Drawer Panels

### Sidebar Drawer

```typescript
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  width: number;
  children: ReactNode;
}

function Drawer({ open, onClose, side, width, children }: DrawerProps) {
  const [progress, setProgress] = useState(0);
  
  // Handle drag to close
  function handleDrag(delta: number) {
    const maxDelta = width;
    const newProgress = Math.max(0, Math.min(1, 1 - Math.abs(delta) / maxDelta));
    setProgress(newProgress);
  }
  
  function handleDragEnd(velocity: number) {
    if (progress < 0.5 || velocity > 0.5) {
      onClose();
    } else {
      setProgress(1);
    }
  }
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`drawer-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        style={{ opacity: open ? 0.5 * progress : 0 }}
      />
      
      {/* Drawer */}
      <div
        className={`drawer drawer-${side}`}
        style={{
          transform: open 
            ? `translateX(${side === 'left' ? 0 : 0})`
            : `translateX(${side === 'left' ? '-100%' : '100%'})`,
          width,
        }}
      >
        {/* Drag handle */}
        <div className="drawer-handle" />
        {children}
      </div>
    </>
  );
}
```

### Drawer Animations

```css
.drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: var(--z-sidebar);
  background: var(--color-background);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.drawer-left {
  left: 0;
  border-right: 1px solid var(--color-border);
}

.drawer-right {
  right: 0;
  border-left: 1px solid var(--color-border);
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: black;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  z-index: calc(var(--z-sidebar) - 1);
}

.drawer-backdrop.open {
  pointer-events: auto;
}

/* Drawer handle for drag gesture */
.drawer-handle {
  position: absolute;
  top: 50%;
  width: 4px;
  height: 40px;
  border-radius: 2px;
  background: var(--color-border);
  transform: translateY(-50%);
}

.drawer-left .drawer-handle {
  right: -12px;
}

.drawer-right .drawer-handle {
  left: -12px;
}
```

## Bottom Navigation (Future)

For quick access to main sections:

```
┌─────────────────────────────────────┐
│                                     │
│             Chat Area               │
│                                     │
├─────────────────────────────────────┤
│    📝        💬        ⚙️          │
│   Chats     Chat    Settings       │
│   (list)   (current)  (menu)       │
└─────────────────────────────────────┘
```

### Bottom Nav Component

```typescript
interface BottomNavItem {
  id: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}

function BottomNav({ items, active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button
          key={item.id}
          className={`bottom-nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <span className="bottom-nav-icon">
            {item.icon}
            {item.badge && <span className="badge">{item.badge}</span>}
          </span>
          <span className="bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

```css
.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 56px;
  padding-bottom: var(--safe-area-bottom);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  color: var(--color-text-secondary);
}

.bottom-nav-item.active {
  color: var(--color-accent);
}

.bottom-nav-label {
  font-size: 12px;
}
```

## Context Menus

### Long Press Menu

```typescript
function useLongPress(callback: () => void, delay = 500) {
  const timeoutRef = useRef<number>();
  const targetRef = useRef<EventTarget>();
  
  function handleTouchStart(e: TouchEvent) {
    targetRef.current = e.target;
    timeoutRef.current = window.setTimeout(() => {
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
      callback();
    }, delay);
  }
  
  function handleTouchEnd() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }
  
  function handleTouchMove(e: TouchEvent) {
    // Cancel if moved too far
    if (e.target !== targetRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }
  
  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
  };
}
```

### Context Menu Display

```
┌─────────────────────────────────────┐
│                                     │
│   [Message content...]              │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ 📋 Copy                     │   │
│   ├─────────────────────────────┤   │
│   │ 🔄 Regenerate               │   │
│   ├─────────────────────────────┤   │
│   │ ✂️ Fork from here           │   │
│   ├─────────────────────────────┤   │
│   │ 🗑️ Delete                   │   │
│   └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### Action Sheet

Bottom-aligned context menu for iOS-style interaction:

```typescript
interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionSheetAction[];
}

interface ActionSheetAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

function ActionSheet({ open, onClose, title, actions }: ActionSheetProps) {
  return (
    <div className={`action-sheet ${open ? 'open' : ''}`}>
      <div className="action-sheet-backdrop" onClick={onClose} />
      <div className="action-sheet-content">
        <div className="action-sheet-handle" />
        {title && <div className="action-sheet-title">{title}</div>}
        {actions.map((action, i) => (
          <button
            key={i}
            className={`action-sheet-item ${action.variant ?? ''}`}
            onClick={() => {
              action.onClick();
              onClose();
            }}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
        <button className="action-sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
```

```css
.action-sheet {
  position: fixed;
  inset: 0;
  z-index: var(--z-dialog);
  pointer-events: none;
}

.action-sheet.open {
  pointer-events: auto;
}

.action-sheet-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-surface);
  border-radius: 16px 16px 0 0;
  padding-bottom: var(--safe-area-bottom);
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-sheet.open .action-sheet-content {
  transform: translateY(0);
}

.action-sheet-handle {
  width: 40px;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  margin: 8px auto;
}

.action-sheet-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.action-sheet-item.destructive {
  color: var(--color-error);
}

.action-sheet-cancel {
  width: 100%;
  padding: 16px;
  font-weight: 600;
  color: var(--color-accent);
}
```

## Swipe Actions

### Swipe to Delete

```typescript
interface SwipeActionsProps {
  children: ReactNode;
  actions: SwipeAction[];
}

interface SwipeAction {
  icon: ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}

function SwipeActions({ children, actions }: SwipeActionsProps) {
  const [offset, setOffset] = useState(0);
  const actionWidth = 80;
  const maxOffset = actions.length * actionWidth;
  
  function handleDrag(delta: number) {
    const newOffset = Math.min(Math.max(-delta, 0), maxOffset);
    setOffset(newOffset);
  }
  
  function handleDragEnd(velocity: number) {
    if (offset > maxOffset / 2 || velocity > 0.5) {
      setOffset(maxOffset);
    } else {
      setOffset(0);
    }
  }
  
  return (
    <div className="swipe-container">
      <div className="swipe-actions">
        {actions.map((action, i) => (
          <button
            key={i}
            className="swipe-action"
            style={{ backgroundColor: action.color }}
            onClick={action.onClick}
          >
            {action.icon}
          </button>
        ))}
      </div>
      <div
        className="swipe-content"
        style={{ transform: `translateX(-${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
```

```css
.swipe-container {
  position: relative;
  overflow: hidden;
}

.swipe-actions {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
}

.swipe-action {
  width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.swipe-content {
  position: relative;
  background: var(--color-background);
  transition: transform 0.2s;
}
```

## Header More Menu

Mobile header uses condensed menu:

```
[≡]  Session Title             [⋮]
                                │
                                ▼
                    ┌──────────────────┐
                    │ ✏️ Rename        │
                    │ 📤 Export        │
                    │ 🗑️ Delete        │
                    │ ───────────────  │
                    │ 🤖 Change Model  │
                    │ 🧠 Thinking: M   │
                    │ ───────────────  │
                    │ ⚙️ Settings      │
                    │ + New Chat       │
                    └──────────────────┘
```

### Dropdown Menu

```typescript
interface DropdownMenuProps {
  trigger: ReactNode;
  items: MenuItem[];
}

interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  divider?: boolean;
}

function DropdownMenu({ trigger, items }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close on outside click
  useEffect(() => {
    if (!open) return;
    
    function handleClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);
  
  return (
    <div className="dropdown" ref={menuRef}>
      <button className="dropdown-trigger" onClick={() => setOpen(!open)}>
        {trigger}
      </button>
      {open && (
        <div className="dropdown-menu">
          {items.map((item, i) => (
            <Fragment key={i}>
              {item.divider && <div className="dropdown-divider" />}
              <button
                className="dropdown-item"
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
              >
                {item.icon}
                {item.label}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Navigation State Management

```typescript
interface MobileNavigationState {
  sidebarOpen: boolean;
  artifactsOpen: boolean;
  activeSheet: string | null;
  activeModal: string | null;
}

const navigationReducer = (
  state: MobileNavigationState,
  action: NavigationAction
): MobileNavigationState => {
  switch (action.type) {
    case 'OPEN_SIDEBAR':
      return { ...state, sidebarOpen: true, artifactsOpen: false };
    case 'CLOSE_SIDEBAR':
      return { ...state, sidebarOpen: false };
    case 'OPEN_ARTIFACTS':
      return { ...state, artifactsOpen: true, sidebarOpen: false };
    case 'CLOSE_ARTIFACTS':
      return { ...state, artifactsOpen: false };
    case 'SHOW_SHEET':
      return { ...state, activeSheet: action.sheetId };
    case 'HIDE_SHEET':
      return { ...state, activeSheet: null };
    case 'SHOW_MODAL':
      return { ...state, activeModal: action.modalId };
    case 'HIDE_MODAL':
      return { ...state, activeModal: null };
    case 'CLOSE_ALL':
      return {
        sidebarOpen: false,
        artifactsOpen: false,
        activeSheet: null,
        activeModal: null,
      };
    default:
      return state;
  }
};
```

### Back Button Handling

```typescript
function useBackButton(onBack: () => boolean) {
  useEffect(() => {
    function handlePopState(e: PopStateEvent) {
      if (onBack()) {
        // Prevented navigation, push state back
        history.pushState(null, '', window.location.href);
      }
    }
    
    // Push initial state
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBack]);
}

// Usage
useBackButton(() => {
  if (artifactsOpen) {
    closeArtifacts();
    return true;  // Handled
  }
  if (sidebarOpen) {
    closeSidebar();
    return true;
  }
  return false;  // Let browser handle
});
```

## Haptic Feedback

```typescript
function useHaptics() {
  return {
    light: () => navigator.vibrate?.(10),
    medium: () => navigator.vibrate?.(15),
    heavy: () => navigator.vibrate?.(25),
    success: () => navigator.vibrate?.([10, 50, 10]),
    error: () => navigator.vibrate?.([50, 30, 50]),
  };
}

// Usage
const haptics = useHaptics();
haptics.light();  // On button press
haptics.success();  // On action complete
```

## Accessibility

### Touch Accessibility

- Minimum 44×44px touch targets
- 8px minimum spacing between targets
- Clear visual feedback on touch
- Support for VoiceOver/TalkBack gestures

### Gesture Alternatives

All gesture-based actions have alternatives:
- Swipe to delete → Long press → Delete option
- Edge swipe for sidebar → Menu button
- Pull to refresh → Refresh button in header

### Screen Reader Navigation

```typescript
// Announce navigation changes
function announceNavigation(destination: string) {
  announce(`Navigated to ${destination}`);
}

// Describe gestures
<button
  aria-label="Open sidebar. You can also swipe right from the left edge."
  onClick={openSidebar}
>
  ≡
</button>
```
