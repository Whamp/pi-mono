# Artifacts

The artifacts panel displays interactive content created by the AI (HTML, SVG, Markdown, etc.) in a sandboxed environment.

## Structure

### Desktop (Side Panel)

```
┌──────────────────────────────────────────────────────────────┐
│  Artifacts                                        [↗️] [×]   │
├──────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐                           │
│  │ Tab 1  │ │ Tab 2  │ │ Tab 3  │                           │
│  │ active │ │        │ │        │                           │
│  └────────┘ └────────┘ └────────┘                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│                      [Artifact Content]                      │
│                                                              │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  chart.html · HTML · v2        [📋 Copy] [⬇️ Download] [🗑️] │
└──────────────────────────────────────────────────────────────┘
```

### Mobile (Fullscreen Overlay)

```
┌─────────────────────────────────────┐
│  ← Artifacts                   [×]  │
├─────────────────────────────────────┤
│  ┌───────┐ ┌───────┐ ┌───────┐     │
│  │ Tab 1 │ │ Tab 2 │ │ Tab 3 │ →   │ ← Horizontal scroll
│  └───────┘ └───────┘ └───────┘     │
├─────────────────────────────────────┤
│                                     │
│                                     │
│        [Artifact Content]           │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  chart.html                         │
│  HTML · Version 2                   │
│  ┌──────────────────────────────┐  │
│  │ [📋 Copy] [⬇️ Download] [🗑️] │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Components

### Artifacts Panel

```typescript
interface ArtifactsPanelProps {
  artifacts: Artifact[];
  activeArtifactId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onFullscreen: () => void;
  onCopy: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}

interface Artifact {
  id: string;
  filename: string;
  type: ArtifactType;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

type ArtifactType = 
  | 'html'
  | 'svg'
  | 'markdown'
  | 'text'
  | 'json'
  | 'image'
  | 'pdf'
  | 'docx'
  | 'xlsx';
```

### Tab Bar

```typescript
interface ArtifactTabsProps {
  artifacts: Artifact[];
  activeId: string | null;
  onSelect: (id: string) => void;
}
```

**Tab appearance:**
```
┌─────────────────────┐
│ 🎨 chart.html    ×  │ ← Type icon + filename + close
└─────────────────────┘
```

**Type icons:**
| Type | Icon |
|------|------|
| html | 🌐 |
| svg | 🖼️ |
| markdown | 📝 |
| text | 📄 |
| json | 📊 |
| image | 🖼️ |
| pdf | 📕 |
| docx | 📘 |
| xlsx | 📗 |

**Behavior:**
- Horizontal scroll when many tabs
- Active tab highlighted
- Close button on hover (or always on mobile)
- Drag to reorder (future)

### Content Viewer

```typescript
interface ArtifactViewerProps {
  artifact: Artifact;
  onLoad: () => void;
  onError: (error: string) => void;
}
```

**Rendering by type:**

| Type | Renderer |
|------|----------|
| html | Sandboxed iframe |
| svg | Inline SVG or iframe |
| markdown | Rendered markdown |
| text | Pre-formatted text |
| json | Syntax-highlighted JSON with collapse |
| image | `<img>` tag |
| pdf | PDF viewer or download link |
| docx/xlsx | Preview or download link |

### HTML Sandbox

```typescript
interface SandboxedIframeProps {
  html: string;
  sandboxUrl: string;  // For CSP
  onMessage: (data: unknown) => void;
}
```

**Sandbox attributes:**
```html
<iframe
  sandbox="allow-scripts allow-same-origin"
  src={sandboxUrl}
  title="Artifact preview"
/>
```

**Security:**
- Content loaded via srcdoc or blob URL
- No access to parent window
- No network requests (unless explicitly allowed)
- postMessage for communication

### Footer Bar

```typescript
interface ArtifactFooterProps {
  artifact: Artifact;
  onCopy: () => void;
  onDownload: () => void;
  onDelete: () => void;
}
```

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  chart.html · HTML · Version 2     [📋] [⬇️] [🗑️]          │
└──────────────────────────────────────────────────────────────┘
```

**Actions:**
- **Copy**: Copy source code to clipboard
- **Download**: Save as file
- **Delete**: Remove artifact (with confirmation)

## Artifact Lifecycle

### Creation

```typescript
// Tool creates artifact
{
  type: 'toolResult',
  toolName: 'artifacts',
  content: [{
    type: 'text',
    text: 'Created chart.html'
  }],
  details: {
    action: 'create',
    filename: 'chart.html',
    artifactType: 'html',
    content: '<html>...</html>'
  }
}
```

**UI behavior:**
1. Add artifact to panel
2. Open panel if closed
3. Switch to new artifact tab
4. Show creation toast

### Update

```typescript
// Tool updates artifact
{
  details: {
    action: 'update',
    filename: 'chart.html',
    content: '<html><!-- updated --></html>'
  }
}
```

**UI behavior:**
1. Increment version
2. Refresh content viewer
3. Show update toast (optional)

### Deletion

```typescript
// Tool deletes artifact
{
  details: {
    action: 'delete',
    filename: 'chart.html'
  }
}
```

**UI behavior:**
1. Show confirmation dialog
2. Remove from tabs
3. Switch to next artifact or close panel

## Fullscreen Mode

```typescript
interface FullscreenArtifactProps {
  artifact: Artifact;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}
```

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Back   chart.html                                    [📋] [⬇️] [×]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                                                                          │
│                                                                          │
│                           [Full Viewport Content]                        │
│                                                                          │
│                                                                          │
│                                                                          │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  [← Previous]                                              [Next →]     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Triggers:**
- Fullscreen button (↗️) in panel header
- Double-click on artifact content
- Swipe up on mobile

**Exit:**
- Close button (×)
- Escape key
- Swipe down on mobile

## Version History (Future)

```typescript
interface ArtifactVersionsProps {
  artifact: Artifact;
  versions: ArtifactVersion[];
  onSelectVersion: (version: number) => void;
}

interface ArtifactVersion {
  version: number;
  content: string;
  timestamp: string;
}
```

**Dropdown in footer:**
```
┌─────────────────────────┐
│ Version 3 (current)   ▾ │
├─────────────────────────┤
│ ○ Version 3 - 2:34 PM   │
│ ○ Version 2 - 2:30 PM   │
│ ○ Version 1 - 2:25 PM   │
└─────────────────────────┘
```

## Markdown Rendering

```typescript
interface MarkdownViewerProps {
  content: string;
  onLinkClick: (url: string) => void;
}
```

**Features:**
- GitHub-flavored markdown
- Syntax-highlighted code blocks
- Tables
- Task lists
- Embedded images (base64 or URL)
- Math rendering (KaTeX) - optional

## JSON Viewer

```typescript
interface JsonViewerProps {
  content: string;
  collapsed: boolean;
  onToggle: () => void;
}
```

**Features:**
- Syntax highlighting
- Collapsible nodes
- Copy path on click
- Search within JSON

## Error Handling

### Load Error

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                          ⚠️                                  │
│                                                              │
│           Failed to load artifact                            │
│                                                              │
│   The content could not be rendered.                        │
│   This may be due to invalid HTML or security restrictions. │
│                                                              │
│   [View Source] [Download]                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Empty State

When no artifacts exist:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                          🎨                                  │
│                                                              │
│                   No artifacts yet                           │
│                                                              │
│   Ask the AI to create HTML, SVG, or other                  │
│   interactive content and it will appear here.              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Gestures (Mobile)

| Gesture | Action |
|---------|--------|
| Swipe left/right on tab | Switch artifacts |
| Swipe down from top | Close fullscreen |
| Swipe up from content | Enter fullscreen |
| Pinch | Zoom (for images/HTML) |
| Double tap | Toggle fullscreen |

## Accessibility

- **ARIA labels**: "Artifact viewer", "Artifact tabs"
- **Keyboard navigation**: Tab through artifacts, Enter to select
- **Focus trap**: In fullscreen mode
- **Alt text**: For images and icons
- **Screen reader**: Announce artifact changes

## Performance

- **Lazy rendering**: Only render visible artifact
- **Debounced updates**: Don't re-render during rapid updates
- **Blob URLs**: For large content
- **Cleanup**: Revoke blob URLs on unmount
