/**
 * Auto-connect to a local Pi RPC server if available.
 *
 * Checks for a .pi-server.json file served by the dev server,
 * which contains the WebSocket URL and auth token.
 */

import { RPCClient, RPCEventMapper, WebSocketClient } from "../index.js";
import type { ConnectionState } from "../networking/connection-types.js";

export interface ServerConnection {
	url: string;
	token: string;
	pid: number;
	startedAt: string;
}

export interface AutoConnectResult {
	wsClient: WebSocketClient;
	rpcClient: RPCClient;
	eventMapper: RPCEventMapper;
	serverInfo: ServerConnection;
}

/**
 * Check if a local Pi server is running by fetching the connection file.
 */
export async function checkLocalServer(): Promise<ServerConnection | null> {
	try {
		const response = await fetch("/.pi-server.json");
		if (!response.ok) {
			return null;
		}
		const data = await response.json();
		if (data.error) {
			return null;
		}
		return data as ServerConnection;
	} catch {
		return null;
	}
}

/**
 * Connect to a local Pi RPC server.
 * Returns the connected clients, or null if connection fails.
 */
export async function connectToLocalServer(
	serverInfo: ServerConnection,
	onStateChange?: (state: ConnectionState) => void,
): Promise<AutoConnectResult | null> {
	const wsUrl = `${serverInfo.url}?token=${serverInfo.token}`;
	const wsClient = new WebSocketClient(wsUrl);

	// Track connection state
	wsClient.subscribe((event) => {
		switch (event.type) {
			case "open":
				onStateChange?.("connected");
				break;
			case "close":
				onStateChange?.("disconnected");
				break;
			case "reconnecting":
				onStateChange?.("reconnecting");
				break;
		}
	});

	// Attempt connection
	onStateChange?.("connecting");

	return new Promise((resolve) => {
		const unsubscribe = wsClient.subscribe((event) => {
			if (event.type === "open") {
				unsubscribe();
				const rpcClient = new RPCClient(wsClient);
				const eventMapper = new RPCEventMapper();

				// Wire RPC events to mapper
				rpcClient.subscribe((rpcEvent) => {
					eventMapper.handleEvent(rpcEvent);
				});

				resolve({
					wsClient,
					rpcClient,
					eventMapper,
					serverInfo,
				});
			} else if (event.type === "failed" || event.type === "error") {
				unsubscribe();
				onStateChange?.("disconnected");
				resolve(null);
			}
		});

		wsClient.connect();

		// Timeout after 5 seconds
		setTimeout(() => {
			unsubscribe();
			if (wsClient.state !== "connected") {
				wsClient.disconnect();
				onStateChange?.("disconnected");
				resolve(null);
			}
		}, 5000);
	});
}

/**
 * Auto-connect to local server if available.
 * This is a convenience function for the common case.
 */
export async function autoConnect(onStateChange?: (state: ConnectionState) => void): Promise<AutoConnectResult | null> {
	const serverInfo = await checkLocalServer();
	if (!serverInfo) {
		return null;
	}
	return connectToLocalServer(serverInfo, onStateChange);
}
