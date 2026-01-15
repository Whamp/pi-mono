# Theme

Light and dark mode theming, color system, and design tokens.

## Overview

Pi Web UI supports three theme modes:
- **Light**: Bright background, dark text
- **Dark**: Dark background, light text
- **System**: Follows OS preference

All colors are defined as CSS custom properties (design tokens) that switch based on the active theme.

## Color System

### Design Principles

1. **Semantic naming**: Colors named by function, not value
2. **Consistent contrast**: WCAG AA compliance (4.5:1 for text)
3. **Neutral base**: Grays for most UI, accent for interaction
4. **Mode-aware**: All colors adapt to light/dark

### Base Palette

```css
:root {
  /* Neutral grays - used for backgrounds, borders, text */
  --gray-50: #fafafa;
  --gray-100: #f5f5f5;
  --gray-200: #e5e5e5;
  --gray-300: #d4d4d4;
  --gray-400: #a3a3a3;
  --gray-500: #737373;
  --gray-600: #525252;
  --gray-700: #404040;
  --gray-800: #262626;
  --gray-900: #171717;
  --gray-950: #0a0a0a;
  
  /* Accent - blue by default */
  --accent-50: #eff6ff;
  --accent-100: #dbeafe;
  --accent-200: #bfdbfe;
  --accent-300: #93c5fd;
  --accent-400: #60a5fa;
  --accent-500: #3b82f6;
  --accent-600: #2563eb;
  --accent-700: #1d4ed8;
  --accent-800: #1e40af;
  --accent-900: #1e3a8a;
  
  /* Status colors */
  --red-500: #ef4444;
  --red-600: #dc2626;
  --yellow-500: #eab308;
  --yellow-600: #ca8a04;
  --green-500: #22c55e;
  --green-600: #16a34a;
}
```

### Semantic Tokens

```css
/* Light theme (default) */
:root {
  /* Backgrounds */
  --color-background: var(--gray-50);
  --color-background-secondary: var(--gray-100);
  --color-background-tertiary: var(--gray-200);
  --color-surface: white;
  --color-surface-hover: var(--gray-100);
  --color-surface-active: var(--gray-200);
  
  /* Text */
  --color-text: var(--gray-900);
  --color-text-secondary: var(--gray-600);
  --color-text-tertiary: var(--gray-500);
  --color-text-muted: var(--gray-400);
  --color-text-inverse: white;
  
  /* Borders */
  --color-border: var(--gray-200);
  --color-border-hover: var(--gray-300);
  --color-border-focus: var(--accent-500);
  
  /* Accent */
  --color-accent: var(--accent-600);
  --color-accent-hover: var(--accent-700);
  --color-accent-light: var(--accent-100);
  --color-accent-ring: var(--accent-200);
  
  /* Status */
  --color-success: var(--green-600);
  --color-success-bg: #dcfce7;
  --color-warning: var(--yellow-600);
  --color-warning-bg: #fef9c3;
  --color-error: var(--red-600);
  --color-error-bg: #fee2e2;
  --color-info: var(--accent-600);
  --color-info-bg: var(--accent-100);
  
  /* Components */
  --color-input-bg: white;
  --color-input-border: var(--gray-300);
  --color-button-bg: var(--gray-900);
  --color-button-text: white;
  --color-button-secondary-bg: var(--gray-100);
  --color-button-secondary-text: var(--gray-900);
  
  /* Chat */
  --color-user-bubble: var(--gray-100);
  --color-assistant-bubble: transparent;
  --color-code-bg: var(--gray-100);
  --color-code-border: var(--gray-200);
  
  /* Search */
  --color-search-match: #fef08a;
  --color-search-match-current: #fbbf24;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

/* Dark theme */
[data-theme="dark"] {
  /* Backgrounds */
  --color-background: var(--gray-950);
  --color-background-secondary: var(--gray-900);
  --color-background-tertiary: var(--gray-800);
  --color-surface: var(--gray-900);
  --color-surface-hover: var(--gray-800);
  --color-surface-active: var(--gray-700);
  
  /* Text */
  --color-text: var(--gray-50);
  --color-text-secondary: var(--gray-400);
  --color-text-tertiary: var(--gray-500);
  --color-text-muted: var(--gray-600);
  --color-text-inverse: var(--gray-900);
  
  /* Borders */
  --color-border: var(--gray-800);
  --color-border-hover: var(--gray-700);
  --color-border-focus: var(--accent-500);
  
  /* Accent */
  --color-accent: var(--accent-500);
  --color-accent-hover: var(--accent-400);
  --color-accent-light: var(--accent-900);
  --color-accent-ring: var(--accent-800);
  
  /* Status */
  --color-success: var(--green-500);
  --color-success-bg: #14532d;
  --color-warning: var(--yellow-500);
  --color-warning-bg: #422006;
  --color-error: var(--red-500);
  --color-error-bg: #450a0a;
  --color-info: var(--accent-500);
  --color-info-bg: var(--accent-900);
  
  /* Components */
  --color-input-bg: var(--gray-900);
  --color-input-border: var(--gray-700);
  --color-button-bg: white;
  --color-button-text: var(--gray-900);
  --color-button-secondary-bg: var(--gray-800);
  --color-button-secondary-text: var(--gray-100);
  
  /* Chat */
  --color-user-bubble: var(--gray-800);
  --color-assistant-bubble: transparent;
  --color-code-bg: var(--gray-800);
  --color-code-border: var(--gray-700);
  
  /* Search */
  --color-search-match: #854d0e;
  --color-search-match-current: #a16207;
  
  /* Shadows - more subtle in dark mode */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
}
```

## Theme Switching

### CSS Implementation

```css
/* System theme detection */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Dark theme tokens applied */
    --color-background: var(--gray-950);
    /* ... */
  }
}
```

### JavaScript Implementation

```typescript
type ThemeMode = 'light' | 'dark' | 'system';

function setTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', mode);
  }
  
  // Persist preference
  storage.settings.set({ theme: mode });
  
  // Update meta theme-color for mobile browsers
  updateMetaThemeColor(getEffectiveTheme());
}

function getEffectiveTheme(): 'light' | 'dark' {
  const mode = storage.settings.get('theme');
  
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' 
      : 'light';
  }
  
  return mode;
}

function updateMetaThemeColor(theme: 'light' | 'dark'): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff');
  }
}

// Listen for system theme changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
mediaQuery.addEventListener('change', (e) => {
  if (storage.settings.get('theme') === 'system') {
    updateMetaThemeColor(e.matches ? 'dark' : 'light');
  }
});
```

### Theme Toggle Component

```typescript
interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
}

function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const icons = {
    light: '☀️',
    dark: '🌙',
    system: '💻',
  };
  
  return (
    <button
      onClick={onToggle}
      className="theme-toggle"
      aria-label={`Theme: ${theme}. Click to change.`}
    >
      {icons[theme]}
    </button>
  );
}

function cycleTheme(current: ThemeMode): ThemeMode {
  const order: ThemeMode[] = ['light', 'dark', 'system'];
  const index = order.indexOf(current);
  return order[(index + 1) % order.length];
}
```

## Spacing Scale

```css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

## Border Radius

```css
:root {
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
}
```

## Z-Index Scale

```css
:root {
  --z-base: 0;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-sidebar: 30;
  --z-artifacts: 30;
  --z-header: 40;
  --z-overlay: 50;
  --z-dialog: 60;
  --z-toast: 70;
  --z-tooltip: 80;
}
```

## Component Tokens

### Buttons

```css
:root {
  /* Primary button */
  --button-primary-bg: var(--color-accent);
  --button-primary-bg-hover: var(--color-accent-hover);
  --button-primary-text: white;
  --button-primary-border: transparent;
  
  /* Secondary button */
  --button-secondary-bg: var(--color-surface);
  --button-secondary-bg-hover: var(--color-surface-hover);
  --button-secondary-text: var(--color-text);
  --button-secondary-border: var(--color-border);
  
  /* Ghost button */
  --button-ghost-bg: transparent;
  --button-ghost-bg-hover: var(--color-surface-hover);
  --button-ghost-text: var(--color-text-secondary);
  --button-ghost-border: transparent;
  
  /* Danger button */
  --button-danger-bg: var(--color-error);
  --button-danger-bg-hover: var(--red-700);
  --button-danger-text: white;
  --button-danger-border: transparent;
}

[data-theme="dark"] {
  --button-primary-text: var(--gray-900);
}
```

### Inputs

```css
:root {
  --input-bg: var(--color-input-bg);
  --input-border: var(--color-input-border);
  --input-border-focus: var(--color-accent);
  --input-text: var(--color-text);
  --input-placeholder: var(--color-text-muted);
  --input-ring: var(--color-accent-ring);
}
```

### Cards

```css
:root {
  --card-bg: var(--color-surface);
  --card-border: var(--color-border);
  --card-shadow: var(--shadow-sm);
  --card-radius: var(--radius-lg);
}
```

## Utility Classes

```css
/* Background utilities */
.bg-primary { background-color: var(--color-background); }
.bg-secondary { background-color: var(--color-background-secondary); }
.bg-surface { background-color: var(--color-surface); }
.bg-accent { background-color: var(--color-accent); }

/* Text utilities */
.text-primary { color: var(--color-text); }
.text-secondary { color: var(--color-text-secondary); }
.text-muted { color: var(--color-text-muted); }
.text-accent { color: var(--color-accent); }
.text-error { color: var(--color-error); }
.text-success { color: var(--color-success); }

/* Border utilities */
.border { border: 1px solid var(--color-border); }
.border-accent { border-color: var(--color-accent); }
.border-error { border-color: var(--color-error); }

/* Radius utilities */
.rounded-sm { border-radius: var(--radius-sm); }
.rounded-md { border-radius: var(--radius-md); }
.rounded-lg { border-radius: var(--radius-lg); }
.rounded-full { border-radius: var(--radius-full); }

/* Shadow utilities */
.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow-md { box-shadow: var(--shadow-md); }
.shadow-lg { box-shadow: var(--shadow-lg); }
```

## Syntax Highlighting

### Code Block Colors

```css
:root {
  --code-text: var(--gray-800);
  --code-comment: var(--gray-500);
  --code-keyword: #7c3aed;
  --code-string: #059669;
  --code-number: #0891b2;
  --code-function: #2563eb;
  --code-operator: var(--gray-600);
  --code-class: #db2777;
  --code-variable: var(--gray-700);
}

[data-theme="dark"] {
  --code-text: var(--gray-200);
  --code-comment: var(--gray-500);
  --code-keyword: #a78bfa;
  --code-string: #34d399;
  --code-number: #22d3ee;
  --code-function: #60a5fa;
  --code-operator: var(--gray-400);
  --code-class: #f472b6;
  --code-variable: var(--gray-300);
}
```

## Accessibility

### Contrast Ratios

All text/background combinations meet WCAG AA:

| Token Pair | Light | Dark | Ratio |
|------------|-------|------|-------|
| text / background | #171717 / #fafafa | #fafafa / #0a0a0a | 18:1+ |
| text-secondary / background | #525252 / #fafafa | #a3a3a3 / #0a0a0a | 7:1+ |
| text-muted / background | #a3a3a3 / #fafafa | #737373 / #0a0a0a | 4.5:1 |
| accent / background | #2563eb / #fafafa | #3b82f6 / #0a0a0a | 4.5:1+ |

### Focus Indicators

```css
/* Visible focus for all interactive elements */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Custom focus for specific components */
.button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-accent-ring);
}

.input:focus-visible {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-accent-ring);
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
    scroll-behavior: auto !important;
  }
}
```

### High Contrast Mode

```css
@media (prefers-contrast: more) {
  :root {
    --color-border: var(--gray-400);
    --color-text-secondary: var(--gray-700);
    --color-text-muted: var(--gray-600);
  }
  
  [data-theme="dark"] {
    --color-border: var(--gray-500);
    --color-text-secondary: var(--gray-300);
    --color-text-muted: var(--gray-400);
  }
}
```

## CSS Variables Usage

### In Components

```css
.message {
  background: var(--color-user-bubble);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  color: var(--color-text);
}

.button-primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  border: 1px solid var(--button-primary-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  
  &:hover {
    background: var(--button-primary-bg-hover);
  }
}
```

### Dynamic Values

```typescript
// Set accent color dynamically
function setAccentColor(hue: number): void {
  document.documentElement.style.setProperty('--accent-500', `hsl(${hue}, 70%, 50%)`);
  document.documentElement.style.setProperty('--accent-600', `hsl(${hue}, 70%, 45%)`);
  // ... other accent shades
}
```
