#!/usr/bin/env npx tsx

import { buildSystemPrompt } from './packages/coding-agent/src/core/sdk.ts';

const result = buildSystemPrompt({
  cwd: process.cwd(),
});

console.log(result);
