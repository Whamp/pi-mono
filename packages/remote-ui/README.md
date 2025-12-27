# @mariozechner/pi-remote-ui

A mobile-friendly web interface for steering Pi sessions remotely via Tailscale (or any private network).

## Features

- **Mobile-First Design**: Built with `pi-web-ui` components optimized for touch and desktop.
- **Remote Steering**: Connect to your computer's Pi instance from your phone.
- **Session Management**: Create new sessions or resume existing ones.
- **Real-time Streaming**: Watch the agent think and execute tools in real-time.
- **Secure**: Designed to run behind Tailscale/VPN (no built-in auth).

## Prerequisites

- **Node.js**: v20 or later.
- **Tailscale**: Recommended for secure access from your phone.
- **Pi Monorepo**: You need to build the monorepo first.

## Installation

1.  **Build the Monorepo**:
    From the root of the `pi-mono` repository:
    ```bash
    npm install
    npm run build
    ```

## Usage

### 1. Start the Server

On your computer (where you want Pi to run):

```bash
cd packages/remote-ui
npm start
```

This starts the server on port `3000`.

### 2. Access from Phone

1.  Ensure your phone and computer are on the same Tailscale network (Tailnet).
2.  Find your computer's Tailscale IP address (e.g., `100.x.y.z`).
3.  Open a browser on your phone and go to:
    ```
    http://100.x.y.z:3000
    ```

### 3. Steering

- **New Session**: Click "Start New Session".
- **Resume**: Select an existing session from the list.
- **Chat**: Type messages to steer the agent. The agent runs on your computer, so it has access to your computer's files and tools.

## Development

Run in development mode with live reload:

```bash
cd packages/remote-ui
npm run dev
```
