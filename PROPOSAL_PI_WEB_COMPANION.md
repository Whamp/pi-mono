# Pi Web Companion - Specification

## 1. Overview
**Pi Web Companion** is a Progressive Web App (PWA) that allows remote control of a local `pi` coding agent instance from any device (specifically mobile) via a web interface. It runs on the user's computer, exposing the full capabilities of the CLI agent (bash execution, file system access) to a mobile-friendly UI, secured by the user's private network (Tailscale).

## 2. Architecture

```mermaid
graph LR
    Phone[Mobile Phone / Browser] -- WebSocket (Secure Tailnet) --> Server[Node.js Server]
    Server -- stdio (JSON-RPC) --> Agent[Pi Agent (RPC Mode)]
```

*   **Host Machine**: Runs the Node.js Server and the Pi Agent.
*   **Transport**: WebSockets for real-time bidirectional communication.
*   **Protocol**: Direct tunneling of `pi` RPC commands and events.
*   **Security**: Tailscale handles network auth. Optional simple token auth for extra security.

## 3. Backend Specification (`packages/remote-server`)

### Technology Stack
*   **Runtime**: Node.js
*   **Framework**: Fastify (lightweight, fast) or just native `http` + `ws`.
*   **Dependencies**: `ws`, `fastify` (optional), `open` (to show QR code/url).

### Responsibilities
1.  **Process Management**: Spawn `pi` in RPC mode: `pi --mode rpc --no-session` (or managing sessions via RPC).
2.  **WebSocket Bridge**:
    *   Listen on `0.0.0.0:<port>`.
    *   Forward incoming WS messages to `pi` stdin.
    *   Forward `pi` stdout (JSON lines) to connected WS clients.
3.  **Auth**: Generate a random access token on startup. Require this token in the WS handshake/URL.
4.  **Static File Serving**: Serve the frontend PWA assets.

### API
*   `GET /`: Serves the PWA.
*   `GET /health`: Health check.
*   `WS /ws?token=<token>`: WebSocket endpoint for RPC.

## 4. Frontend Specification (`packages/remote-client`)

### Technology Stack
*   **Framework**: React or Lit (via `@mariozechner/pi-web-ui`).
*   **Build Tool**: Vite.
*   **Styling**: Tailwind CSS (matching `pi-web-ui` theme).

### UI Design (Mobile First)
*   **Home/Chat View**:
    *   Message list (User/Assistant).
    *   Streaming text/markdown rendering.
    *   Thinking blocks (collapsible).
    *   Tool use visualization (collapsible "Called `bash`...").
    *   Input bar with attachment button.
*   **Settings/Menu**:
    *   Model selector.
    *   Thinking level toggle.
    *   Theme toggle (Dark/Light).
    *   Connection status.

### Logic (The "Smart" Terminal)
Since `pi` in RPC mode does *not* handle slash commands, the Frontend must:
1.  **Parse Input**: Detect `/model`, `/clear`, `/branch`, etc.
2.  **Map to RPC**: Convert slash commands to corresponding `RpcCommand` JSONs.
    *   `/model gpt-4` -> `set_model`
    *   `/clear` -> `reset`
3.  **Handle Files**: Convert file uploads to `Attachment` objects (base64) to send with `prompt`.

## 5. Protocol (JSON-RPC Tunneling)

The WebSocket payload mirrors the `pi` RPC protocol defined in `packages/coding-agent/src/modes/rpc/rpc-types.ts`.

### Client -> Server (Commands)
```json
{
  "type": "prompt",
  "message": "Hello world",
  "id": "uuid-123"
}
```

### Server -> Client (Events & Responses)
```json
{
  "type": "response",
  "command": "prompt",
  "success": true,
  "id": "uuid-123"
}
```
```json
{
  "type": "text_delta",
  "content": "Hello",
  "messageId": "msg-123"
}
```

## 6. Implementation Plan

### Phase 1: Backend Scaffolding
1.  Create `packages/remote-server`.
2.  Implement `Server` class that spawns `pi` CLI (using the local `packages/coding-agent` build or binary).
3.  Implement WebSocket bridge.

### Phase 2: Frontend Scaffolding
1.  Create `packages/remote-client` (inside `remote-server` or sibling).
2.  Setup Vite + React/Lit + Tailwind.
3.  Implement basic WebSocket connection and `RpcClient` wrapper.

### Phase 3: UI Implementation
1.  Render chat history.
2.  Implement Markdown rendering (using `react-markdown` or `pi-web-ui` components if decouple-able).
3.  Implement Input handling and Slash Command parsing.

### Phase 4: Polish
1.  PWA Manifest (Icon, standard metadata).
2.  Auth Token generation and QR code display on server start.
3.  Testing over Tailscale.
