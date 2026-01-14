import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createAgentSession,
  discoverAuthStorage,
  discoverModels,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent
} from '@mariozechner/pi-coding-agent';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from client/dist
// Assumes running from packages/droid root
const clientDist = path.resolve(process.cwd(), 'client/dist');
app.use(express.static(clientDist));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Map of WS to AgentSession
const sessions = new Map<WebSocket, AgentSession>();

wss.on('connection', async (ws) => {
  console.log('New client connected');

  try {
    const authStorage = await discoverAuthStorage();
    const modelRegistry = await discoverModels(authStorage);

    // Create session
    const { session } = await createAgentSession({
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
    });

    sessions.set(ws, session);

    // Subscribe to session events and forward to client
    const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify({ type: 'agent-event', event }));
        } catch (err) {
            console.error('Failed to serialize event', err);
        }
      }
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'prompt') {
            await session.prompt(msg.message);
        } else if (msg.type === 'abort') {
            session.abort();
        } else if (msg.type === 'steer') {
             session.steer(msg.message);
        }
      } catch (err) {
        console.error('Error processing message', err);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      unsubscribe();
      sessions.delete(ws);
    });

  } catch (err) {
    console.error('Failed to create agent session', err);
    ws.close(1011, 'Failed to create agent session');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
