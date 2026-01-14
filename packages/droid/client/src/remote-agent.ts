import { Agent, type AgentMessage, type AgentEvent } from "@mariozechner/pi-agent-core";

export class RemoteAgent extends Agent {
    private ws: WebSocket;
    private connected = false;
    private messageQueue: any[] = [];

    constructor(wsUrl: string) {
        super({
            initialState: {
                messages: [],
                tools: [],
                model: undefined,
                thinkingLevel: 'off',
                systemPrompt: ''
            },
            convertToLlm: (msgs) => [] // Dummy, backend handles this
        });

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Connected to backend agent');
            this.connected = true;
            this.flushQueue();
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'agent-event') {
                    this.handleBackendEvent(msg.event);
                }
            } catch (err) {
                console.error('Failed to parse backend message', err);
            }
        };

        this.ws.onclose = () => {
            console.log('Disconnected from backend agent');
            this.connected = false;
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket error:', err);
        };
    }

    private flushQueue() {
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            this.ws.send(JSON.stringify(msg));
        }
    }

    private handleBackendEvent(event: any) {
        if (event.type === 'state-update' || event.type === 'state_update') {
            // Update internal state
            (this as any)._state = event.state;

            // pi-web-ui ChatPanel listens for 'state-update' (or similar)
            // We emit it as is.
            this.emit(event);
        } else {
            this.emit(event);
        }
    }

    override async prompt(message: string | any, options?: any): Promise<void> {
        const payload = { type: 'prompt', message };
        if (this.connected) {
            this.ws.send(JSON.stringify(payload));
        } else {
            this.messageQueue.push(payload);
        }
    }

    override abort(): void {
        const payload = { type: 'abort' };
        if (this.connected) {
            this.ws.send(JSON.stringify(payload));
        }
    }

    override steer(message: any): void {
        const payload = { type: 'steer', message };
        if (this.connected) {
            this.ws.send(JSON.stringify(payload));
        } else {
            this.messageQueue.push(payload);
        }
    }
}
