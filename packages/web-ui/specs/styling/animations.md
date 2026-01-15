# Animations

Transitions, loading states, and micro-interactions for a polished user experience.

## Overview

Animations in Pi Web UI are:
- **Purposeful**: Guide attention and provide feedback
- **Performant**: Use GPU-accelerated properties (transform, opacity)
- **Accessible**: Respect reduced motion preferences
- **Consistent**: Follow unified timing and easing

## Animation Principles

### Timing Tokens

```css
:root {
  /* Duration */
  --duration-instant: 0ms;
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;
  
  /* Easing */
  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  
  /* Spring-like easing for natural feel */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

### Performance Guidelines

| Property | GPU Accelerated | Preferred |
|----------|-----------------|-----------|
| `transform` | ✅ | Yes |
| `opacity` | ✅ | Yes |
| `filter` | ✅ | Sparingly |
| `width`/`height` | ❌ | Avoid |
| `top`/`left` | ❌ | Avoid |
| `margin`/`padding` | ❌ | Avoid |
| `background-color` | ❌ | Okay for simple |
| `box-shadow` | ❌ | Okay for hover |

### Reduced Motion

```css
/* Always respect user preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Alternative for critical animations */
@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    /* Replace rotation with opacity pulse */
    animation: pulse-reduced 1s ease-in-out infinite;
  }
  
  @keyframes pulse-reduced {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
}
```

## Transitions

### Button Transitions

```css
.button {
  transition: 
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
  
  &:hover {
    background-color: var(--button-primary-bg-hover);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &:focus-visible {
    box-shadow: 0 0 0 3px var(--color-accent-ring);
  }
}
```

### Input Transitions

```css
.input {
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
  
  &:focus {
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 3px var(--color-accent-ring);
  }
}
```

### Link Transitions

```css
a {
  transition: color var(--duration-fast) var(--ease-out);
  
  &:hover {
    color: var(--color-accent-hover);
  }
}
```

## Drawer Animations

### Sidebar Drawer

```css
.sidebar-drawer {
  transform: translateX(-100%);
  transition: transform var(--duration-slow) var(--ease-out);
  will-change: transform;
  
  &.open {
    transform: translateX(0);
  }
}

.sidebar-backdrop {
  opacity: 0;
  transition: opacity var(--duration-slow) var(--ease-out);
  
  &.visible {
    opacity: 1;
  }
}
```

### Artifacts Panel

```css
.artifacts-panel {
  transform: translateX(100%);
  transition: transform var(--duration-slow) var(--ease-out);
  will-change: transform;
  
  &.open {
    transform: translateX(0);
  }
}
```

### Bottom Sheet

```css
.bottom-sheet {
  transform: translateY(100%);
  transition: transform var(--duration-slow) var(--ease-out);
  will-change: transform;
  
  &.open {
    transform: translateY(0);
  }
}

.bottom-sheet-handle {
  /* Visual drag indicator */
  width: 40px;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
}
```

## Dialog Animations

### Modal Dialog

```css
.dialog-backdrop {
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
  
  &.visible {
    opacity: 1;
  }
}

.dialog-content {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
  transition: 
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out);
  
  &.visible {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Exit animation */
.dialog-content.exiting {
  opacity: 0;
  transform: scale(0.95);
}
```

### Alert Dialog (shake on invalid)

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.dialog-content.invalid {
  animation: shake var(--duration-slow) var(--ease-out);
}
```

## Loading States

### Spinner

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

### Thinking Indicator (Dots)

```css
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.thinking-dots {
  display: flex;
  gap: 4px;
  
  .dot {
    width: 8px;
    height: 8px;
    background: var(--color-text-muted);
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
    
    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
    &:nth-child(3) { animation-delay: 0s; }
  }
}
```

### Skeleton Loading

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-background-secondary) 25%,
    var(--color-background-tertiary) 50%,
    var(--color-background-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

.skeleton-text {
  height: 1em;
  margin: 0.5em 0;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
```

### Progress Bar

```css
@keyframes progress-indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-bar {
  height: 4px;
  background: var(--color-background-secondary);
  border-radius: 2px;
  overflow: hidden;
  
  .progress-fill {
    height: 100%;
    background: var(--color-accent);
    transition: width var(--duration-normal) var(--ease-out);
  }
  
  &.indeterminate .progress-fill {
    width: 50%;
    animation: progress-indeterminate 1.5s infinite;
  }
}
```

## Message Animations

### New Message

```css
@keyframes message-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message {
  animation: message-enter var(--duration-normal) var(--ease-out);
}
```

### Streaming Cursor

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--color-accent);
  margin-left: 2px;
  animation: blink 1s step-end infinite;
}
```

### Highlight Message (after search)

```css
@keyframes highlight-pulse {
  0% { background-color: var(--color-accent-light); }
  100% { background-color: transparent; }
}

.message.highlighted {
  animation: highlight-pulse 2s var(--ease-out);
}
```

## Toast Animations

```css
@keyframes toast-enter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes toast-exit {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
}

.toast {
  animation: toast-enter var(--duration-normal) var(--ease-spring);
  
  &.exiting {
    animation: toast-exit var(--duration-fast) var(--ease-in);
  }
}
```

## Banner Animations

```css
@keyframes banner-slide {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.banner {
  animation: banner-slide var(--duration-slow) var(--ease-out);
}
```

## Tooltip Animations

```css
.tooltip {
  opacity: 0;
  transform: translateY(4px);
  transition: 
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
  
  &.visible {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Dropdown Animations

```css
.dropdown-menu {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
  transform-origin: top right;
  transition: 
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
  
  &.open {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

## Collapsible Animations

```css
.collapsible {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-normal) var(--ease-out);
  
  &.expanded {
    grid-template-rows: 1fr;
  }
  
  .collapsible-content {
    overflow: hidden;
  }
}
```

## Tab Animations

```css
.tab-indicator {
  position: absolute;
  bottom: 0;
  height: 2px;
  background: var(--color-accent);
  transition: 
    left var(--duration-normal) var(--ease-out),
    width var(--duration-normal) var(--ease-out);
}
```

## Gesture Feedback

### Pull to Refresh

```css
@keyframes refresh-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.pull-to-refresh-indicator {
  transition: transform var(--duration-fast) var(--ease-out);
  
  &.pulling {
    transform: translateY(var(--pull-progress, 0));
  }
  
  &.refreshing {
    animation: refresh-spin 1s linear infinite;
  }
}
```

### Swipe Action

```css
.swipe-action {
  transition: transform var(--duration-fast) var(--ease-out);
  
  &.dragging {
    transition: none;
  }
  
  &.snapping {
    transition: transform var(--duration-normal) var(--ease-spring);
  }
}
```

## Scroll Animations

### Scroll to Bottom Button

```css
.scroll-to-bottom {
  opacity: 0;
  transform: translateY(10px);
  transition: 
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
  pointer-events: none;
  
  &.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
}
```

### Fade on Scroll

```css
.scroll-fade {
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 10%,
    black 90%,
    transparent 100%
  );
}
```

## Micro-interactions

### Button Press

```css
.button {
  transition: transform var(--duration-fast) var(--ease-out);
  
  &:active {
    transform: scale(0.97);
  }
}
```

### Icon Button Hover

```css
.icon-button {
  transition: 
    background-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
  
  &:hover {
    background-color: var(--color-surface-hover);
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
}
```

### Checkbox Toggle

```css
.checkbox {
  .checkbox-indicator {
    transition: 
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
    
    .check-icon {
      opacity: 0;
      transform: scale(0.5);
      transition: 
        opacity var(--duration-fast) var(--ease-out),
        transform var(--duration-fast) var(--ease-spring);
    }
  }
  
  &.checked .checkbox-indicator .check-icon {
    opacity: 1;
    transform: scale(1);
  }
}
```

### Toggle Switch

```css
.toggle-switch {
  .toggle-thumb {
    transition: transform var(--duration-fast) var(--ease-spring);
  }
  
  &.checked .toggle-thumb {
    transform: translateX(20px);
  }
}
```

## React Animation Library

For complex animations, use a library like Framer Motion:

```typescript
import { motion, AnimatePresence } from 'framer-motion';

const toastVariants = {
  initial: { opacity: 0, y: 50, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 20, scale: 0.9 },
};

function Toast({ message }: { message: string }) {
  return (
    <motion.div
      variants={toastVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {message}
    </motion.div>
  );
}
```

## CSS Animation Utilities

```css
/* Animation utilities */
.animate-spin { animation: spin 1s linear infinite; }
.animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.animate-bounce { animation: bounce 1s infinite; }
.animate-ping { animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes bounce {
  0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
  50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
}

@keyframes ping {
  75%, 100% { transform: scale(2); opacity: 0; }
}
```
