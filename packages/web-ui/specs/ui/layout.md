# Layout

The application uses a responsive layout that adapts from desktop to mobile, prioritizing mobile usability.

## Layout Structure

### Desktop Layout (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────────────────────────────────────────┐  │
│  │              │  │                    Header                        │  │
│  │              │  ├──────────────────────────────────────────────────┤  │
│  │              │  │                                                  │  │
│  │              │  │                                                  │  │
│  │   Sidebar    │  │                   Chat Area                      │  │
│  │   (280px)    │  │                                                  │  │
│  │              │  │                                                  │  │
│  │              │  │                                                  │  │
│  │              │  ├──────────────────────────────────────────────────┤  │
│  │              │  │                  Input Area                      │  │
│  └──────────────┘  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Desktop with Artifacts (≥1280px)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────────────────────┐  ┌──────────────────────┐  │
│  │              │  │           Header             │  │   Artifacts Header   │  │
│  │              │  ├──────────────────────────────┤  ├──────────────────────┤  │
│  │              │  │                              │  │                      │  │
│  │   Sidebar    │  │         Chat Area            │  │   Artifacts Panel    │  │
│  │   (280px)    │  │         (flexible)           │  │      (400px)         │  │
│  │              │  │                              │  │                      │  │
│  │              │  │                              │  │                      │  │
│  │              │  ├──────────────────────────────┤  │                      │  │
│  │              │  │        Input Area            │  │                      │  │
│  └──────────────┘  └──────────────────────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Tablet Layout (768px - 1023px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                           Header                                  │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │                          Chat Area                                │   │
│  │                                                                   │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                         Input Area                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Sidebar: Drawer (slides in from left)                                  │
│  Artifacts: Drawer (slides in from right) or Full-screen overlay        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout (<768px)

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────────┐│
│  │            Header               ││
│  ├─────────────────────────────────┤│
│  │                                 ││
│  │           Chat Area             ││
│  │        (full width)             ││
│  │                                 ││
│  ├─────────────────────────────────┤│
│  │          Input Area             ││
│  │    (sticky, safe-area-aware)    ││
│  └─────────────────────────────────┘│
│                                      │
│  Sidebar: Full-screen overlay        │
│  Artifacts: Full-screen overlay      │
└─────────────────────────────────────┘
```

## Breakpoints

```css
/* Mobile first approach */
:root {
  --breakpoint-sm: 640px;   /* Small mobile landscape */
  --breakpoint-md: 768px;   /* Tablet portrait */
  --breakpoint-lg: 1024px;  /* Tablet landscape / Small desktop */
  --breakpoint-xl: 1280px;  /* Desktop */
  --breakpoint-2xl: 1536px; /* Large desktop */
}
```

## Layout Components

### Root Container

```typescript
interface AppLayoutProps {
  sidebarOpen: boolean;
  artifactsOpen: boolean;
  onSidebarToggle: () => void;
  onArtifactsToggle: () => void;
}
```

```css
.app-layout {
  display: flex;
  height: 100dvh; /* Dynamic viewport height for mobile */
  width: 100%;
  overflow: hidden;
  background: var(--color-background);
}
```

### Sidebar Container

```css
.sidebar-container {
  /* Mobile: overlay */
  @media (max-width: 1023px) {
    position: fixed;
    inset: 0;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .sidebar-container.open {
    transform: translateX(0);
  }
  
  /* Desktop: static */
  @media (min-width: 1024px) {
    position: relative;
    width: 280px;
    flex-shrink: 0;
    border-right: 1px solid var(--color-border);
  }
}
```

### Main Content Container

```css
.main-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0; /* Prevent flex overflow */
  height: 100%;
}
```

### Chat Container

```css
.chat-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0; /* Allow scroll */
  
  @media (min-width: 1280px) {
    /* Split with artifacts when open */
    flex: 1;
  }
}
```

### Artifacts Container

```css
.artifacts-container {
  /* Mobile/Tablet: overlay */
  @media (max-width: 1279px) {
    position: fixed;
    inset: 0;
    z-index: 50;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  }
  
  .artifacts-container.open {
    transform: translateX(0);
  }
  
  /* Desktop: side panel */
  @media (min-width: 1280px) {
    position: relative;
    width: 400px;
    flex-shrink: 0;
    border-left: 1px solid var(--color-border);
  }
}
```

## Safe Areas

Handle device notches and home indicators:

```css
.app-layout {
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

.input-area {
  padding-bottom: env(safe-area-inset-bottom);
}
```

## Z-Index Scale

```css
:root {
  --z-base: 0;
  --z-header: 10;
  --z-sidebar: 20;
  --z-artifacts: 20;
  --z-overlay: 30;
  --z-dialog: 40;
  --z-toast: 50;
  --z-tooltip: 60;
}
```

## Layout State Management

```typescript
interface LayoutState {
  sidebarOpen: boolean;
  artifactsOpen: boolean;
  activeArtifactId: string | null;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

// Responsive hook
function useResponsive(): LayoutState {
  const [width, setWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  
  return {
    sidebarOpen: /* ... */,
    artifactsOpen: /* ... */,
    activeArtifactId: /* ... */,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  };
}
```

## Drawer Behavior

### Sidebar Drawer (Mobile/Tablet)

- **Trigger**: Hamburger button in header or swipe from left edge
- **Close**: Tap backdrop, swipe left, or press Escape
- **Content**: Full session list with search
- **Backdrop**: Semi-transparent overlay

### Artifacts Drawer (Mobile/Tablet)

- **Trigger**: Artifact link in chat or artifacts button
- **Close**: Tap backdrop, swipe right, close button, or press Escape
- **Content**: Full artifact view with tabs
- **Backdrop**: Semi-transparent overlay

## Keyboard Navigation

```typescript
const layoutKeyboardShortcuts = {
  'cmd+b': 'Toggle sidebar',
  'cmd+.': 'Toggle artifacts panel',
  'Escape': 'Close active drawer/dialog',
};
```

## Touch Gestures

| Gesture | Location | Action |
|---------|----------|--------|
| Swipe right | Left edge (20px) | Open sidebar |
| Swipe left | Open sidebar | Close sidebar |
| Swipe left | Right edge (20px) | Open artifacts |
| Swipe right | Open artifacts | Close artifacts |
| Pull down | Top of chat | Refresh (remote mode) |

## Fullscreen Mode

Artifacts can expand to fullscreen:

```css
.artifact-fullscreen {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: var(--color-background);
}
```

Trigger: Fullscreen button in artifact header or double-tap on artifact.

## Performance Considerations

1. **Lazy load sidebar content**: Only render visible sessions
2. **Virtualize chat messages**: Use virtual scrolling for long conversations
3. **Defer artifacts**: Load artifact content on demand
4. **Reduce reflows**: Use `transform` for drawer animations
5. **GPU acceleration**: Use `will-change` for animated elements
