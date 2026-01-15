import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { Store } from "../store.js";
import type { StoreConfig } from "../types.js";

/**
 * Cached remote session data for offline viewing.
 * Enables caching of session messages fetched from remote servers.
 */
export interface CachedSession {
	/** Compound key: connectionId + "|" + sessionPath */
	id: string;

	/** Connection profile ID this session belongs to */
	connectionId: string;

	/** Server-side session path */
	sessionPath: string;

	/** Cached messages from the session */
	messages: AgentMessage[];

	/** Model used for this session */
	model: string | null;

	/** Thinking level used for this session */
	thinkingLevel: string;

	/** ISO timestamp when this cache was created/updated */
	cachedAt: string;
}

/**
 * Store for caching remote session messages locally.
 * Enables offline viewing of previously fetched sessions.
 */
export class SessionCacheStore extends Store {
	getConfig(): StoreConfig {
		return {
			name: "session-cache",
			keyPath: "id",
			indices: [{ name: "connectionId", keyPath: "connectionId" }],
		};
	}

	/**
	 * Generate compound key from connectionId and sessionPath.
	 */
	private generateKey(connectionId: string, sessionPath: string): string {
		return `${connectionId}|${sessionPath}`;
	}

	/**
	 * Save or update a cached session.
	 */
	async save(
		connectionId: string,
		sessionPath: string,
		session: Omit<CachedSession, "id" | "connectionId" | "sessionPath" | "cachedAt">,
	): Promise<void> {
		const id = this.generateKey(connectionId, sessionPath);
		const cachedSession: CachedSession = {
			...session,
			id,
			connectionId,
			sessionPath,
			cachedAt: new Date().toISOString(),
		};
		await this.getBackend().set("session-cache", id, cachedSession);
	}

	/**
	 * Get a cached session by connectionId and sessionPath.
	 */
	async get(connectionId: string, sessionPath: string): Promise<CachedSession | null> {
		const id = this.generateKey(connectionId, sessionPath);
		return this.getBackend().get<CachedSession>("session-cache", id);
	}

	/**
	 * Get all cached sessions for a specific connection.
	 */
	async getByConnection(connectionId: string): Promise<CachedSession[]> {
		const allSessions = await this.getBackend().getAllFromIndex<CachedSession>("session-cache", "connectionId");
		return allSessions.filter((session) => session.connectionId === connectionId);
	}

	/**
	 * Delete a cached session.
	 */
	async delete(connectionId: string, sessionPath: string): Promise<void> {
		const id = this.generateKey(connectionId, sessionPath);
		await this.getBackend().delete("session-cache", id);
	}

	/**
	 * Delete all cached sessions for a specific connection.
	 */
	async deleteByConnection(connectionId: string): Promise<void> {
		const sessions = await this.getByConnection(connectionId);
		for (const session of sessions) {
			await this.getBackend().delete("session-cache", session.id);
		}
	}

	/**
	 * Remove old cache entries older than maxAgeDays.
	 * Defaults to 30 days.
	 */
	async prune(maxAgeDays: number = 30): Promise<number> {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - maxAgeDays);
		const cutoffTime = cutoff.getTime();

		const keys = await this.getBackend().keys("session-cache");
		let deletedCount = 0;

		for (const key of keys) {
			const session = await this.getBackend().get<CachedSession>("session-cache", key);
			if (session) {
				const cachedTime = new Date(session.cachedAt).getTime();
				if (cachedTime < cutoffTime) {
					await this.getBackend().delete("session-cache", key);
					deletedCount++;
				}
			}
		}

		return deletedCount;
	}

	/**
	 * Get all cached sessions.
	 */
	async getAll(): Promise<CachedSession[]> {
		const keys = await this.getBackend().keys("session-cache");
		const sessions: CachedSession[] = [];
		for (const key of keys) {
			const session = await this.getBackend().get<CachedSession>("session-cache", key);
			if (session) {
				sessions.push(session);
			}
		}
		return sessions;
	}

	/**
	 * Clear all cached sessions.
	 */
	async clear(): Promise<void> {
		await this.getBackend().clear("session-cache");
	}
}
