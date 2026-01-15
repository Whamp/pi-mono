# Browser Mode

Browser mode enables direct LLM API calls from the browser without requiring a Pi server. This is the existing functionality from the example application, extended with additional features.

## Overview

In browser mode:
- The `Agent` from `@mariozechner/pi-agent-core` runs entirely in the browser
- LLM calls are made directly to provider APIs (with CORS proxy when needed)
- Sessions are stored in IndexedDB
- Tools are limited to browser-compatible ones (JavaScript REPL, artifacts)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    BrowserModeAdapter                      │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Agent (pi-agent-core)                              │  │  │
│  │  │  ┌──────────────┐  ┌──────────────────────────────┐ │  │  │
│  │  │  │  State       │  │  streamFn (pi-ai)            │ │  │  │
│  │  │  │  - messages  │  │  - createStreamFn()          │ │  │  │
│  │  │  │  - model     │  │  - CORS proxy handling       │ │  │  │
│  │  │  │  - tools     │  │                              │ │  │  │
│  │  │  └──────────────┘  └──────────────────────────────┘ │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Tools                                              │  │  │
│  │  │  - JavaScript REPL (sandboxed iframe)               │  │  │
│  │  │  - Artifacts (create/update HTML, SVG, MD, etc.)    │  │  │
│  │  │  - Extract Document (via CORS proxy)                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  IndexedDB                                                 │  │
│  │  - SessionsStore (full message history)                    │  │
│  │  - ProviderKeysStore (API keys)                           │  │
│  │  - SettingsStore (preferences)                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (with CORS proxy for some providers)
                              ▼
                    ┌──────────────────┐
                    │  LLM Provider    │
                    │  APIs            │
                    └──────────────────┘
```

## Supported Providers

| Provider | Direct Access | Requires CORS Proxy |
|----------|--------------|---------------------|
| Anthropic | API keys only | OAuth tokens (sk-ant-oat-*) |
| OpenAI | Yes | No |
| Google | Yes | No |
| Mistral | Yes | No |
| Groq | Yes | No |
| xAI | Yes | No |
| OpenRouter | Yes | No |
| ZAI | No | Always |
| Custom (Ollama, etc.) | Depends | Usually no |

## Available Tools

### JavaScript REPL

Executes JavaScript in a sandboxed iframe environment.

**Capabilities:**
- Full JavaScript execution
- Access to browser APIs (limited by sandbox)
- Can read/write artifacts
- Can access attachments

**Limitations:**
- No filesystem access
- No network requests (except via artifacts)
- No persistent state between calls

### Artifacts Tool

Creates and updates interactive content.

**Supported formats:**
- HTML (rendered in sandboxed iframe)
- SVG (vector graphics)
- Markdown (rendered)
- JSON (formatted view)
- Text (plain text)
- Images (base64 or URL)
- PDF, DOCX, XLSX (preview)

### Extract Document Tool

Fetches and extracts text from URLs.

**Capabilities:**
- Fetches URL content via CORS proxy
- Extracts readable text
- Handles HTML, PDF, and other formats

## Session Storage

Sessions in browser mode are stored in IndexedDB with this structure:

```typescript
interface BrowserSession {
  id: string;                    // UUID
  title: string;                 // Display title
  model: Model;                  // Current model
  thinkingLevel: ThinkingLevel;  // Thinking level
  messages: AgentMessage[];      // Full message history
  createdAt: string;             // ISO timestamp
  lastModified: string;          // ISO timestamp
}

interface BrowserSessionMetadata {
  id: string;
  title: string;
  createdAt: string;
  lastModified: string;
  messageCount: number;
  usage: UsageStats;
  modelId: string | null;
  thinkingLevel: ThinkingLevel;
  preview: string;              // First message snippet
}
```

## API Key Management

API keys are stored per-provider in IndexedDB:

```typescript
interface ProviderKey {
  provider: string;  // 'anthropic', 'openai', etc.
  key: string;       // API key
  addedAt: string;   // ISO timestamp
}
```

**Security:**
- Keys are stored in IndexedDB (encrypted at rest by browser)
- Never transmitted to any server except the provider API
- Can be cleared individually or all at once

## CORS Proxy Configuration

For providers that don't support browser CORS:

```typescript
interface ProxySettings {
  enabled: boolean;
  url: string;  // e.g., 'https://corsproxy.io/?'
}
```

**Default proxy:** `https://corsproxy.io/?`

**Usage:**
- Automatically applied for ZAI (always)
- Applied for Anthropic OAuth tokens
- User-configurable for custom providers

## Event Mapping

The `BrowserModeAdapter` maps `Agent` events to the unified `SessionEvent` interface:

| Agent Event | SessionEvent |
|-------------|--------------|
| `agent_start` | `session_start` |
| `agent_end` | `session_end` |
| `message_start` | `message_start` |
| `message_update` | `message_update` |
| `message_end` | `message_end` |
| `turn_start` | `turn_start` |
| `turn_end` | `turn_end` |
| (internal) | `tool_execution_start` |
| (internal) | `tool_execution_update` |
| (internal) | `tool_execution_end` |

## Limitations vs Remote Mode

| Feature | Browser Mode | Remote Mode |
|---------|--------------|-------------|
| File read/write | ❌ | ✅ |
| Bash execution | ❌ | ✅ |
| Code editing | ❌ | ✅ |
| Project context | ❌ | ✅ |
| Extensions | ❌ | ✅ |
| Skills | ❌ | ✅ |
| Session branching | ❌ (simplified) | ✅ (full tree) |
| Offline support | ✅ (full) | ✅ (read-only) |
| Custom tools | ❌ | ✅ |

## Initialization Flow

```
1. Load settings from IndexedDB
2. Load API keys from IndexedDB
3. Check for session in URL (?session=<id>)
4. If session found:
   a. Load session data from IndexedDB
   b. Reconstruct Agent state
   c. Display messages
5. If no session:
   a. Create new Agent with default system prompt
   b. Display empty chat
6. Set up event listeners
7. Ready for user input
```

## Offline Support

Browser mode supports full offline operation:

1. **Cached LLM responses**: Previous conversations viewable offline
2. **Draft messages**: Unsent messages saved and synced when online
3. **Session metadata**: All sessions browsable offline
4. **Artifacts**: Cached for offline viewing

**Not available offline:**
- New LLM requests
- URL content extraction
- Model switching (if models not cached)
