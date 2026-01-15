# Pi Monorepo Work Plan

This document tracks issues to fix, one at a time. Each issue includes:
- Description and context
- Files to investigate
- Verification steps
- Regression protection

**How to use this plan:**
1. Pick the next uncompleted issue (marked `[ ]`)
2. Read the issue context and files
3. Implement the fix
4. Run verification steps
5. Run `npm run check` and `npm test` to ensure no regressions
6. Mark the issue as `[x]` when complete
7. Add notes about what was done

---

## Progress Tracker

| # | Issue | Priority | Status | Package |
|---|-------|----------|--------|---------|
| 1 | [#732](#issue-1-732-editor-overflow) | Critical | [ ] | coding-agent |
| 2 | [#708](#issue-2-708-stdin-breaks-pi) | Critical | [ ] | coding-agent |
| 3 | [#733](#issue-3-733-codex-connection-errors) | High | [ ] | ai |
| 4 | [#699](#issue-4-699-vercel-ai-gateway-usage) | Medium | [ ] | ai |
| 5 | [#583](#issue-5-583-openrouter-cache-markers) | Medium | [ ] | ai |
| 6 | [#678](#issue-6-678-bedrock-improvements) | Low | [ ] | ai |
| 7 | [#671](#issue-7-671-auto-attach-files) | Low | [ ] | coding-agent |

---

## Issue 1: #732 Editor Overflow

**GitHub:** https://github.com/badlogic/pi-mono/issues/732  
**Priority:** Critical  
**Package:** `pkg:coding-agent`

### Problem
When `setEditorText` is called with text larger than the terminal screen, the UI breaks completely. Escape key stops working (ctrl+c still works). The editor component doesn't scroll when reaching terminal limits.

### Files to Investigate
```
packages/coding-agent/src/modes/interactive/
├── interactive-mode.ts       # Main mode, handles editor
├── components/
│   ├── Editor.ts             # Primary suspect - editor component
│   └── EditorArea.ts         # Editor area rendering
packages/tui/src/
├── Component.ts              # Base component class
├── Screen.ts                 # Screen/viewport handling
└── Box.ts                    # Layout box constraints
```

### Investigation Steps
1. Read `packages/coding-agent/src/modes/interactive/components/Editor.ts` fully
2. Read `packages/coding-agent/src/modes/interactive/components/EditorArea.ts`
3. Understand how the editor calculates its height
4. Look for `setEditorText` usage and trace the flow
5. Check how scrolling is (or isn't) implemented

### Likely Fix
- Add scroll capability to editor when content exceeds available height
- Ensure the editor respects terminal height constraints
- Preserve keyboard handling even when overflow occurs

### Verification
```bash
# Manual test - start pi and paste a very long prompt
cd packages/coding-agent
npx tsx src/cli.ts

# Then test:
# 1. Paste 100+ lines of text into the editor
# 2. Verify scrolling works
# 3. Verify Escape key works
# 4. Verify ctrl+c works
```

### Regression Protection
```bash
npm run check  # Must pass
npm test       # Must pass
```

### Notes
_Add implementation notes here after completing_

---

## Issue 2: #708 stdin Breaks Pi

**GitHub:** https://github.com/badlogic/pi-mono/issues/708  
**Priority:** Critical  
**Package:** `pkg:coding-agent`

### Problem
When piping input via stdin (`echo hi | pi --no-tools`), escape sequences appear at the top, and typed input isn't processed correctly. The interactive mode doesn't handle non-TTY stdin properly.

### Files to Investigate
```
packages/coding-agent/src/
├── cli.ts                    # CLI entry point
├── modes/
│   ├── interactive/
│   │   └── interactive-mode.ts   # Interactive mode init
│   └── non-interactive/
│       └── non-interactive-mode.ts   # Non-interactive handling
packages/tui/src/
├── Screen.ts                 # Screen/input handling
└── Input.ts                  # Input stream handling
```

### Investigation Steps
1. Read `packages/coding-agent/src/cli.ts` - check how stdin is detected
2. Read how interactive vs non-interactive mode is selected
3. Check if there's stdin detection (e.g., `process.stdin.isTTY`)
4. Understand escape sequence origin (`^[[?0u^[[6;32;16t`)

### Likely Fix Options
1. **Detect piped stdin** and switch to non-interactive mode automatically
2. **Document stdin usage** if it's intentionally not supported
3. **Handle stdin input** properly in interactive mode

### Verification
```bash
cd packages/coding-agent

# Test 1: Piped input
echo "hi" | npx tsx src/cli.ts --no-tools

# Test 2: Heredoc input
npx tsx src/cli.ts --no-tools <<EOF
Hello, world
EOF

# Test 3: Normal interactive (regression check)
npx tsx src/cli.ts --no-tools
```

### Regression Protection
```bash
npm run check
npm test
```

### Notes
_Add implementation notes here after completing_

---

## Issue 3: #733 Codex Connection Errors

**GitHub:** https://github.com/badlogic/pi-mono/issues/733  
**Priority:** High  
**Package:** `pkg:ai`

### Problem
gpt-5.2-codex occasionally errors out mid-run with:
```
Error: upstream connect error or disconnect/reset before headers. retried and the latest reset
reason: remote connection failure, transport failure reason: delayed connect error: Connection refused
```

### Files to Investigate
```
packages/ai/src/
├── stream.ts                 # Main streaming logic
├── providers/
│   └── openai-codex/
│       ├── index.ts          # Codex provider
│       └── stream.ts         # Codex streaming
└── utils/
    └── retry.ts              # Retry logic (if exists)
```

### Investigation Steps
1. Read `packages/ai/src/providers/openai-codex/stream.ts`
2. Check current retry/error handling logic
3. Look for existing retry patterns in other providers (e.g., `packages/ai/src/stream.ts`)
4. Check if `fetch failed` auto-retry was recently added (see commit `fb6d464e`)

### Likely Fix
- Improve retry logic for connection errors
- Add exponential backoff for transient failures
- Ensure "upstream connect error" is caught and retried

### Verification
```bash
# Requires OPENAI_CODEX credentials
cd packages/ai
npm test -- test/openai-codex.test.ts
npm test -- test/openai-codex-stream.test.ts
```

### Regression Protection
```bash
npm run check
npm test
```

### Notes
_Add implementation notes here after completing_

---

## Issue 4: #699 Vercel AI Gateway Usage

**GitHub:** https://github.com/badlogic/pi-mono/issues/699  
**Priority:** Medium  
**Package:** `pkg:ai`

### Problem
Vercel AI Gateway reports no/incorrect usage statistics. Related to issue #689.

### Files to Investigate
```
packages/ai/src/providers/
├── vercel-ai-gateway/
│   ├── index.ts              # Provider implementation
│   └── stream.ts             # Streaming logic
└── openai-completions.ts     # May be used as base
packages/ai/test/
└── total-tokens.test.ts      # Token/usage tests
```

### Investigation Steps
1. Read `packages/ai/src/providers/vercel-ai-gateway/` implementation
2. Check how usage is extracted from responses
3. Compare with working providers (e.g., anthropic, openai)
4. Look at issue #689 for more details

### Likely Fix
- Parse usage data from Vercel AI Gateway response format
- May need to handle different response structure

### Verification
```bash
# Requires VERCEL_AI_GATEWAY credentials
npm test -- test/total-tokens.test.ts
```

### Regression Protection
```bash
npm run check
npm test
```

### Notes
_Add implementation notes here after completing_

---

## Issue 5: #583 OpenRouter Cache Markers

**GitHub:** https://github.com/badlogic/pi-mono/issues/583  
**Priority:** Medium  
**Package:** `pkg:ai`

### Problem
When using Anthropic models via OpenRouter, `cache_control: { type: "ephemeral" }` markers are not added to messages. OpenRouter routes through `openai-completions.js` instead of `anthropic.js`, so no cache markers are added.

### Files to Investigate
```
packages/ai/src/providers/
├── openrouter/
│   ├── index.ts              # OpenRouter provider
│   └── stream.ts             # Streaming implementation
├── anthropic.ts              # Has cache_control logic
└── openai-completions.ts     # Used by OpenRouter
packages/ai/src/
└── types.ts                  # Message types with cache_control
```

### Investigation Steps
1. Read `packages/ai/src/providers/openrouter/stream.ts`
2. Read `packages/ai/src/providers/anthropic.ts` to understand cache logic
3. Check OpenRouter API docs for cache_control support
4. Determine if OpenRouter passes through cache_control to underlying Anthropic API

### Likely Fix
- Detect Anthropic models in OpenRouter provider
- Add cache_control markers for Anthropic models
- Test with actual OpenRouter + Anthropic model

### Verification
```bash
# Requires OPENROUTER_API_KEY
# Manual verification: check OpenRouter dashboard for cache usage
```

### Regression Protection
```bash
npm run check
npm test
```

### Notes
_Add implementation notes here after completing_

---

## Issue 6: #678 Bedrock Improvements

**GitHub:** https://github.com/badlogic/pi-mono/issues/678  
**Priority:** Low  
**Package:** `pkg:ai`

### Problem
Two areas for improvement:
1. Tests only cover Claude models - need tests for Nova, Llama, Mistral, AI21, Cohere
2. Thinking support needed for non-Claude models (DeepSeek R1, Nova Premier, Qwen3)

### Files to Investigate
```
packages/ai/src/providers/
└── bedrock-converse-stream/
    ├── index.ts              # Bedrock provider
    └── stream.ts             # Streaming logic
packages/ai/test/
├── bedrock-models.test.ts    # Existing Bedrock tests
└── stream.test.ts            # General stream tests
```

### Investigation Steps
1. Read existing Bedrock tests in `packages/ai/test/bedrock-models.test.ts`
2. Check which models are currently tested
3. Research thinking token format for non-Claude models:
   - DeepSeek R1: `<think>` tags
   - Nova Premier: vendor-specific?
   - Qwen3: vendor-specific?

### Likely Fix
- Add test cases for non-Claude models
- Implement `<think>` tag parsing for DeepSeek R1
- Add vendor-specific thinking extraction where supported

### Verification
```bash
# Requires AWS Bedrock credentials
npm test -- test/bedrock-models.test.ts
npm test -- test/stream.test.ts
```

### Regression Protection
```bash
npm run check
npm test
```

### Notes
_Add implementation notes here after completing_

---

## Issue 7: #671 Auto-attach Files

**GitHub:** https://github.com/badlogic/pi-mono/issues/671  
**Priority:** Low  
**Package:** `pkg:coding-agent`

### Problem
When editor text contains file paths to images (e.g., pasted screenshot paths), they should be auto-detected and attached. Also consider a `+` prefix (like `@`) to search and auto-attach file contents.

Example path:
```
/var/folders/49/.../Screenshot 2026-01-12 at 22.52.31.png
```

### Files to Investigate
```
packages/coding-agent/src/modes/interactive/
├── interactive-mode.ts       # Editor handling
├── components/
│   └── Editor.ts             # Editor component
└── attachments.ts            # Attachment handling (if exists)
packages/coding-agent/src/core/
└── tools/                    # File-related tools
```

### Investigation Steps
1. Understand current `@` prefix file attachment behavior
2. Read editor text processing logic
3. Determine regex for detecting file paths
4. Check how images are currently attached

### Likely Fix
- Add regex detection for common file paths
- Auto-convert detected image paths to attachments
- Optionally add `+` prefix for file content attachment

### Verification
```bash
cd packages/coding-agent
npx tsx src/cli.ts

# Test:
# 1. Paste a screenshot path into editor
# 2. Verify it's detected as an image attachment
```

### Regression Protection
```bash
npm run check
npm test
```

### Notes
_Add implementation notes here after completing_

---

## General Workflow

### Before Starting Any Issue
```bash
cd /home/will/tools/pi-web-ui
git status                    # Ensure clean working directory
git pull                      # Get latest changes
npm install                   # Update dependencies
npm run build                 # Build all packages
npm run check                 # Baseline - should pass
```

### After Completing Each Issue
```bash
npm run check                 # Must pass
npm test                      # Must pass (with API keys unset)
git add -A
git commit -m "fix(pkg): description (fixes #NNN)"
```

### Test Command Reference
```bash
# Full test suite (no API keys)
./test.sh

# Specific package tests
npm test -w @mariozechner/pi-ai
npm test -w @mariozechner/pi-coding-agent

# Specific test file
npm test -- packages/ai/test/stream.test.ts
```

---

## Excluded from Plan (Large Features)

These issues are feature requests requiring significant design work:

- **#645** - Extension package management and hot reload (has detailed spec in issue)
- **#563** - MCP extension example
- **#412** - Refactor/rewrite Mom
- **#697** - Pull API keys with a command
- **#258** - Comprehensive hand-off test

---

## Code TODOs in Source

Found in codebase:
```
packages/ai/scripts/generate-models.ts:
  // TODO: Remove Claude models once PR is merged

packages/ai/test/stream.test.ts:
  // FIXME Skip for now, getting a 422 status code

packages/mom/src/agent.ts:
  // Hardcoded model for now - TODO: make configurable (issue #63)

packages/web-ui/example/src/main.ts:
  // TODO: Fix PersistentStorageDialog - currently broken

packages/web-ui/src/components/SandboxedIframe.ts:
  // TODO the font-size is needed, as chrome seems to inject a stylesheet
```

---

## Changelog Updates

After fixing issues, update the relevant changelog:

```
packages/ai/CHANGELOG.md          # For ai package fixes
packages/coding-agent/CHANGELOG.md  # For coding-agent fixes
packages/tui/CHANGELOG.md         # For tui fixes
```

Add entries under `## [Unreleased]` → `### Fixed`:
```markdown
- Fixed issue description ([#NNN](https://github.com/badlogic/pi-mono/issues/NNN))
```
