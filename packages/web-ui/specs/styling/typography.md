# Typography

Font system, type scale, and text styling for messages, code blocks, and markdown.

## Overview

Typography in Pi Web UI prioritizes:
- Readability on all screen sizes
- Clear hierarchy through size and weight
- Code legibility with monospace fonts
- Consistent markdown rendering

## Font Stack

### Sans-Serif (UI and Messages)

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
    Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}
```

**Font loading:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Monospace (Code)

```css
:root {
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, 
    'Inconsolata', 'Roboto Mono', Menlo, Consolas, monospace;
}
```

**Font loading:**
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

## Type Scale

### Base Size

```css
:root {
  /* Responsive base size */
  --font-size-base: 16px;
  
  @media (min-width: 768px) {
    --font-size-base: 15px;
  }
  
  @media (min-width: 1024px) {
    --font-size-base: 14px;
  }
}

html {
  font-size: var(--font-size-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Size Scale

```css
:root {
  /* Relative to base */
  --text-xs: 0.75rem;     /* 12px at 16px base */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */
  --text-3xl: 1.875rem;   /* 30px */
  --text-4xl: 2.25rem;    /* 36px */
}
```

### Line Heights

```css
:root {
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
}
```

### Font Weights

```css
:root {
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

## User Font Size Settings

```css
/* Small */
[data-font-size="sm"] {
  --font-size-base: 14px;
  
  @media (min-width: 768px) {
    --font-size-base: 13px;
  }
}

/* Medium (default) */
[data-font-size="md"] {
  /* Uses default values */
}

/* Large */
[data-font-size="lg"] {
  --font-size-base: 18px;
  
  @media (min-width: 768px) {
    --font-size-base: 17px;
  }
  
  @media (min-width: 1024px) {
    --font-size-base: 16px;
  }
}
```

## Component Typography

### Body Text

```css
body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--color-text);
}
```

### Headings

```css
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-sans);
  font-weight: var(--font-semibold);
  line-height: var(--leading-tight);
  color: var(--color-text);
}

h1 { font-size: var(--text-3xl); }
h2 { font-size: var(--text-2xl); }
h3 { font-size: var(--text-xl); }
h4 { font-size: var(--text-lg); }
h5 { font-size: var(--text-base); }
h6 { font-size: var(--text-sm); }
```

### Messages

```css
.message-content {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--color-text);
  
  /* Paragraph spacing */
  p + p {
    margin-top: 1em;
  }
}

.message-meta {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.message-timestamp {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
```

### Input

```css
.message-input {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  
  &::placeholder {
    color: var(--color-text-muted);
  }
}
```

### Labels and Captions

```css
.label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text);
}

.caption {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.help-text {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
```

## Code Typography

### Inline Code

```css
code:not(pre code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  background: var(--color-code-bg);
  border-radius: var(--radius-sm);
  color: var(--color-text);
}
```

### Code Blocks

```css
pre {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  background: var(--color-code-bg);
  border: 1px solid var(--color-code-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  overflow-x: auto;
  
  /* Disable ligatures for code */
  font-variant-ligatures: none;
  
  code {
    font-family: inherit;
    font-size: inherit;
    padding: 0;
    background: none;
    border-radius: 0;
  }
}
```

### Line Numbers

```css
.code-block {
  display: grid;
  grid-template-columns: auto 1fr;
  
  .line-numbers {
    padding-right: var(--space-4);
    text-align: right;
    color: var(--color-text-muted);
    user-select: none;
    border-right: 1px solid var(--color-border);
    margin-right: var(--space-4);
  }
  
  .line-number {
    display: block;
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
  }
}
```

### Syntax Highlighting

```css
/* Token styles */
.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: var(--code-comment);
  font-style: italic;
}

.token.punctuation {
  color: var(--code-operator);
}

.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol {
  color: var(--code-number);
}

.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin {
  color: var(--code-string);
}

.token.operator,
.token.entity,
.token.url,
.language-css .token.string,
.style .token.string {
  color: var(--code-operator);
}

.token.atrule,
.token.attr-value,
.token.keyword {
  color: var(--code-keyword);
}

.token.function,
.token.class-name {
  color: var(--code-function);
}

.token.regex,
.token.important,
.token.variable {
  color: var(--code-variable);
}
```

## Markdown Rendering

### Base Styles

```css
.markdown-content {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--color-text);
  
  /* Spacing between block elements */
  > * + * {
    margin-top: 1em;
  }
  
  /* Headings */
  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    
    &:first-child {
      margin-top: 0;
    }
  }
  
  /* Paragraphs */
  p {
    margin: 1em 0;
  }
}
```

### Lists

```css
.markdown-content {
  ul, ol {
    padding-left: 1.5em;
    margin: 1em 0;
    
    li {
      margin: 0.25em 0;
    }
    
    /* Nested lists */
    ul, ol {
      margin: 0.5em 0;
    }
  }
  
  ul {
    list-style-type: disc;
    
    ul {
      list-style-type: circle;
      
      ul {
        list-style-type: square;
      }
    }
  }
  
  ol {
    list-style-type: decimal;
  }
  
  /* Task lists */
  .task-list {
    list-style-type: none;
    padding-left: 0;
    
    .task-list-item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      
      input[type="checkbox"] {
        margin-top: 0.25em;
      }
    }
  }
}
```

### Blockquotes

```css
.markdown-content {
  blockquote {
    margin: 1em 0;
    padding: var(--space-3) var(--space-4);
    border-left: 4px solid var(--color-accent);
    background: var(--color-background-secondary);
    color: var(--color-text-secondary);
    
    p {
      margin: 0;
    }
    
    p + p {
      margin-top: 0.5em;
    }
  }
}
```

### Tables

```css
.markdown-content {
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: var(--text-sm);
  }
  
  th, td {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    text-align: left;
  }
  
  th {
    background: var(--color-background-secondary);
    font-weight: var(--font-semibold);
  }
  
  tr:nth-child(even) {
    background: var(--color-background-secondary);
  }
}
```

### Links

```css
.markdown-content {
  a {
    color: var(--color-accent);
    text-decoration: underline;
    text-underline-offset: 2px;
    
    &:hover {
      color: var(--color-accent-hover);
    }
    
    &:visited {
      color: var(--color-accent);
    }
  }
}
```

### Horizontal Rules

```css
.markdown-content {
  hr {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 2em 0;
  }
}
```

### Images

```css
.markdown-content {
  img {
    max-width: 100%;
    height: auto;
    border-radius: var(--radius-md);
    margin: 1em 0;
  }
  
  figure {
    margin: 1em 0;
    
    figcaption {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      text-align: center;
      margin-top: var(--space-2);
    }
  }
}
```

## Thinking Blocks

```css
.thinking-block {
  font-size: var(--text-sm);
  font-style: italic;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  margin: var(--space-2) 0;
  
  .thinking-header {
    font-weight: var(--font-medium);
    font-style: normal;
    margin-bottom: var(--space-2);
  }
}
```

## Tool Output Typography

```css
.tool-output {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  
  .tool-header {
    font-family: var(--font-sans);
    font-weight: var(--font-medium);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .tool-path {
    color: var(--color-text-secondary);
  }
  
  .tool-content {
    margin-top: var(--space-2);
    line-height: var(--leading-relaxed);
  }
}
```

## Truncation and Overflow

```css
/* Single line truncation */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Multi-line truncation */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

## Accessibility

### Minimum Font Sizes

```css
/* Never go below 12px for readability */
.text-xs {
  font-size: max(0.75rem, 12px);
}

/* Interactive elements need larger text */
.button,
.input {
  font-size: max(var(--text-base), 16px);
}
```

### Text Spacing

```css
/* Support for user text spacing preferences */
@media (prefers-reduced-motion: no-preference) {
  body {
    word-spacing: 0.16em;
    letter-spacing: 0.12em;
  }
}
```

### Font Loading

```typescript
// Ensure fallback fonts work well
async function loadFonts(): Promise<void> {
  if ('fonts' in document) {
    try {
      await Promise.all([
        document.fonts.load('400 1rem Inter'),
        document.fonts.load('500 1rem Inter'),
        document.fonts.load('600 1rem Inter'),
        document.fonts.load('400 1rem JetBrains Mono'),
      ]);
      document.documentElement.classList.add('fonts-loaded');
    } catch {
      // Fallback fonts will be used
    }
  }
}
```

```css
/* Adjust fallback fonts to match loaded fonts */
body:not(.fonts-loaded) {
  /* Adjust metrics for fallback fonts */
  font-size-adjust: 0.5;
}
```

## Utility Classes

```css
/* Size utilities */
.text-xs { font-size: var(--text-xs); }
.text-sm { font-size: var(--text-sm); }
.text-base { font-size: var(--text-base); }
.text-lg { font-size: var(--text-lg); }
.text-xl { font-size: var(--text-xl); }
.text-2xl { font-size: var(--text-2xl); }

/* Weight utilities */
.font-normal { font-weight: var(--font-normal); }
.font-medium { font-weight: var(--font-medium); }
.font-semibold { font-weight: var(--font-semibold); }
.font-bold { font-weight: var(--font-bold); }

/* Family utilities */
.font-sans { font-family: var(--font-sans); }
.font-mono { font-family: var(--font-mono); }

/* Line height utilities */
.leading-tight { line-height: var(--leading-tight); }
.leading-normal { line-height: var(--leading-normal); }
.leading-relaxed { line-height: var(--leading-relaxed); }

/* Alignment */
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

/* Transform */
.uppercase { text-transform: uppercase; }
.lowercase { text-transform: lowercase; }
.capitalize { text-transform: capitalize; }
```
