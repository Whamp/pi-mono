# Models

Model selection, thinking level configuration, and runtime model switching.

## Overview

The model system allows users to:
- Select from available LLM models across providers
- Configure thinking/reasoning levels for extended thinking models
- Switch models mid-conversation
- Cycle through models and thinking levels via keyboard shortcuts

## Data Types

```typescript
interface Model {
  id: string;                     // e.g., "claude-sonnet-4-20250514"
  provider: string;               // e.g., "anthropic", "openai"
  name: string;                   // Display name, e.g., "Claude Sonnet 4"
  contextWindow: number;          // Max tokens
  maxOutputTokens: number;        // Max response tokens
  supportsThinking: boolean;      // Extended thinking support
  supportsImages: boolean;        // Vision capability
  supportsToolUse: boolean;       // Tool/function calling
  pricing?: ModelPricing;         // Cost information
}

interface ModelPricing {
  inputPerMillion: number;        // USD per 1M input tokens
  outputPerMillion: number;       // USD per 1M output tokens
  cacheReadPerMillion?: number;   // USD per 1M cached read tokens
  cacheWritePerMillion?: number;  // USD per 1M cached write tokens
}

type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

interface ModelCycleResult {
  model: Model;
  isFromCycle: boolean;
}
```

## Available Models

### By Provider

| Provider | Models | Thinking Support |
|----------|--------|-----------------|
| Anthropic | Claude Opus 4, Sonnet 4, Sonnet 4.5, Haiku 3.5 | Opus 4, Sonnet 4.5 |
| OpenAI | GPT-4o, GPT-4o Mini, o3, o4-mini | o3, o4-mini |
| Google | Gemini 2.5 Pro, Gemini 2.5 Flash | Gemini 2.5 Pro/Flash |
| xAI | Grok 3 | Grok 3 |
| Mistral | Mistral Large | No |
| DeepSeek | DeepSeek V3, DeepSeek R1 | DeepSeek R1 |
| Custom | Ollama, LM Studio, vLLM | Depends on model |

### Model Availability

**Browser Mode:**
- Models available if API key is configured for provider
- Custom providers available if configured

**Remote Mode:**
- Models available on the server (from server's `auth.json`)
- Fetched via `get_available_models` RPC command

## Thinking Levels

### Level Definitions

| Level | Budget Tokens | Use Case |
|-------|--------------|----------|
| `off` | 0 | Simple queries, quick responses |
| `minimal` | ~1,024 | Basic reasoning tasks |
| `low` | ~4,096 | Moderate complexity |
| `medium` | ~16,384 | Standard coding tasks |
| `high` | ~65,536 | Complex analysis, debugging |
| `xhigh` | ~262,144+ | Deep research, complex architecture |

### Provider-Specific Behavior

| Provider | Parameter | Notes |
|----------|-----------|-------|
| Anthropic | `budget_tokens` | Direct token budget |
| OpenAI | `reasoning_effort` | Maps to low/medium/high |
| Google | `thinking_config.thinking_budget` | Token count |
| DeepSeek | N/A | Always enabled for R1 |

### Thinking Level UI

**Header Badge:**
```
┌───────────────────────────────────────┐
│ 🤖 claude-sonnet-4 · thinking: high   │
└───────────────────────────────────────┘
```

**Abbreviations (Mobile):**
| Level | Abbrev |
|-------|--------|
| off | - |
| minimal | min |
| low | L |
| medium | M |
| high | H |
| xhigh | XH |

## Model Selection

### Model Selector Dialog

Opened via:
- Click model badge in header
- Click model badge in input area
- `Cmd/Ctrl+K` keyboard shortcut
- `/model` command in input

**Structure:**
```
┌──────────────────────────────────────────────────────────────┐
│  Select Model                                          [×]   │
├──────────────────────────────────────────────────────────────┤
│  🔍 [Search models...                               ]        │
├──────────────────────────────────────────────────────────────┤
│  Recently Used                                               │
│  ├─ ● Claude Sonnet 4 ← current                             │
│  └─ ○ GPT-4o                                                │
│                                                              │
│  Anthropic                                                   │
│  ├─ ○ Claude Opus 4        🧠 $15/$75/M    💬 200K           │
│  ├─ ● Claude Sonnet 4      🧠 $3/$15/M     💬 200K           │
│  └─ ○ Claude Haiku 3.5        $0.25/$1.25/M 💬 200K          │
│                                                              │
│  OpenAI                                                      │
│  ├─ ○ GPT-4o                  $2.50/$10/M  💬 128K           │
│  └─ ○ o3                   🧠 $10/$40/M    💬 200K           │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│  Thinking Level                                              │
│  ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐    │
│  │   Off   ││   Low   ││  Medium ││  High   ││  XHigh  │    │
│  └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Badges:**
- 🧠 = Supports extended thinking
- 💬 = Context window size

### Model Selection Flow

1. User opens model selector
2. Display models grouped by provider
3. Show current selection
4. Filter available models based on mode:
   - Browser: Models with configured API keys
   - Remote: Models available on server
5. User selects model
6. If thinking-capable, show thinking level options
7. Apply selection

```typescript
async function selectModel(model: Model, thinkingLevel?: ThinkingLevel): Promise<void> {
  // Validate model is available
  if (!isModelAvailable(model)) {
    showError('API key required for this model');
    return;
  }
  
  // Set model
  await adapter.setModel(model.provider, model.id);
  
  // Set thinking level if applicable
  if (thinkingLevel && model.supportsThinking) {
    await adapter.setThinkingLevel(thinkingLevel);
  } else if (!model.supportsThinking) {
    await adapter.setThinkingLevel('off');
  }
  
  // Update UI
  showToast(`Model: ${model.name}`);
}
```

## Model Cycling

Quick cycling through models without opening the selector.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+Shift+M` | Cycle to next model |
| `Ctrl/Cmd+Shift+T` | Cycle thinking level |

### Cycle Order

Models cycle in a fixed order (configurable in settings):

```typescript
const defaultCycleOrder = [
  'claude-sonnet-4',
  'claude-haiku-3.5',
  'gpt-4o',
  'gemini-2.5-flash',
];

async function cycleModel(): Promise<void> {
  const result = await adapter.cycleModel();
  if (result) {
    showToast(`Model: ${result.model.name}`);
  }
}
```

### Thinking Level Cycle

```typescript
const thinkingCycleOrder: ThinkingLevel[] = ['off', 'low', 'medium', 'high', 'xhigh'];

async function cycleThinkingLevel(): Promise<void> {
  const level = await adapter.cycleThinkingLevel();
  if (level) {
    showToast(`Thinking: ${level}`);
  }
}
```

## Model Switching Mid-Conversation

### Behavior

- Model can be changed at any point in conversation
- New messages use the new model
- Previous messages retain their original model attribution
- Message headers show which model generated each response

### Visual Indicator

When model changes mid-conversation:
```
┌─────────────────────────────────────────────────────────────┐
│ Assistant · claude-sonnet-4                                  │
│ Here's my analysis of the code...                           │
└─────────────────────────────────────────────────────────────┘

                    ─── Model changed to GPT-4o ───

┌─────────────────────────────────────────────────────────────┐
│ Assistant · gpt-4o                                           │
│ Let me provide an alternative perspective...                 │
└─────────────────────────────────────────────────────────────┘
```

## Model Validation

### API Key Check

Before model selection:

```typescript
function isModelAvailable(model: Model): boolean {
  if (mode === 'remote') {
    return availableModels.some(m => m.id === model.id);
  }
  
  // Browser mode: check API key
  return hasApiKey(model.provider);
}
```

### Capability Check

Before certain operations:

```typescript
function validateModelCapabilities(model: Model, operation: string): string | null {
  if (operation === 'image' && !model.supportsImages) {
    return `${model.name} does not support image analysis`;
  }
  if (operation === 'thinking' && !model.supportsThinking) {
    return `${model.name} does not support extended thinking`;
  }
  return null;
}
```

## Settings Integration

### Default Model

```typescript
interface ModelSettings {
  defaultModel: string | null;        // Model ID
  defaultThinkingLevel: ThinkingLevel;
  cycleOrder: string[];               // Model IDs
  showPricing: boolean;
  showContextSize: boolean;
}
```

**Settings UI (General Tab):**
```
┌──────────────────────────────────────────────────────────────┐
│ Default Model                                                │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Claude Sonnet 4                                       ▾ ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Default Thinking Level                                       │
│ ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐    │
│ │   Off   ││   Low   ││○ Medium ││  High   ││  XHigh  │    │
│ └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘    │
│                                                              │
│ ┌────┐ Show pricing in model selector                       │
│ │ ✓  │                                                      │
│ └────┘                                                      │
│                                                              │
│ ┌────┐ Show context window size                             │
│ │ ✓  │                                                      │
│ └────┘                                                      │
└──────────────────────────────────────────────────────────────┘
```

## Remote Mode Integration

### Fetching Available Models

```typescript
async function fetchRemoteModels(): Promise<Model[]> {
  const response = await adapter.sendCommand({ type: 'get_available_models' });
  return response.data.models;
}
```

### Model Sync

On connection to remote server:
1. Fetch available models
2. Update model selector options
3. Get current session's model
4. Display in UI

## Error Handling

| Error | Handling |
|-------|----------|
| API key missing | Prompt to add key before selection |
| Model not available | Show message, suggest alternatives |
| Model deprecated | Show warning, suggest replacement |
| Context limit exceeded | Trigger compaction, retry |
| Rate limit | Show countdown, auto-retry |

## Accessibility

- **Keyboard navigation**: Arrow keys in model list
- **Search**: Type to filter models
- **Announcements**: "Model changed to [name]"
- **Focus**: Return focus to input after selection
