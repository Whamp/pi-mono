# Input

The input area handles message composition, attachments, and submission. It's optimized for both desktop and mobile use.

## Structure

```
┌────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  [Attachment Previews - if any]                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ┌────┐                                          ┌────┐  │  │
│  │  │ 📎 │  Message input...                        │ ➤  │  │  │
│  │  └────┘                                          └────┘  │  │
│  │         [Model: claude-sonnet-4] [Thinking: medium]      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [Stop] ← Visible during streaming                             │
└────────────────────────────────────────────────────────────────┘
```

## Components

### Main Input Container

```typescript
interface InputAreaProps {
  onSubmit: (message: string, attachments: Attachment[]) => void;
  onSteer: (message: string) => void;
  onFollowUp: (message: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  isDisabled: boolean;
  placeholder: string;
  model: Model | null;
  thinkingLevel: ThinkingLevel;
  onModelClick: () => void;
  onThinkingClick: () => void;
}
```

### Text Input

```typescript
interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  placeholder: string;
  disabled: boolean;
  maxHeight: number;  // Auto-expand up to this height
}
```

**Behavior:**
- Auto-resizing textarea (1-8 lines)
- Placeholder: "Message Pi..." or custom
- Focus on mount (desktop) or on tap (mobile)
- Preserve draft on navigation

**Styling:**
```css
.message-input {
  resize: none;
  min-height: 44px;
  max-height: 200px;
  padding: 12px 48px 12px 48px; /* Space for buttons */
  border-radius: 24px;
  border: 1px solid var(--color-border);
  background: var(--color-input-bg);
  
  &:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-accent-ring);
  }
}
```

### Attachment Button

```typescript
interface AttachmentButtonProps {
  onClick: () => void;
  onDrop: (files: File[]) => void;
  disabled: boolean;
}
```

**Position:** Left side of input

**Click behavior:**
1. Open file picker
2. Support multiple selection
3. Filter by supported types

**Supported types:**
- Images: jpg, jpeg, png, gif, webp
- Documents: pdf, docx, xlsx, pptx, txt, md
- Code: js, ts, py, etc. (as text)

### Submit Button

```typescript
interface SubmitButtonProps {
  onClick: () => void;
  disabled: boolean;
  isStreaming: boolean;
}
```

**Position:** Right side of input

**States:**
- **Default (→)**: Ready to send
- **Disabled (→)**: Muted, non-interactive
- **Streaming (⬛)**: Stop button

### Stop Button

During streaming, the submit button transforms:

```typescript
interface StopButtonProps {
  onClick: () => void;
}
```

**Styling:**
- Red/warning color
- Square icon (stop symbol)
- Pulsing animation optional

### Attachment Previews

```typescript
interface AttachmentPreviewsProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}
```

**Layout (horizontal scroll on mobile):**
```
┌────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ 📷   [×] │  │ 📄   [×] │  │ 📄   [×] │                 │
│  │ preview  │  │ doc.pdf  │  │ data.csv │                 │
│  │ img.png  │  │  124 KB  │  │   45 KB  │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└────────────────────────────────────────────────────────────┘
```

**Thumbnail types:**
- **Image**: Actual preview (resized)
- **PDF**: PDF icon with page preview
- **Document**: File type icon
- **Code**: Code icon with extension

**Remove button:** × in top-right corner of each

### Model Selector Badge

```typescript
interface ModelBadgeProps {
  model: Model | null;
  thinkingLevel: ThinkingLevel;
  onClick: () => void;
}
```

**Layout:**
```
┌──────────────────────────────────────┐
│ 🤖 claude-sonnet-4 · thinking: high  │
└──────────────────────────────────────┘
```

**Click:** Opens model selector dialog

**Mobile:** Show abbreviated version:
```
┌────────────────────┐
│ claude-4 · high    │
└────────────────────┘
```

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `Enter` | Not streaming | Submit message |
| `Shift+Enter` | Any | Insert newline |
| `Ctrl/Cmd+Enter` | Streaming | Queue as steer message |
| `Alt+Enter` | Streaming | Queue as follow-up message |
| `Escape` | Streaming | Abort/stop |
| `Escape` | Has text | Clear input |
| `Ctrl/Cmd+V` | Focus | Paste (including images) |
| `Tab` | Has `@` | File autocomplete |
| `Tab` | Has `/` | Command autocomplete |

## Autocomplete

### File References (`@`)

```typescript
interface FileAutocompleteProps {
  query: string;      // Text after @
  files: FileInfo[];  // Available files (remote mode)
  onSelect: (path: string) => void;
}
```

**Trigger:** Type `@` in input

**Popup:**
```
┌─────────────────────────────────────┐
│ 🔍 @main                            │
├─────────────────────────────────────┤
│ 📄 src/main.ts                      │
│ 📄 src/main.test.ts                 │
│ 📄 docs/main.md                     │
└─────────────────────────────────────┘
```

**Behavior:**
- Fuzzy search file names
- Show relative paths
- Insert full path on select
- Browser mode: Limited/disabled (no file access)

### Command Autocomplete (`/`)

```typescript
interface CommandAutocompleteProps {
  query: string;         // Text after /
  commands: Command[];   // Available commands
  onSelect: (command: string) => void;
}
```

**Trigger:** Type `/` at start of input

**Popup:**
```
┌─────────────────────────────────────┐
│ 🔍 /mod                             │
├─────────────────────────────────────┤
│ /model - Switch model               │
│ /models - List available models     │
└─────────────────────────────────────┘
```

**Available commands (remote mode):**
- `/model` - Open model selector
- `/compact` - Compact context
- `/export` - Export session
- `/fork` - Fork from message
- `/tree` - Navigate tree

**Browser mode commands:**
- `/model` - Open model selector
- `/clear` - Clear conversation

## Drag and Drop

```typescript
interface DragDropZoneProps {
  onDrop: (files: File[]) => void;
  accept: string[];  // MIME types
}
```

**Visual feedback:**
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ╔════════════════════════════════════════════════════╗   │
│  ║                                                    ║   │
│  ║              📎 Drop files here                    ║   │
│  ║                                                    ║   │
│  ╚════════════════════════════════════════════════════╝   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Show overlay on drag enter
- Hide on drag leave or drop
- Validate file types
- Add to attachment queue

## Image Paste

```typescript
async function handlePaste(e: ClipboardEvent): Promise<void> {
  const items = e.clipboardData?.items;
  if (!items) return;
  
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        const attachment = await processImage(file);
        addAttachment(attachment);
      }
    }
  }
}
```

**Supported:**
- Screenshots (Cmd+Shift+4 on Mac, etc.)
- Copied images from browser
- Copied image files (with some limitations)

## Voice Input (Future)

```typescript
interface VoiceInputButtonProps {
  onTranscription: (text: string) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}
```

**Position:** Left of attachment button (or replace on mobile)

**States:**
- **Default (🎤)**: Ready to record
- **Recording (🔴)**: Active, pulsing
- **Processing (●●●)**: Transcribing

**Implementation:**
- Web Speech API (browser) or Whisper API
- Push-to-talk on mobile (hold button)
- Auto-stop after silence

## Mobile Optimizations

### Sticky Positioning

```css
.input-area {
  position: sticky;
  bottom: 0;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-background);
  border-top: 1px solid var(--color-border);
}
```

### Keyboard Handling

```typescript
// Adjust viewport when keyboard opens
useEffect(() => {
  const handler = () => {
    if (visualViewport) {
      const height = visualViewport.height;
      document.body.style.height = `${height}px`;
    }
  };
  
  visualViewport?.addEventListener('resize', handler);
  return () => visualViewport?.removeEventListener('resize', handler);
}, []);
```

### Touch-Friendly Targets

- Minimum 44×44px touch targets
- Spacing between buttons
- Large attachment previews

### Simplified Layout

Mobile layout removes some elements:
- Model badge moves to header
- Thinking level in settings
- Fewer visible shortcuts

```
┌────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [Attachments row - scrollable]                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌────┐ ┌─────────────────────────────────────┐ ┌────┐    │
│  │ 📎 │ │ Message Pi...                       │ │ ➤  │    │
│  └────┘ └─────────────────────────────────────┘ └────┘    │
└────────────────────────────────────────────────────────────┘
```

## Streaming Message Queuing

During streaming, the input behaves differently:

### Steering Mode

```typescript
// User types and presses Ctrl+Enter during streaming
async function handleSteer(message: string): Promise<void> {
  await adapter.steer(message);
  showToast('Message queued (will interrupt)');
  clearInput();
}
```

**Visual feedback:**
```
┌────────────────────────────────────────────────────────────┐
│  Agent is working...                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Type to steer the agent                             │  │
│  │  Ctrl+Enter: Interrupt · Alt+Enter: Wait             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Follow-Up Mode

```typescript
// User types and presses Alt+Enter during streaming
async function handleFollowUp(message: string): Promise<void> {
  await adapter.followUp(message);
  showToast('Message queued (will wait)');
  clearInput();
}
```

## Error States

### Attachment Error

```
┌──────────┐
│ ⚠️  [×]  │
│ error    │
│ file.pdf │
│ Too large│
└──────────┘
```

### Disabled State

When input is disabled (e.g., no API key):

```
┌────────────────────────────────────────────────────────────┐
│  ⚠️ Add an API key to start chatting                      │
│  ┌────────────────────────────────────────────────────┐   │
│  │ [Add API Key]                                      │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

## Accessibility

- **Label**: "Message input" for screen readers
- **Role**: `textbox` with `aria-multiline`
- **Announcements**: "Message sent", "Recording started"
- **Focus management**: Return focus after dialogs
