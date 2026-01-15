# Notifications

Toast notifications, banners, and status updates for user feedback.

## Overview

The notification system provides feedback for:
- Action confirmations (copied, saved, deleted)
- Status updates (connecting, streaming, compacting)
- Errors and warnings
- Background events (new messages in remote sessions)

## Notification Types

### Toasts

Brief, non-blocking notifications that auto-dismiss:

```
┌─────────────────────────────────────────┐
│ ✓ Copied to clipboard                   │
└─────────────────────────────────────────┘
```

### Banners

Persistent notifications that require acknowledgment or action:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Connection lost. Attempting to reconnect...                   [Retry]  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Inline Alerts

Contextual notifications within specific UI areas:

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ API key required                                         │
│                                                             │
│ Add an Anthropic API key to use Claude models.             │
│                                                             │
│ [Add API Key]                                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Types

```typescript
interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration: number;          // ms, 0 = persistent
  action?: ToastAction;
  dismissible: boolean;
}

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Banner {
  id: string;
  type: BannerType;
  message: string;
  persistent: boolean;       // Requires manual dismissal
  action?: BannerAction;
  secondaryAction?: BannerAction;
}

type BannerType = 'info' | 'warning' | 'error' | 'success';

interface BannerAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}
```

## Toast Notifications

### Toast Variants

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| `success` | ✓ | Green | Action completed |
| `error` | ✕ | Red | Action failed |
| `warning` | ⚠️ | Yellow | Caution needed |
| `info` | ℹ️ | Blue | Information |
| `loading` | ●●● | Gray | In progress |

### Toast Positioning

**Desktop:** Bottom-right corner
```
                                    ┌──────────────────────┐
                                    │ ✓ Session saved      │
                                    └──────────────────────┘
```

**Mobile:** Bottom-center, above safe area
```
          ┌──────────────────────┐
          │ ✓ Copied             │
          └──────────────────────┘
           ─────────────────────── (safe area)
```

### Toast Stacking

Multiple toasts stack vertically:

```
                                    ┌──────────────────────┐
                                    │ ⚠️ Rate limited      │
                                    └──────────────────────┘
                                    ┌──────────────────────┐
                                    │ ✓ Message sent       │
                                    └──────────────────────┘
```

**Limits:**
- Maximum 5 visible toasts
- Oldest toast removed when limit exceeded
- Toasts animate in/out

### Toast API

```typescript
interface ToastService {
  show(options: ToastOptions): string;  // Returns toast ID
  success(message: string, options?: Partial<ToastOptions>): string;
  error(message: string, options?: Partial<ToastOptions>): string;
  warning(message: string, options?: Partial<ToastOptions>): string;
  info(message: string, options?: Partial<ToastOptions>): string;
  loading(message: string, options?: Partial<ToastOptions>): string;
  dismiss(id: string): void;
  dismissAll(): void;
  update(id: string, options: Partial<ToastOptions>): void;
}

interface ToastOptions {
  message: string;
  description?: string;
  type?: ToastType;
  duration?: number;         // Default: 3000ms
  action?: ToastAction;
  dismissible?: boolean;     // Default: true
}

// Usage
const toastId = toast.loading('Saving...');
await saveSession();
toast.update(toastId, { type: 'success', message: 'Saved!' });

// Or simpler
toast.success('Copied to clipboard');
toast.error('Failed to connect');
```

### Common Toast Messages

| Action | Message |
|--------|---------|
| Copy | "Copied to clipboard" |
| Save | "Session saved" |
| Delete | "Session deleted" |
| Model change | "Model: Claude Sonnet 4" |
| Thinking change | "Thinking: high" |
| Connect | "Connected to {server}" |
| Disconnect | "Disconnected" |
| Abort | "Response stopped" |
| Compact | "Context compacted" |

## Banners

### Banner Positioning

Always at top of main content area:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ You're offline. Changes will sync when connection is restored. [Dismiss]│
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                            [Chat Content]                                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Banner Variants

**Info Banner:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ℹ️ A new version is available.                              [Update Now]  │
└────────────────────────────────────────────────────────────────────────────┘
```

**Warning Banner:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Context is 90% full. Messages may be truncated.          [Compact Now] │
└────────────────────────────────────────────────────────────────────────────┘
```

**Error Banner:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ❌ Connection lost. Attempting to reconnect...             [Retry] [Cancel]│
└────────────────────────────────────────────────────────────────────────────┘
```

**Success Banner (rare):**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ✓ Reconnected successfully.                                     [Dismiss] │
└────────────────────────────────────────────────────────────────────────────┘
```

### Banner API

```typescript
interface BannerService {
  show(options: BannerOptions): string;
  dismiss(id: string): void;
  dismissAll(): void;
}

interface BannerOptions {
  id?: string;              // Dedupe by ID
  type: BannerType;
  message: string;
  persistent?: boolean;      // Default: false
  action?: BannerAction;
  secondaryAction?: BannerAction;
  onDismiss?: () => void;
}

// Usage
banner.show({
  type: 'warning',
  message: 'Connection lost. Attempting to reconnect...',
  persistent: true,
  action: { label: 'Retry', onClick: reconnect },
  secondaryAction: { label: 'Cancel', onClick: cancelReconnect },
});
```

### Common Banner Scenarios

| Scenario | Type | Message | Actions |
|----------|------|---------|---------|
| Offline | warning | "You're offline" | Dismiss |
| Reconnecting | warning | "Reconnecting..." (with spinner) | Retry, Cancel |
| Reconnected | success | "Reconnected" | Dismiss (auto) |
| Context full | warning | "Context 90% full" | Compact Now |
| Compacting | info | "Compacting context..." (with spinner) | - |
| Rate limited | warning | "Rate limited. Retrying in {n}s..." | Cancel |
| API key missing | error | "API key required" | Add Key |
| Version update | info | "New version available" | Update |

## Status Indicators

### Streaming Status

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [≡]  Session Title          ● Responding...        [Model] [⚙️]           │
└────────────────────────────────────────────────────────────────────────────┘
```

**States:**
- `● Responding...` (animated dot, streaming)
- `📦 Compacting...` (during compaction)
- `🔄 Retrying (2/3)...` (during retry)

### Connection Status

In sidebar header:

```
┌─────────────────────────────────────┐
│ 🟢 Work Laptop                      │ ← Connected
│ 🟡 Connecting...                    │ ← Connecting (pulsing)
│ 🔴 Disconnected                     │ ← Disconnected
│ ⚠️ Error                            │ ← Error state
└─────────────────────────────────────┘
```

## Notification Component

```typescript
interface NotificationContainerProps {
  toasts: Toast[];
  banners: Banner[];
}

function NotificationContainer({ toasts, banners }: NotificationContainerProps) {
  return (
    <>
      {/* Banners at top */}
      <div className="banner-container">
        {banners.map(banner => (
          <Banner key={banner.id} {...banner} />
        ))}
      </div>
      
      {/* Toasts at bottom */}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(toast => (
            <Toast key={toast.id} {...toast} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
```

### Toast Component

```typescript
interface ToastComponentProps extends Toast {
  onDismiss: () => void;
}

function ToastComponent({ 
  type, 
  message, 
  description, 
  action, 
  dismissible, 
  onDismiss 
}: ToastComponentProps) {
  return (
    <motion.div
      className={`toast toast-${type}`}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
    >
      <span className="toast-icon">{getIcon(type)}</span>
      <div className="toast-content">
        <p className="toast-message">{message}</p>
        {description && <p className="toast-description">{description}</p>}
      </div>
      {action && (
        <button className="toast-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
      {dismissible && (
        <button className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </motion.div>
  );
}
```

## Auto-Dismiss Logic

```typescript
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
  loading: 0,  // Persistent until updated
};

function useToastTimer(toast: Toast, onDismiss: () => void) {
  useEffect(() => {
    if (toast.duration === 0) return;
    
    const timer = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);
}
```

## Notification Deduplication

Prevent duplicate notifications:

```typescript
const activeToasts = new Map<string, string>();  // message -> toastId

function showToast(options: ToastOptions): string {
  // Check for duplicate
  if (options.dedupeKey) {
    const existing = activeToasts.get(options.dedupeKey);
    if (existing) {
      // Update existing toast
      return updateToast(existing, options);
    }
  }
  
  const id = generateId();
  activeToasts.set(options.dedupeKey ?? options.message, id);
  
  // Remove from map on dismiss
  const originalOnDismiss = options.onDismiss;
  options.onDismiss = () => {
    activeToasts.delete(options.dedupeKey ?? options.message);
    originalOnDismiss?.();
  };
  
  // Add toast
  addToast({ id, ...options });
  return id;
}
```

## Mobile Considerations

### Toast Sizing

```css
.toast {
  max-width: 400px;
  
  @media (max-width: 767px) {
    max-width: calc(100vw - 32px);
    margin: 0 16px;
  }
}
```

### Gesture Dismissal

```typescript
function ToastWithSwipe({ toast, onDismiss }: ToastProps) {
  const [, drag] = useDrag({
    onEnd: (offset) => {
      if (Math.abs(offset.x) > 100) {
        onDismiss();
      }
    },
  });
  
  return (
    <div ref={drag} className="toast">
      {/* content */}
    </div>
  );
}
```

### Banner on Mobile

Banners take full width and may be more compact:

```css
.banner {
  @media (max-width: 767px) {
    flex-wrap: wrap;
    padding: 8px 12px;
    
    .banner-actions {
      width: 100%;
      margin-top: 8px;
    }
  }
}
```

## Accessibility

### ARIA Live Regions

```typescript
function Toast({ message, type }: ToastProps) {
  return (
    <div
      role="status"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {message}
    </div>
  );
}
```

### Screen Reader Announcements

```typescript
function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcer = document.getElementById('announcer');
  if (!announcer) return;
  
  announcer.setAttribute('aria-live', priority);
  announcer.textContent = message;
  
  // Clear after announcement
  setTimeout(() => {
    announcer.textContent = '';
  }, 1000);
}
```

### Keyboard Dismissal

- `Escape` dismisses focused toast/banner
- `Tab` moves focus between toast actions
- Auto-focus on banner actions for important alerts

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .toast,
  .banner {
    animation: none;
    transition: none;
  }
}
```

## Notification Sounds (Future)

```typescript
interface NotificationSoundSettings {
  enabled: boolean;
  volume: number;  // 0-1
  sounds: {
    success: string | null;
    error: string | null;
    message: string | null;
  };
}

function playSound(type: ToastType): void {
  if (!settings.sounds.enabled) return;
  
  const soundUrl = settings.sounds[type];
  if (!soundUrl) return;
  
  const audio = new Audio(soundUrl);
  audio.volume = settings.sounds.volume;
  audio.play().catch(() => {});  // Ignore autoplay restrictions
}
```
