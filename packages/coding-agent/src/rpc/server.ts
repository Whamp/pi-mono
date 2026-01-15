/**
 * WebSocket RPC server for remote Pi sessions.
 *
 * Exposes AgentSession over WebSocket, allowing web clients to:
 * - Send prompts and receive streaming responses
 * - Control session state (model, thinking level, etc.)
 * - Execute commands (bash, compaction, etc.)
 *
 * Authentication uses a simple token scheme - the token is validated
 * on connection and must match the server's configured token.
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { type WebSocket, WebSocketServer } from "ws";
import type { AgentSession, AgentSessionEvent } from "../core/agent-session.js";
import type { CreateAgentSessionOptions, CreateAgentSessionResult } from "../core/sdk.js";
import { createAgentSession } from "../core/sdk.js";

// ============================================================================
// Types
// ============================================================================

/** Server configuration */
export interface RPCServerConfig {
	/** Port to listen on. Default: 8765 */
	port?: number;
	/** Host to bind to. Default: 127.0.0.1 (localhost only) */
	host?: string;
	/** Authentication token. If not set, generates random token */
	token?: string;
	/** Options passed to createAgentSession */
	sessionOptions?: CreateAgentSessionOptions;
	/** Called when server starts */
	onStart?: (info: { port: number; host: string; token: string }) => void;
	/** Called on errors */
	onError?: (error: Error) => void;
	/** Called when client connects */
	onConnect?: (clientId: string) => void;
	/** Called when client disconnects */
	onDisconnect?: (clientId: string) => void;
}

/** Client connection state */
interface ClientState {
	id: string;
	ws: WebSocket;
	session: AgentSession;
	sessionResult: CreateAgentSessionResult;
	unsubscribe: () => void;
}

/** RPC command from client */
interface RPCCommand {
	id?: string;
	type: string;
	[key: string]: unknown;
}

/** RPC response to client */
interface RPCResponse {
	id?: string;
	type: "response";
	command: string;
	success: boolean;
	data?: unknown;
	error?: string;
}

// ============================================================================
// RPC Server
// ============================================================================

export class RPCServer {
	private wss: WebSocketServer | null = null;
	private clients: Map<string, ClientState> = new Map();
	private config: Required<
		Omit<RPCServerConfig, "sessionOptions" | "onStart" | "onError" | "onConnect" | "onDisconnect">
	> &
		Pick<RPCServerConfig, "sessionOptions" | "onStart" | "onError" | "onConnect" | "onDisconnect">;

	constructor(config: RPCServerConfig = {}) {
		this.config = {
			port: config.port ?? 8765,
			host: config.host ?? "127.0.0.1",
			token: config.token ?? randomUUID(),
			sessionOptions: config.sessionOptions,
			onStart: config.onStart,
			onError: config.onError,
			onConnect: config.onConnect,
			onDisconnect: config.onDisconnect,
		};
	}

	get port(): number {
		return this.config.port;
	}

	get host(): string {
		return this.config.host;
	}

	get token(): string {
		return this.config.token;
	}

	get url(): string {
		return `ws://${this.config.host}:${this.config.port}`;
	}

	/** Start the WebSocket server */
	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.wss = new WebSocketServer({
				port: this.config.port,
				host: this.config.host,
			});

			this.wss.on("listening", () => {
				this.config.onStart?.({
					port: this.config.port,
					host: this.config.host,
					token: this.config.token,
				});
				resolve();
			});

			this.wss.on("error", (error) => {
				this.config.onError?.(error);
				reject(error);
			});

			this.wss.on("connection", (ws, req) => {
				this.handleConnection(ws, req);
			});
		});
	}

	/** Stop the WebSocket server */
	async stop(): Promise<void> {
		// Close all client connections
		for (const client of this.clients.values()) {
			client.unsubscribe();
			client.ws.close(1000, "Server shutting down");
		}
		this.clients.clear();

		// Close the server
		return new Promise((resolve) => {
			if (this.wss) {
				this.wss.close(() => {
					this.wss = null;
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	/** Handle new WebSocket connection */
	private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
		// Validate auth token from query string
		const url = new URL(req.url || "", `http://${req.headers.host}`);
		const token = url.searchParams.get("token");

		if (token !== this.config.token) {
			ws.close(4001, "Invalid token");
			return;
		}

		const clientId = randomUUID();

		try {
			// Create a new agent session for this client
			const sessionResult = await createAgentSession(this.config.sessionOptions);
			const session = sessionResult.session;

			// Subscribe to session events
			const unsubscribe = session.subscribe((event) => {
				this.sendEvent(ws, event);
			});

			// Store client state
			const clientState: ClientState = {
				id: clientId,
				ws,
				session,
				sessionResult,
				unsubscribe,
			};
			this.clients.set(clientId, clientState);
			this.config.onConnect?.(clientId);

			// Handle messages
			ws.on("message", async (data) => {
				try {
					const message = JSON.parse(data.toString());
					await this.handleCommand(clientState, message);
				} catch (error) {
					this.sendError(ws, undefined, "parse_error", String(error));
				}
			});

			// Handle close
			ws.on("close", () => {
				unsubscribe();
				this.clients.delete(clientId);
				this.config.onDisconnect?.(clientId);
			});

			// Handle errors
			ws.on("error", (error) => {
				console.error(`[RPC] Client ${clientId} error:`, error);
			});
		} catch (error) {
			ws.close(4002, `Session creation failed: ${error}`);
		}
	}

	/** Handle RPC command from client */
	private async handleCommand(client: ClientState, command: RPCCommand): Promise<void> {
		const { ws, session } = client;
		const { id, type } = command;

		try {
			switch (type) {
				// ================================================================
				// Prompting
				// ================================================================
				case "prompt": {
					const message = command.message as string;
					const images = command.images as unknown[] | undefined;
					// Start prompt (async - events will stream back)
					session.prompt(message, { images: images as never });
					this.sendSuccess(ws, id, type);
					break;
				}

				case "abort": {
					session.abort();
					this.sendSuccess(ws, id, type);
					break;
				}

				// ================================================================
				// State
				// ================================================================
				case "get_state": {
					const state = {
						model: session.model,
						thinkingLevel: session.thinkingLevel,
						isStreaming: session.isStreaming,
						isCompacting: session.isCompacting,
						steeringMode: "all",
						followUpMode: "all",
						sessionFile: undefined, // TODO: expose from session
						sessionId: randomUUID(), // TODO: expose from session
						autoCompactionEnabled: true, // Auto-compaction is always on
						messageCount: session.messages.length,
						pendingMessageCount: 0,
					};
					this.sendSuccess(ws, id, type, state);
					break;
				}

				case "get_messages": {
					this.sendSuccess(ws, id, type, { messages: session.messages });
					break;
				}

				// ================================================================
				// Model
				// ================================================================
				case "set_model": {
					const provider = command.provider as string;
					const modelId = command.modelId as string;
					const models = await session.modelRegistry.getAvailable();
					const model = models.find((m) => m.provider === provider && m.id === modelId);
					if (!model) {
						this.sendError(ws, id, type, `Model not found: ${provider}/${modelId}`);
						return;
					}
					session.setModel(model);
					this.sendSuccess(ws, id, type, model);
					break;
				}

				case "get_available_models": {
					const models = await session.modelRegistry.getAvailable();
					this.sendSuccess(ws, id, type, { models });
					break;
				}

				// ================================================================
				// Thinking
				// ================================================================
				case "set_thinking_level": {
					const level = command.level as "off" | "low" | "medium" | "high";
					session.setThinkingLevel(level);
					this.sendSuccess(ws, id, type);
					break;
				}

				// ================================================================
				// Session
				// ================================================================
				case "new_session": {
					await session.newSession();
					this.sendSuccess(ws, id, type, { cancelled: false });
					break;
				}

				// ================================================================
				// Compaction
				// ================================================================
				case "set_auto_compaction": {
					// Auto-compaction is always enabled in the session
					// This is a no-op but we acknowledge the command
					this.sendSuccess(ws, id, type);
					break;
				}

				// ================================================================
				// Unknown command
				// ================================================================
				default: {
					this.sendError(ws, id, type, `Unknown command: ${type}`);
				}
			}
		} catch (error) {
			this.sendError(ws, id, type, String(error));
		}
	}

	/** Send success response */
	private sendSuccess(ws: WebSocket, id: string | undefined, command: string, data?: unknown): void {
		const response: RPCResponse = {
			id,
			type: "response",
			command,
			success: true,
			...(data !== undefined && { data }),
		};
		ws.send(JSON.stringify(response));
	}

	/** Send error response */
	private sendError(ws: WebSocket, id: string | undefined, command: string, error: string): void {
		const response: RPCResponse = {
			id,
			type: "response",
			command,
			success: false,
			error,
		};
		ws.send(JSON.stringify(response));
	}

	/** Send event to client */
	private sendEvent(ws: WebSocket, event: AgentSessionEvent): void {
		// Map AgentSessionEvent to RPC event format
		const rpcEvent = this.mapEvent(event);
		if (rpcEvent) {
			ws.send(JSON.stringify(rpcEvent));
		}
	}

	/** Map AgentSessionEvent to RPC event */
	private mapEvent(event: AgentSessionEvent): unknown {
		switch (event.type) {
			case "agent_start":
				return { type: "agent_start" };
			case "agent_end":
				return { type: "agent_end", messages: event.messages };
			case "turn_start":
				return { type: "turn_start" };
			case "turn_end":
				return { type: "turn_end", message: event.message, toolResults: event.toolResults };
			case "message_start":
				return { type: "message_start", message: event.message };
			case "message_update":
				return {
					type: "message_update",
					message: event.message,
					assistantMessageEvent: event.assistantMessageEvent,
				};
			case "message_end":
				return { type: "message_end", message: event.message };
			case "tool_execution_start":
				return {
					type: "tool_execution_start",
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					args: event.args,
				};
			case "tool_execution_update":
				return {
					type: "tool_execution_update",
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					args: event.args,
					partialResult: event.partialResult,
				};
			case "tool_execution_end":
				return {
					type: "tool_execution_end",
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					result: event.result,
					isError: event.isError,
				};
			default:
				return null;
		}
	}
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Start an RPC server with default settings.
 * Returns the server instance for later shutdown.
 */
export async function startRPCServer(config?: RPCServerConfig): Promise<RPCServer> {
	const server = new RPCServer(config);
	await server.start();
	return server;
}
