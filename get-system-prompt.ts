#!/usr/bin/env npx tsx

// Direct import without going through the SDK
import { buildSystemPrompt as buildSystemPromptInternal } from './packages/coding-agent/src/core/system-prompt.ts';

const result = buildSystemPromptInternal({
  cwd: process.cwd(),
});

console.log(result);
