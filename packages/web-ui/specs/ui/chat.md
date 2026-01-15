# Chat

The chat area displays the conversation history with streaming support, tool output rendering, and scroll management.

## Structure

```
┌────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Messages Area                        │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  User Message                                      │  │  │
│  │  │  "Can you help me refactor this code?"            │  │  │
│  │  │  [attachment.png]                                  │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Assistant Message                                 │  │  │
│  │  │  [Thinking block - collapsible]                   │  │  │
│  │  │  Sure! Let me take a look...                      │  │  │
│  │  │  ┌──────────────────────────────────────────────┐ │  │  │
│  │  │  │  Tool: read                                  │ │  │  │
│  │  │  │  📄 src/main.ts                              │ │  │  │
│  │  │  │  [Expand to see content]                     │ │  │  │
│  │  │  └──────────────────────────────────────────────┘ │  │  │
│  │  │  Here's my analysis...                            │  │  │
│  │  │  ```typescript                                    │  │  │
│  │  │  // refactored code                               │  │  │
│  │  │  ```                                              │  │  │
│  │  │  [Copy] [Regenerate]                              │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  ● Streaming response...                          │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [↓ Scroll to bottom] ← Appears when scrolled up               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Message Types

### User Message

```typescript
interface UserMessageProps {
  content: string | ContentBlock[];
  attachments?: Attachment[];
  timestamp: number;
  onEdit?: () => void;  // Future: edit and regenerate
}
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│                                    User Message │
│                                                 │
│  Can you help me refactor this code?           │
│                                                 │
│  ┌──────────┐                                  │
│  │ 📷       │  attachment.png                  │
│  │ preview  │  245 KB                          │
│  └──────────┘                                  │
│                                                 │
│                               12:34 PM    [✏️] │
└─────────────────────────────────────────────────┘
```

**Styling:**
- Right-aligned
- Background: `var(--color-user-bubble)`
- Rounded corners (larger on right side)
- Attachments shown as thumbnails

### Assistant Message

```typescript
interface AssistantMessageProps {
  content: AssistantContentBlock[];
  model: string;
  thinkingLevel?: ThinkingLevel;
  usage?: Usage;
  stopReason?: StopReason;
  timestamp: number;
  isStreaming: boolean;
  onCopy: () => void;
  onRegenerate?: () => void;
}

type AssistantContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'toolCall'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'toolResult'; toolCallId: string; toolName: string; content: ToolResultContent[]; isError: boolean };
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Assistant Message                               │
│ claude-sonnet-4 · thinking: medium              │
│                                                 │
│ ▸ Thinking (click to expand)                   │
│                                                 │
│ Sure! Let me analyze your code...              │
│                                                 │
│ ┌─────────────────────────────────────────────┐│
│ │ 📖 read                                     ││
│ │ src/main.ts                                 ││
│ │ ▸ Show content (245 lines)                  ││
│ └─────────────────────────────────────────────┘│
│                                                 │
│ Here's the refactored version:                  │
│                                                 │
│ ```typescript                                   │
│ export function improved() {                    │
│   // ...                                        │
│ }                                               │
│ ```                                    [📋 Copy]│
│                                                 │
│ 12:34 PM · 1,234 tokens · $0.02    [📋] [🔄]   │
└─────────────────────────────────────────────────┘
```

**Styling:**
- Left-aligned
- Background: `var(--color-assistant-bubble)` or none
- Model badge in header
- Footer with metadata and actions

### Tool Call/Result

```typescript
interface ToolCallProps {
  toolName: string;
  toolCallId: string;
  arguments: Record<string, unknown>;
  result?: ToolResultContent[];
  isStreaming: boolean;
  isExpanded: boolean;
  isError: boolean;
  onToggle: () => void;
}
```

**Tool-specific renderers:**

| Tool | Collapsed View | Expanded View |
|------|---------------|---------------|
| `read` | "📖 {path}" | Syntax-highlighted content |
| `bash` | "⌨️ {command}" | Terminal output |
| `edit` | "✏️ {path}" | Diff view (old/new) |
| `write` | "📝 Created {path}" | File content |
| `grep` | "🔍 {pattern}" | Matches with line numbers |
| `find` | "📂 {pattern}" | File list |
| `ls` | "📁 {path}" | Directory listing |
| `javascript_repl` | "▶️ JavaScript" | Code + output |
| `artifacts` | "🎨 {filename}" | Artifact preview/link |

**Streaming tool output:**
```
┌─────────────────────────────────────────────────┐
│ ⌨️ bash                                         │
│ npm test                                        │
│ ┌─────────────────────────────────────────────┐│
│ │ Running tests...                            ││
│ │ ✓ test 1 passed                             ││
│ │ ✓ test 2 passed                             ││
│ │ ● running test 3...                         ││ ← Streaming indicator
│ └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### Thinking Block

```typescript
interface ThinkingBlockProps {
  content: string;
  isExpanded: boolean;
  onToggle: () => void;
}
```

**Collapsed:**
```
▸ Thinking (click to expand)
```

**Expanded:**
```
▾ Thinking
┌─────────────────────────────────────────────────┐
│ Let me analyze the user's request...            │
│ They want to refactor code, so I should...      │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

**Styling:**
- Muted background
- Italic text
- Smaller font size
- Collapsible by default (unless user preference)

### Streaming Indicator

```typescript
interface StreamingIndicatorProps {
  type: 'text' | 'thinking' | 'tool';
  toolName?: string;
}
```

**Text streaming:**
```
I'm analyzing your code and| ← Blinking cursor
```

**Tool streaming:**
```
┌─────────────────────────────────────────────────┐
│ ⌨️ bash                              ●●●        │ ← Animated dots
│ Running: npm test                               │
└─────────────────────────────────────────────────┘
```

## Code Blocks

```typescript
interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  onCopy: () => void;
}
```

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ typescript                          [📋 Copy]   │
├─────────────────────────────────────────────────┤
│  1 │ export function hello() {                  │
│  2 │   console.log("Hello");                    │
│  3 │ }                                          │
└─────────────────────────────────────────────────┘
```

**Features:**
- Syntax highlighting (highlight.js or similar)
- Line numbers (optional, on by default for >3 lines)
- Copy button (top-right)
- Language badge (top-left)
- Horizontal scroll for long lines

## Scroll Management

### Auto-scroll Behavior

```typescript
interface ScrollBehavior {
  // Auto-scroll when:
  // 1. New message arrives and user is near bottom
  // 2. Streaming content updates and user is near bottom
  
  nearBottomThreshold: number;  // 100px
  
  isNearBottom(): boolean;
  scrollToBottom(smooth?: boolean): void;
  maintainPosition(): void;  // For content above viewport
}
```

### Scroll-to-Bottom Button

Appears when user scrolls up during streaming:

```
             ┌─────────────────┐
             │  ↓ New messages │
             └─────────────────┘
```

**Behavior:**
- Shows when scrolled >200px from bottom during streaming
- Badge shows number of new messages
- Click scrolls to bottom smoothly
- Auto-hides after 2s when at bottom

## Message Actions

### Copy Button

Copies message content (text only, no tool outputs):

```typescript
async function copyMessage(message: AssistantMessage): Promise<void> {
  const text = message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
  await navigator.clipboard.writeText(text);
  showToast('Copied to clipboard');
}
```

### Regenerate Button (Future)

Regenerates assistant response from previous user message:

```typescript
async function regenerate(messageId: string): Promise<void> {
  // 1. Find previous user message
  // 2. Remove all messages after it
  // 3. Re-send the user message
}
```

### Edit User Message (Future)

Edits user message and regenerates:

```typescript
async function editMessage(messageId: string, newContent: string): Promise<void> {
  // 1. Create branch from message's parent
  // 2. Send new content
  // 3. Get new response
}
```

## Empty State

When no messages:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                      🤖                         │
│                                                 │
│              How can I help you?                │
│                                                 │
│    ┌─────────────────────────────────────┐     │
│    │ 💡 Refactor my authentication code │     │
│    └─────────────────────────────────────┘     │
│    ┌─────────────────────────────────────┐     │
│    │ 📝 Write tests for the API         │     │
│    └─────────────────────────────────────┘     │
│    ┌─────────────────────────────────────┐     │
│    │ 🐛 Debug the login issue           │     │
│    └─────────────────────────────────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Suggested prompts:**
- Context-aware based on project (remote mode)
- Generic coding tasks (browser mode)
- Clickable to pre-fill input

## Loading States

### Initial Load

Skeleton messages while loading session:

```
┌─────────────────────────────────────────────────┐
│                                    ░░░░░░░░░░░░ │
│                                    ░░░░░░░░░    │
│                                                 │
│ ░░░░░░░░░░░░░░░░░░░                            │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░              │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │
│ ░░░░░░░░░░░░░░░░                               │
└─────────────────────────────────────────────────┘
```

### Waiting for Response

After sending message, before first token:

```
┌─────────────────────────────────────────────────┐
│ Assistant                                       │
│ ●●● Thinking...                                 │
└─────────────────────────────────────────────────┘
```

## Error States

### Rate Limit

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Rate Limited                                 │
│                                                 │
│ Too many requests. Retrying in 45 seconds...   │
│                                                 │
│ [Cancel] [Retry Now]                           │
└─────────────────────────────────────────────────┘
```

### Context Overflow

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Context Too Long                             │
│                                                 │
│ Conversation is too long. Compacting...        │
│                                                 │
│ ●●●                                            │
└─────────────────────────────────────────────────┘
```

### Network Error

```
┌─────────────────────────────────────────────────┐
│ ❌ Request Failed                               │
│                                                 │
│ Could not reach the server. Check your         │
│ connection and try again.                      │
│                                                 │
│ [Retry]                                         │
└─────────────────────────────────────────────────┘
```

## Virtualization

For long conversations:

```typescript
interface VirtualizedMessagesProps {
  messages: AgentMessage[];
  estimateSize: (message: AgentMessage) => number;
  overscan: number;
}
```

**Implementation notes:**
- Variable height items (messages have different sizes)
- Maintain scroll position on prepend (for branching)
- Cache rendered heights
- Smooth scrolling on navigate

## Accessibility

- **Screen reader**: Announce new messages
- **Keyboard**: Navigate between messages with arrow keys
- **Focus**: Skip to latest message link
- **ARIA live regions**: For streaming updates
