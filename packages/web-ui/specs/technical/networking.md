# Networking

WebSocket connections, RPC protocol, and CORS proxy handling.

## Overview

Networking in Pi Web UI involves:
- WebSocket connections to Pi RPC servers (remote mode)
- Direct HTTPS calls to LLM provider APIs (browser mode)
- CORS proxy for providers that don't support browser requests
- Reconnection and error handling

## Connection Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    NetworkManager                           │ │
│  │  ┌────────────────┐    ┌────────────────────────────────┐  │ │
│  │  │  HTTPClient    │    │    WebSocketManager            │  │ │
│  │  │  (LLM APIs)    │    │    (Remote sessions)           │  │ │
│  │  └────────────────┘    └────────────────────────────────┘  │ │
│  │           │                          │                      │ │
│  │           │                          │                      │ │
│  │  ┌────────────────┐    ┌────────────────────────────────┐  │ │
│  │  │  CORSProxy     │    │    ReconnectionManager         │  │ │
│  │  │  (optional)    │    │                                │  │ │
│  │  └────────────────┘    └────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
             │                          │
             ▼                          ▼
    ┌────────────────┐        ┌────────────────┐
    │ LLM Provider   │        │ Pi RPC Server  │
    │ APIs           │        │ (WebSocket)    │
    └────────────────┘        └────────────────┘
```

## WebSocket Connection

### Connection URL Format

```
wss://<host>:<port>/session?token=<auth_token>&session=<session_path>
```

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | Authentication token |
| `session` | No | Session file path (creates new if omitted) |
| `cwd` | No | Working directory for new sessions |

### Connection Lifecycle

```
┌─────────────┐     connect()      ┌──────────────┐
│ Disconnected│ ─────────────────▶ │ Connecting   │
└─────────────┘                    └──────────────┘
       ▲                                  │
       │                                  │ onopen
       │                                  ▼
       │                           ┌──────────────┐
       │ onerror/onclose           │  Connected   │◀───┐
       └───────────────────────────└──────────────┘    │
       │                                  │            │
       │                                  │ onerror/   │ onopen
       │                                  │ onclose    │
       │                                  ▼            │
       │                           ┌──────────────┐    │
       └───────────────────────────│ Reconnecting │────┘
           max retries exceeded    └──────────────┘
```

### WebSocket Manager

```typescript
interface WebSocketManagerConfig {
  url: string;
  token: string;
  sessionPath?: string;
  cwd?: string;
  reconnect: ReconnectionConfig;
  heartbeat: HeartbeatConfig;
}

interface ReconnectionConfig {
  enabled: boolean;
  maxRetries: number;        // Default: 5
  initialDelayMs: number;    // Default: 1000
  maxDelayMs: number;        // Default: 30000
  backoffMultiplier: number; // Default: 2
}

interface HeartbeatConfig {
  enabled: boolean;
  intervalMs: number;        // Default: 30000
  timeoutMs: number;         // Default: 10000
}

class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private heartbeatTimer: number | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  
  constructor(private config: WebSocketManagerConfig) {
    super();
  }
  
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }
    
    this.setState('connecting');
    
    const url = this.buildConnectionUrl();
    this.ws = new WebSocket(url);
    
    return new Promise((resolve, reject) => {
      this.ws!.onopen = () => {
        this.setState('connected');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        resolve();
      };
      
      this.ws!.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };
      
      this.ws!.onclose = (event) => {
        this.handleClose(event);
      };
      
      this.ws!.onmessage = (event) => {
        this.handleMessage(event);
      };
    });
  }
  
  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    this.config.reconnect.enabled = false;  // Disable auto-reconnect
    this.ws?.close(1000, 'User disconnected');
    this.ws = null;
    this.setState('disconnected');
  }
  
  async send<T>(command: RPCCommand): Promise<T> {
    if (!this.ws || this.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    const id = generateId();
    const message = JSON.stringify({ id, ...command });
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, 30000);
      
      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.ws!.send(message);
    });
  }
  
  private handleMessage(event: MessageEvent): void {
    const data = JSON.parse(event.data);
    
    // Check if response to pending request
    if (data.id && this.pendingRequests.has(data.id)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(data.id)!;
      clearTimeout(timeout);
      this.pendingRequests.delete(data.id);
      
      if (data.success === false) {
        reject(new Error(data.error ?? 'Request failed'));
      } else {
        resolve(data);
      }
      return;
    }
    
    // Emit as event
    this.emit('event', data);
  }
  
  private handleClose(event: CloseEvent): void {
    this.stopHeartbeat();
    
    if (!this.config.reconnect.enabled) {
      this.setState('disconnected');
      return;
    }
    
    if (event.code === 1000) {
      // Normal close, don't reconnect
      this.setState('disconnected');
      return;
    }
    
    this.scheduleReconnect();
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnect.maxRetries) {
      this.setState('disconnected');
      this.emit('reconnect_failed');
      return;
    }
    
    this.setState('reconnecting');
    
    const delay = Math.min(
      this.config.reconnect.initialDelayMs * 
        Math.pow(this.config.reconnect.backoffMultiplier, this.reconnectAttempts),
      this.config.reconnect.maxDelayMs
    );
    
    this.emit('reconnect_attempt', { 
      attempt: this.reconnectAttempts + 1, 
      maxAttempts: this.config.reconnect.maxRetries,
      delay 
    });
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Will trigger handleClose again
      });
    }, delay);
  }
  
  private startHeartbeat(): void {
    if (!this.config.heartbeat.enabled) return;
    
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeat.intervalMs);
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  private async sendHeartbeat(): Promise<void> {
    try {
      await Promise.race([
        this.send({ type: 'ping' }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Heartbeat timeout')), 
            this.config.heartbeat.timeoutMs)
        ),
      ]);
    } catch {
      // Connection appears dead, trigger reconnect
      this.ws?.close(4000, 'Heartbeat failed');
    }
  }
  
  private buildConnectionUrl(): string {
    const url = new URL(this.config.url);
    url.searchParams.set('token', this.config.token);
    if (this.config.sessionPath) {
      url.searchParams.set('session', this.config.sessionPath);
    }
    if (this.config.cwd) {
      url.searchParams.set('cwd', this.config.cwd);
    }
    return url.toString();
  }
  
  private setState(state: ConnectionState): void {
    const prev = this.state;
    this.state = state;
    this.emit('state_change', { prev, current: state });
  }
}
```

## RPC Protocol

### Command Format

```typescript
interface RPCCommand {
  id?: string;              // Auto-generated if not provided
  type: RPCCommandType;
  [key: string]: unknown;   // Command-specific parameters
}

type RPCCommandType = 
  | 'prompt'
  | 'steer'
  | 'follow_up'
  | 'abort'
  | 'get_state'
  | 'get_messages'
  | 'get_session_stats'
  | 'set_model'
  | 'set_thinking_level'
  | 'cycle_model'
  | 'cycle_thinking_level'
  | 'new_session'
  | 'switch_session'
  | 'fork'
  | 'get_fork_messages'
  | 'compact'
  | 'set_auto_compaction'
  | 'bash'
  | 'abort_bash'
  | 'export_html'
  | 'ping';
```

### Response Format

```typescript
interface RPCResponse {
  id: string;               // Matches request ID
  type: 'response';
  command: RPCCommandType;
  success: boolean;
  data?: unknown;
  error?: string;
}
```

### Event Format

```typescript
interface RPCEvent {
  type: RPCEventType;
  [key: string]: unknown;   // Event-specific data
}

type RPCEventType =
  | 'agent_start'
  | 'agent_end'
  | 'message_start'
  | 'message_update'
  | 'message_end'
  | 'turn_start'
  | 'turn_end'
  | 'tool_execution_start'
  | 'tool_execution_update'
  | 'tool_execution_end'
  | 'auto_compaction_start'
  | 'auto_compaction_end'
  | 'auto_retry_start'
  | 'auto_retry_end'
  | 'hook_error'
  | 'error';
```

### Command Examples

**Prompt:**
```json
{
  "id": "req_123",
  "type": "prompt",
  "message": "Refactor the auth module",
  "content": [
    { "type": "text", "text": "Refactor the auth module" }
  ]
}
```

**Set Model:**
```json
{
  "id": "req_124",
  "type": "set_model",
  "provider": "anthropic",
  "modelId": "claude-sonnet-4-20250514"
}
```

**Fork:**
```json
{
  "id": "req_125",
  "type": "fork",
  "entryId": "msg_abc123"
}
```

## CORS Proxy

### When Needed

| Provider | Direct Access | Needs Proxy |
|----------|--------------|-------------|
| Anthropic | API keys (sk-ant-api-*) | OAuth tokens (sk-ant-oat-*) |
| OpenAI | Yes | No |
| Google | Yes | No |
| ZAI | No | Always |
| Custom | Depends | Usually no |

### Proxy Configuration

```typescript
interface ProxyConfig {
  enabled: boolean;
  url: string;              // e.g., 'https://corsproxy.io/?'
  forProviders: string[];   // Providers that require proxy
}

const defaultProxyConfig: ProxyConfig = {
  enabled: true,
  url: 'https://corsproxy.io/?',
  forProviders: ['zai'],
};
```

### Proxy Usage

```typescript
function buildRequestUrl(provider: string, endpoint: string): string {
  const proxyConfig = storage.settings.get('proxy');
  
  if (proxyConfig.enabled && shouldUseProxy(provider)) {
    return `${proxyConfig.url}${encodeURIComponent(endpoint)}`;
  }
  
  return endpoint;
}

function shouldUseProxy(provider: string): boolean {
  const config = storage.settings.get('proxy');
  
  // Always proxy ZAI
  if (provider === 'zai') return true;
  
  // Check Anthropic OAuth tokens
  if (provider === 'anthropic') {
    const key = storage.providerKeys.get('anthropic');
    if (key?.startsWith('sk-ant-oat-')) return true;
  }
  
  return config.forProviders.includes(provider);
}
```

## HTTP Client

### LLM API Requests

```typescript
interface LLMRequestConfig {
  provider: string;
  endpoint: string;
  method: 'POST' | 'GET';
  headers: Record<string, string>;
  body?: unknown;
  stream: boolean;
  signal?: AbortSignal;
}

async function makeLLMRequest(config: LLMRequestConfig): Promise<Response> {
  const url = buildRequestUrl(config.provider, config.endpoint);
  
  const response = await fetch(url, {
    method: config.method,
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: config.body ? JSON.stringify(config.body) : undefined,
    signal: config.signal,
  });
  
  if (!response.ok) {
    const error = await parseErrorResponse(response);
    throw new LLMError(error);
  }
  
  return response;
}
```

### Streaming Response Handling

```typescript
async function* streamResponse(
  response: Response
): AsyncGenerator<string, void, unknown> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Split by newlines and process complete events
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';  // Keep incomplete line
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

## Error Handling

### Error Types

```typescript
type NetworkErrorType =
  | 'connection_refused'
  | 'connection_timeout'
  | 'connection_lost'
  | 'auth_failed'
  | 'rate_limited'
  | 'server_error'
  | 'parse_error'
  | 'unknown';

interface NetworkError extends Error {
  type: NetworkErrorType;
  statusCode?: number;
  retryable: boolean;
  retryAfter?: number;  // Seconds
}

function classifyError(error: unknown): NetworkError {
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return {
      name: 'NetworkError',
      message: 'Connection refused',
      type: 'connection_refused',
      retryable: true,
    };
  }
  
  if (error instanceof Response) {
    return classifyHttpError(error);
  }
  
  // WebSocket errors
  if (error instanceof Event && error.type === 'error') {
    return {
      name: 'NetworkError',
      message: 'WebSocket error',
      type: 'connection_lost',
      retryable: true,
    };
  }
  
  return {
    name: 'NetworkError',
    message: String(error),
    type: 'unknown',
    retryable: false,
  };
}

function classifyHttpError(response: Response): NetworkError {
  switch (response.status) {
    case 401:
    case 403:
      return {
        name: 'NetworkError',
        message: 'Authentication failed',
        type: 'auth_failed',
        statusCode: response.status,
        retryable: false,
      };
    case 429:
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60');
      return {
        name: 'NetworkError',
        message: 'Rate limited',
        type: 'rate_limited',
        statusCode: 429,
        retryable: true,
        retryAfter,
      };
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        name: 'NetworkError',
        message: 'Server error',
        type: 'server_error',
        statusCode: response.status,
        retryable: true,
      };
    default:
      return {
        name: 'NetworkError',
        message: `HTTP ${response.status}`,
        type: 'unknown',
        statusCode: response.status,
        retryable: false,
      };
  }
}
```

### Retry Logic

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const networkError = classifyError(error);
      
      if (!networkError.retryable) {
        throw error;
      }
      
      const delay = networkError.retryAfter
        ? networkError.retryAfter * 1000
        : Math.min(
            config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
            config.maxDelayMs
          );
      
      await sleep(delay);
    }
  }
  
  throw lastError!;
}
```

## Network Status

### Online/Offline Detection

```typescript
function useNetworkStatus() {
  const [status, setStatus] = useState<{
    online: boolean;
    connectionType?: string;
    downlink?: number;
  }>({
    online: navigator.onLine,
  });
  
  useEffect(() => {
    function updateStatus() {
      const connection = (navigator as any).connection;
      setStatus({
        online: navigator.onLine,
        connectionType: connection?.effectiveType,
        downlink: connection?.downlink,
      });
    }
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    (navigator as any).connection?.addEventListener('change', updateStatus);
    
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      (navigator as any).connection?.removeEventListener('change', updateStatus);
    };
  }, []);
  
  return status;
}
```

### Connection Quality Indicator

```typescript
type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

function getConnectionQuality(status: NetworkStatus): ConnectionQuality {
  if (!status.online) return 'offline';
  
  const { connectionType, downlink } = status;
  
  if (connectionType === '4g' && downlink && downlink > 5) return 'excellent';
  if (connectionType === '4g' || (downlink && downlink > 2)) return 'good';
  if (connectionType === '3g' || (downlink && downlink > 0.5)) return 'fair';
  return 'poor';
}
```

## Request Cancellation

### AbortController Usage

```typescript
class RequestManager {
  private abortControllers = new Map<string, AbortController>();
  
  createSignal(requestId: string): AbortSignal {
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);
    return controller.signal;
  }
  
  abort(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }
  
  abortAll(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }
  
  cleanup(requestId: string): void {
    this.abortControllers.delete(requestId);
  }
}
```

### Abort Handling

```typescript
async function streamWithAbort(
  config: LLMRequestConfig
): AsyncGenerator<string, void, unknown> {
  const requestId = generateId();
  const signal = requestManager.createSignal(requestId);
  
  try {
    const response = await makeLLMRequest({ ...config, signal });
    yield* streamResponse(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      // Request was cancelled, clean exit
      return;
    }
    throw error;
  } finally {
    requestManager.cleanup(requestId);
  }
}
```
