/**
 * Connection profile types for managing WebSocket connections to remote sessions
 */

// Connection profile - saved server connection info
export interface ConnectionProfile {
	id: string; // UUID
	name: string; // Display name (e.g., "Work Laptop")
	url: string; // WebSocket URL (wss://...)
	token: string; // Auth token
	lastUsed: string; // ISO timestamp
	lastSessionPath?: string; // Last used session path
}

// Connection state machine
export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

// Connection options
export interface ConnectionOptions {
	url: string;
	token: string;
	sessionPath?: string;
	cwd?: string;
}

// Reconnection config
export interface ReconnectionConfig {
	maxRetries: number; // Default: 5
	initialDelayMs: number; // Default: 1000
	maxDelayMs: number; // Default: 30000
	backoffMultiplier: number; // Default: 2
}
