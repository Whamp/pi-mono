export interface RpcCommand {
    type: string;
    id?: string;
    [key: string]: any;
}

export interface RpcResponse {
    type: string;
    id?: string;
    command?: string;
    success?: boolean;
    data?: any;
    error?: string;
    [key: string]: any;
}

export type EventHandler = (event: any) => void;

export class RpcClient {
    private ws: WebSocket | null = null;
    private listeners: EventHandler[] = [];
    private pendingCommands: Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }> = new Map();
    private reconnectTimer: any = null;
    private url: string;

    constructor(token: string) {
        // Construct WS URL from current location or default
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        this.url = `${protocol}//${host}/ws?token=${token}`;
    }

    connect() {
        if (this.ws) {
            this.ws.close();
        }

        console.log('Connecting to', this.url);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.notifyListeners({ type: 'connection_status', status: 'connected' });
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
                console.error('Failed to parse message', event.data);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket closed');
            this.notifyListeners({ type: 'connection_status', status: 'disconnected' });
            this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            console.error('WebSocket error', err);
        };
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 2000);
    }

    private handleMessage(data: any) {
        // Check if it's a response to a pending command
        if (data.type === 'response' && data.id && this.pendingCommands.has(data.id)) {
            const { resolve, reject } = this.pendingCommands.get(data.id)!;
            this.pendingCommands.delete(data.id);

            if (data.success) {
                resolve(data);
            } else {
                reject(new Error(data.error || 'Unknown error'));
            }
        }

        // Notify general listeners (for events like text_delta, tool_call, etc.)
        this.notifyListeners(data);
    }

    private notifyListeners(event: any) {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    subscribe(listener: EventHandler) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    async send(type: string, payload: any = {}): Promise<any> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }

        const id = crypto.randomUUID();
        const command: RpcCommand = { type, id, ...payload };

        return new Promise((resolve, reject) => {
            this.pendingCommands.set(id, { resolve, reject });
            this.ws!.send(JSON.stringify(command));

            // Timeout
            setTimeout(() => {
                if (this.pendingCommands.has(id)) {
                    this.pendingCommands.delete(id);
                    reject(new Error('Timeout'));
                }
            }, 30000);
        });
    }
}
