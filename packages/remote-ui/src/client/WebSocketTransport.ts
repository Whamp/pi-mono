import type { AgentTransport, AgentRunConfig } from '@mariozechner/pi-web-ui';
import type { AgentEvent } from '@mariozechner/pi-agent-core';
import type { AssistantMessageEvent } from '@mariozechner/pi-ai';

export class WebSocketTransport implements AgentTransport {
    private ws: WebSocket | null = null;
    private listeners: ((event: AssistantMessageEvent) => void)[] = [];
    private pendingMessages: any[] = [];
    private onReady?: () => void;
    private connected = false;

    // Callbacks
    public onSessionStarted?: (data: any) => void;
    public onHistoryUpdate?: (history: any[]) => void;

    constructor(onReady?: () => void) {
        this.onReady = onReady;
        this.connect();
    }

    private connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        this.ws = new WebSocket(`${protocol}//${host}`);

        this.ws.onopen = () => {
            console.log('Connected to server');
            this.connected = true;
            this.flushPending();
            if (this.onReady) this.onReady();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (err) {
                console.error('Failed to parse message', err);
            }
        };

        this.ws.onclose = () => {
            console.log('Disconnected');
            this.connected = false;
            setTimeout(() => this.connect(), 2000);
        };
    }

    private flushPending() {
        while (this.pendingMessages.length > 0) {
            const msg = this.pendingMessages.shift();
            this.ws?.send(JSON.stringify(msg));
        }
    }

    private send(msg: any) {
        if (this.connected && this.ws) {
            this.ws.send(JSON.stringify(msg));
        } else {
            this.pendingMessages.push(msg);
        }
    }

    startSession(sessionPath?: string) {
        this.send({ type: 'start_session', sessionPath });
    }

    sendMessage(text: string, attachments?: any[]) {
        this.send({ type: 'prompt', text, attachments });
    }

    abort() {
        this.send({ type: 'abort' });
    }

    // AgentTransport interface implementation
    async *run(config: AgentRunConfig): AsyncGenerator<AssistantMessageEvent, void, unknown> {
        const messageQueue: AssistantMessageEvent[] = [];
        let resolveMessage: (() => void) | null = null;
        let finished = false;
        let error: Error | null = null;

        // Listener for this specific run
        const onEvent = (data: any) => {
             if (data.type === 'agent_event') {
                 const agentEvent = data.event as AgentEvent;

                 // Map events
                 if (agentEvent.type === 'text_delta') {
                     messageQueue.push({ type: 'text-delta', delta: agentEvent.delta });
                 } else if (agentEvent.type === 'tool_call') {
                     // We ignore tool calls in the stream to prevent Client Agent from executing them
                     // We rely on 'turn_complete' to sync full history with tool calls
                     // Optional: emit a text delta saying "[Tool Call: ...]"?
                 }
                 // We don't need to handle other events for basic streaming
             } else if (data.type === 'turn_complete') {
                 finished = true;
             } else if (data.type === 'error') {
                 error = new Error(data.message);
             }

             if (resolveMessage) resolveMessage();
        };

        // Attach listener
        const listenerId = this.addListener(onEvent);

        // Send the prompt to server
        const lastMsg = config.messages[config.messages.length - 1];
        if (lastMsg.role === 'user') {
            const content = lastMsg.content;
            let text = '';
            // Simplified content extraction
            if (typeof content === 'string') {
                 text = content;
            } else if (Array.isArray(content)) {
                 text = content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
            }
            this.sendMessage(text, []);
        }

        try {
            while (!finished || messageQueue.length > 0) {
                if (messageQueue.length === 0) {
                    if (finished) break;
                    if (error) throw error;
                    await new Promise<void>(resolve => { resolveMessage = resolve; });
                    resolveMessage = null;
                }

                while (messageQueue.length > 0) {
                    yield messageQueue.shift()!;
                }

                if (error) throw error;
            }
        } finally {
            this.removeListener(listenerId);
        }
    }

    private handleMessage(data: any) {
        // Dispatch to run() listeners
        this.listeners.forEach(l => l(data));

        if (data.type === 'session_started') {
            if (this.onSessionStarted) this.onSessionStarted(data);
        } else if (data.type === 'turn_complete') {
            if (this.onHistoryUpdate && data.history) {
                this.onHistoryUpdate(data.history);
            }
        }
    }

    private addListener(l: (e: any) => void) {
        this.listeners.push(l);
        return this.listeners.length - 1; // ID is index (unsafe if removal shifts, but ok for now)
    }

    private removeListener(id: number) {
        // Simple removal (replace with null to avoid shifting indices for other listeners)
        delete this.listeners[id];
    }
}
