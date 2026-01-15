# Mobile Layout

Responsive design specifications for mobile and tablet devices.

## Overview

Pi Web UI is designed mobile-first, with desktop as a secondary but fully-supported platform. The mobile layout prioritizes:
- Single-column focus
- Touch-friendly interactions
- Space efficiency
- Readable typography
- Safe area handling

## Breakpoints

```css
:root {
  /* Mobile first - no breakpoint for base mobile */
  --breakpoint-sm: 640px;   /* Large phones / small tablets */
  --breakpoint-md: 768px;   /* Tablets portrait */
  --breakpoint-lg: 1024px;  /* Tablets landscape / small laptops */
  --breakpoint-xl: 1280px;  /* Desktops */
  --breakpoint-2xl: 1536px; /* Large desktops */
}

/* Usage */
@media (min-width: 768px) { /* Tablet and up */ }
@media (min-width: 1024px) { /* Desktop and up */ }
```

### Device Categories

| Category | Width | Layout |
|----------|-------|--------|
| Phone Portrait | < 640px | Single column, bottom nav |
| Phone Landscape | 640px - 767px | Single column, expanded |
| Tablet Portrait | 768px - 1023px | Single column, drawer panels |
| Tablet Landscape | 1024px - 1279px | Sidebar visible, drawer artifacts |
| Desktop | 1280px+ | Three-column layout |

## Layout Modes

### Phone Layout (< 768px)

```
┌─────────────────────────────────────┐
│ [≡]  Session Title          [⋮]    │ ← Fixed header (48px)
├─────────────────────────────────────┤
│                                     │
│                                     │
│             Chat Area               │ ← Scrollable
│           (full width)              │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ [📎] [Message input...      ] [➤]  │ ← Sticky input
│        ─────────────────────────    │ ← Home indicator
└─────────────────────────────────────┘
```

**Panels as overlays:**
- Sidebar: Full-screen overlay from left
- Artifacts: Full-screen overlay from right
- Settings: Full-screen modal

### Tablet Portrait Layout (768px - 1023px)

```
┌─────────────────────────────────────────────────┐
│ [≡]  Session Title        [Model]  [⚙️]        │
├─────────────────────────────────────────────────┤
│                                                 │
│                  Chat Area                      │
│                 (centered)                      │
│                                                 │
├─────────────────────────────────────────────────┤
│ [📎] [Message input...              ] [➤]      │
└─────────────────────────────────────────────────┘

Sidebar: Drawer from left (280px)
Artifacts: Drawer from right (400px)
```

### Tablet Landscape Layout (1024px - 1279px)

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────────────────────────────────┐  │
│  │              │  │                Header                    │  │
│  │              │  ├──────────────────────────────────────────┤  │
│  │   Sidebar    │  │                                          │  │
│  │   (280px)    │  │              Chat Area                   │  │
│  │   visible    │  │                                          │  │
│  │              │  ├──────────────────────────────────────────┤  │
│  │              │  │              Input Area                  │  │
│  └──────────────┘  └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

Artifacts: Drawer from right (400px)
```

## Safe Areas

Handle device notches, rounded corners, and home indicators.

### CSS Implementation

```css
:root {
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-right: env(safe-area-inset-right);
  --safe-area-bottom: env(safe-area-inset-bottom);
  --safe-area-left: env(safe-area-inset-left);
}

.app-container {
  padding-top: var(--safe-area-top);
  padding-left: var(--safe-area-left);
  padding-right: var(--safe-area-right);
}

.input-area {
  padding-bottom: calc(var(--safe-area-bottom) + 8px);
}

.header {
  padding-top: calc(var(--safe-area-top) + 8px);
}
```

### Landscape Orientation

```css
@media (orientation: landscape) and (max-height: 500px) {
  /* Compact mode for phones in landscape */
  .header {
    height: 40px;
  }
  
  .input-area {
    padding: 4px 8px;
  }
}
```

## Touch Target Sizes

Minimum touch target: 44×44px (Apple HIG), 48×48dp (Material)

```css
:root {
  --touch-target-min: 44px;
  --touch-target-comfortable: 48px;
}

.button,
.icon-button {
  min-width: var(--touch-target-min);
  min-height: var(--touch-target-min);
  padding: 8px;
}

/* Larger for primary actions */
.button-primary {
  min-height: var(--touch-target-comfortable);
  padding: 12px 24px;
}
```

### Touch Target Spacing

```css
.button-group {
  gap: 8px;  /* Minimum 8px between touch targets */
}

.list-item {
  min-height: 48px;
  padding: 12px 16px;
}
```

## Typography Scaling

### Base Font Size

```css
:root {
  --font-size-base: 16px;  /* Minimum readable on mobile */
  
  @media (min-width: 768px) {
    --font-size-base: 15px;  /* Slightly smaller on tablets */
  }
  
  @media (min-width: 1024px) {
    --font-size-base: 14px;  /* Compact on desktop */
  }
}
```

### Message Typography

```css
.message-content {
  font-size: 16px;
  line-height: 1.5;
  
  @media (min-width: 1024px) {
    font-size: 15px;
    line-height: 1.6;
  }
}

.code-block {
  font-size: 14px;
  
  @media (max-width: 767px) {
    font-size: 13px;  /* Slightly smaller to fit code */
  }
}
```

## Viewport Handling

### Dynamic Viewport Height

```css
.app-container {
  height: 100dvh;  /* Dynamic viewport height */
  height: 100vh;   /* Fallback */
}
```

### Virtual Keyboard Handling

```typescript
function useViewportHeight() {
  useEffect(() => {
    if (!window.visualViewport) return;
    
    function handleResize() {
      const vh = window.visualViewport.height;
      document.documentElement.style.setProperty('--viewport-height', `${vh}px`);
    }
    
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    
    return () => {
      window.visualViewport.removeEventListener('resize', handleResize);
      window.visualViewport.removeEventListener('scroll', handleResize);
    };
  }, []);
}
```

```css
.app-container {
  height: var(--viewport-height, 100dvh);
}
```

### Input Focus Behavior

```typescript
function handleInputFocus() {
  // Scroll chat to keep latest message visible
  setTimeout(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, 300);  // Wait for keyboard animation
}
```

## Scroll Behavior

### Chat Scroll

```css
.chat-messages {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;  /* Momentum scrolling on iOS */
  overscroll-behavior-y: contain;     /* Prevent page scroll when at top/bottom */
}
```

### Pull to Refresh (Remote Mode)

```typescript
function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState(0);
  
  function handleTouchStart(e: TouchEvent) {
    if (scrollTop !== 0) return;
    initialY.current = e.touches[0].clientY;
  }
  
  function handleTouchMove(e: TouchEvent) {
    if (initialY.current === null) return;
    
    const delta = e.touches[0].clientY - initialY.current;
    if (delta > 0) {
      setProgress(Math.min(delta / THRESHOLD, 1));
      setPulling(true);
    }
  }
  
  async function handleTouchEnd() {
    if (progress >= 1) {
      await onRefresh();
    }
    setPulling(false);
    setProgress(0);
  }
  
  return { pulling, progress };
}
```

## Orientation Changes

```typescript
function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  );
  
  useEffect(() => {
    function handleResize() {
      setOrientation(
        window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
      );
    }
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);
  
  return orientation;
}
```

### Layout Adjustments

```css
/* Phone landscape - hide some elements */
@media (max-height: 500px) and (orientation: landscape) {
  .header-subtitle,
  .model-badge-details {
    display: none;
  }
  
  .message {
    padding: 8px;
  }
}
```

## Component Adaptations

### Header (Mobile)

```css
.header {
  @media (max-width: 767px) {
    height: 48px;
    padding: 0 8px;
    
    .header-title {
      font-size: 16px;
      max-width: 60%;
    }
    
    .header-actions {
      gap: 4px;
    }
    
    /* Hide some elements */
    .model-badge-full,
    .thinking-badge {
      display: none;
    }
  }
}
```

### Messages (Mobile)

```css
.message {
  @media (max-width: 767px) {
    max-width: 100%;
    margin: 8px 0;
    
    .message-content {
      padding: 12px;
    }
    
    .message-actions {
      opacity: 1;  /* Always visible on touch devices */
    }
  }
}
```

### Input Area (Mobile)

```css
.input-area {
  @media (max-width: 767px) {
    padding: 8px;
    
    .message-input {
      font-size: 16px;  /* Prevents zoom on iOS */
      padding: 10px 44px;
    }
    
    .attachment-previews {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
  }
}
```

## Performance Optimizations

### Reduce Repaints

```css
/* Use transform instead of position for animations */
.sidebar {
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  will-change: transform;
}

.sidebar.open {
  transform: translateX(0);
}
```

### Lazy Loading

```typescript
// Lazy load heavy components on mobile
const ArtifactViewer = lazy(() => import('./ArtifactViewer'));
const SettingsDialog = lazy(() => import('./SettingsDialog'));
```

### Virtualization

```typescript
// Use virtual scrolling for long message lists
function MessageList({ messages }: { messages: Message[] }) {
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => estimateMessageHeight(messages[index]),
    overscan: 3,
  });
  
  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map(virtualRow => (
          <Message
            key={messages[virtualRow.index].id}
            message={messages[virtualRow.index]}
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

## Accessibility

### Touch Accessibility

```css
/* Larger touch targets for accessibility settings */
@media (pointer: coarse) {
  .button {
    min-height: 48px;
  }
  
  .link {
    padding: 8px;
    margin: -8px;  /* Invisible padding */
  }
}
```

### Focus Visibility

```css
/* Show focus only for keyboard navigation */
:focus:not(:focus-visible) {
  outline: none;
}

:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .sidebar,
  .artifacts-panel {
    transition: none;
  }
}
```

## Testing Considerations

### Device Testing Matrix

| Device | Screen | Resolution | Priority |
|--------|--------|------------|----------|
| iPhone SE | 4.7" | 375×667 | High |
| iPhone 14 Pro | 6.1" | 393×852 | High |
| iPhone 14 Pro Max | 6.7" | 430×932 | Medium |
| iPad Mini | 8.3" | 744×1133 | Medium |
| iPad Pro 11" | 11" | 834×1194 | Medium |
| iPad Pro 12.9" | 12.9" | 1024×1366 | Low |
| Samsung Galaxy S23 | 6.1" | 360×780 | High |
| Pixel 7 | 6.3" | 412×915 | High |

### Viewport Testing

```typescript
const viewports = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14 Pro', width: 393, height: 852 },
  { name: 'iPad Portrait', width: 768, height: 1024 },
  { name: 'iPad Landscape', width: 1024, height: 768 },
];
```
