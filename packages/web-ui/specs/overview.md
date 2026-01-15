# Overview

## Purpose

Pi Web UI is a full-featured, mobile-friendly web application for interacting with AI assistants. It provides two primary modes:

1. **Browser Mode**: Direct LLM API calls from the browser (existing functionality)
2. **Remote Session Mode**: Connect to existing Pi terminal sessions running on a server

The key differentiator is the ability to resume and interact with Pi sessions that are running in a terminal on another machine (laptop, server, cloud VM) from a mobile browser.

## Design Goals

### Primary Goals

1. **Mobile-First**: Designed primarily for mobile use, with desktop as a secondary but fully-supported platform
2. **Session Continuity**: Resume existing Pi terminal sessions from anywhere
3. **Feature Parity**: Support all Pi features available via RPC (prompts, steering, tools, artifacts, branching)
4. **Offline Capable**: Work offline with cached sessions (browser mode only)
5. **Low Latency**: Streaming responses with real-time tool output

### Non-Goals

1. **Replacing the TUI**: The terminal UI remains the primary interface for power users
2. **Tool Execution in Browser**: In remote mode, tools execute on the server, not in the browser
3. **Full Extension Support**: Extensions are server-side; the web UI renders their output

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Pi Web UI                                      │
│  ┌────────────────────────┐    ┌────────────────────────────────────┐   │
│  │      Browser Mode      │    │       Remote Session Mode          │   │
│  │  ┌──────────────────┐  │    │  ┌──────────────────────────────┐  │   │
│  │  │   pi-agent-core  │  │    │  │    WebSocket RPC Client      │  │   │
│  │  │   pi-ai (stream) │  │    │  │    (connects to pi --mode rpc)│  │   │
│  │  └──────────────────┘  │    │  └──────────────────────────────┘  │   │
│  └────────────────────────┘    └────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Shared UI Components                          │   │
│  │  ChatPanel │ Sidebar │ ArtifactsPanel │ Dialogs │ Input          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Storage Layer (IndexedDB)                     │   │
│  │  Settings │ API Keys │ Sessions │ Connection Profiles            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket (Remote Mode)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Pi Server (Optional)                              │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  pi --mode rpc --session /path/to/session.jsonl                │     │
│  │  (or WebSocket wrapper around RPC)                              │     │
│  └────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

## User Personas

### Mobile User (Primary)
- Uses Pi on laptop/desktop during work
- Wants to check on long-running sessions from phone
- Needs to steer or follow-up on tasks while away from desk
- Values quick access and minimal friction

### Browser-Only User (Secondary)
- No terminal access or prefers browser interface
- Uses direct API keys
- Wants full chat experience with artifacts
- May use on tablet or desktop

### Power User (Tertiary)
- Uses both TUI and web UI interchangeably
- Wants seamless session continuity
- May run multiple sessions across machines
- Values keyboard shortcuts and efficiency

## Key Differentiators from Claude.ai

| Feature | Claude.ai | Pi Web UI |
|---------|-----------|-----------|
| Session Source | Cloud-only | Local files + Remote RPC |
| Tool Execution | Cloud sandbox | Local machine (via Pi) |
| Session Branching | Limited | Full tree navigation |
| Offline Support | No | Yes (browser mode) |
| Custom Tools | No | Via Pi extensions |
| Self-Hosted | No | Yes |
| API Key Storage | Cloud account | Local IndexedDB |

## Connection Modes Comparison

| Aspect | Browser Mode | Remote Session Mode |
|--------|--------------|---------------------|
| LLM Calls | Direct from browser | Via Pi server |
| Tool Execution | Browser sandbox (JS REPL only) | Server-side (read, bash, edit, write) |
| Session Storage | IndexedDB | Server filesystem |
| Offline | Full support | Read-only cached |
| Latency | Direct | Additional hop |
| API Keys | Stored in browser | Stored on server |
| Features | Subset (artifacts, JS REPL) | Full Pi capabilities |

## Success Metrics

1. **Mobile Usability**: Task completion rate on mobile ≥ 90% of desktop
2. **Connection Reliability**: Remote session reconnection success ≥ 99%
3. **Response Latency**: P95 time-to-first-token < 500ms (excluding LLM latency)
4. **Offline Availability**: Cached sessions accessible within 1 second
5. **Feature Coverage**: 100% of RPC commands supported in UI
