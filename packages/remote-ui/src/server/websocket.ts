import type { WebSocket } from 'ws';
import { AgentManager } from './agent-manager.js';
import { AgentSession } from '@mariozechner/pi-coding-agent';

// Protocol types
type ClientMessage =
    | { type: 'start_session'; sessionPath?: string }
    | { type: 'prompt'; text: string; attachments?: any[] }
    | { type: 'abort' }
    | { type: 'set_model'; provider: string; modelId: string }
    ;

const agentManager = new AgentManager();

export function handleWebSocketConnection(ws: WebSocket) {
    let currentSession: AgentSession | null = null;
    let unsubscribe: (() => void) | null = null;

    const send = (data: any) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(data));
        }
    };

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString()) as ClientMessage;

            switch (message.type) {
                case 'start_session': {
                    if (currentSession) {
                        if (unsubscribe) unsubscribe();
                        currentSession = null;
                    }

                    try {
                        currentSession = await agentManager.createSession(message.sessionPath);

                        unsubscribe = currentSession.subscribe((event) => {
                            send({ type: 'agent_event', event });

                            // Check for completion events to sync history
                            if (event.type === 'agent_end') {
                                send({
                                    type: 'turn_complete',
                                    history: currentSession?.messages
                                });
                            }
                        });

                        send({
                            type: 'session_started',
                            sessionId: currentSession.sessionId,
                            sessionFile: currentSession.sessionFile,
                            history: currentSession.messages,
                            model: currentSession.model
                        });

                    } catch (err: any) {
                        send({ type: 'error', message: `Failed to start session: ${err.message}` });
                    }
                    break;
                }

                case 'prompt': {
                    if (!currentSession) {
                        send({ type: 'error', message: 'No active session' });
                        return;
                    }
                    try {
                        await currentSession.prompt(message.text, { attachments: message.attachments });
                    } catch (err: any) {
                        send({ type: 'error', message: `Prompt failed: ${err.message}` });
                    }
                    break;
                }

                case 'abort': {
                    if (currentSession) {
                         await currentSession.abort();
                    }
                    break;
                }
            }
        } catch (err) {
            console.error('WebSocket error:', err);
        }
    });

    ws.on('close', () => {
        if (unsubscribe) unsubscribe();
    });
}
