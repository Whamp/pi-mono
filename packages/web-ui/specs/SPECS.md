# Pi Web UI Specifications

A full-featured, mobile-friendly web UI for Pi that supports both browser-only mode (direct LLM API calls) and remote session mode (connecting to existing Pi terminal sessions via RPC).

## Core

- [Overview](overview.md) - Design philosophy, goals, and high-level architecture
- [Architecture](architecture.md) - System components, data flow, and integration patterns

## Connection Modes

- [Browser Mode](modes/browser-mode.md) - Direct LLM API calls from browser
- [Remote Session Mode](modes/remote-session-mode.md) - Connecting to existing Pi terminal sessions

## UI Components

- [Layout](ui/layout.md) - Responsive layout, sidebar, main content area
- [Sidebar](ui/sidebar.md) - Conversation list, search, folders/projects
- [Chat](ui/chat.md) - Message display, streaming, tool output
- [Input](ui/input.md) - Message input, attachments, voice input
- [Artifacts](ui/artifacts.md) - Artifact panel, tabs, fullscreen, download
- [Dialogs](ui/dialogs.md) - Settings, model selector, API keys, session list
- [Header](ui/header.md) - Session title, controls, status indicators

## Features

- [Sessions](features/sessions.md) - Session management, persistence, branching
- [Models](features/models.md) - Model selection, thinking levels, switching
- [Tools](features/tools.md) - JavaScript REPL, artifacts, document extraction
- [Attachments](features/attachments.md) - File uploads, images, drag & drop
- [Search](features/search.md) - Search across conversations
- [Keyboard Shortcuts](features/keyboard-shortcuts.md) - Global and contextual shortcuts
- [Notifications](features/notifications.md) - Toast notifications, status updates

## Mobile

- [Mobile Layout](mobile/layout.md) - Responsive breakpoints, touch interactions
- [Mobile Navigation](mobile/navigation.md) - Gestures, bottom navigation, drawer

## Technical

- [Storage](technical/storage.md) - IndexedDB schema, sync, offline support
- [Networking](technical/networking.md) - WebSocket, RPC protocol, CORS proxy
- [State Management](technical/state-management.md) - Agent state, UI state, persistence
- [Error Handling](technical/error-handling.md) - Error categories, recovery, user feedback

## Styling

- [Theme](styling/theme.md) - Light/dark mode, color system, tokens
- [Typography](styling/typography.md) - Font scale, code blocks, markdown
- [Animations](styling/animations.md) - Transitions, loading states, micro-interactions
