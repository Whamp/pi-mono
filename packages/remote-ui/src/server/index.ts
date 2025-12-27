import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { handleWebSocketConnection } from './websocket.js';
import { listSessions } from './session-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from the React client
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// API Endpoints
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await listSessions();
        res.json(sessions);
    } catch (err) {
        console.error("Error listing sessions:", err);
        res.status(500).json({ error: "Failed to list sessions" });
    }
});

// WebSocket handling
wss.on('connection', (ws) => {
    console.log('Client connected');
    handleWebSocketConnection(ws);
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
