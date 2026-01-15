import { offlineQueue } from "../offline/offline-queue.js";
import { getAppStorage } from "../storage/app-storage.js";
import type { SessionData, SessionMetadata } from "../storage/types.js";

/**
 * Options for storage cleanup operations.
 */
export interface CleanupOptions {
	/** Delete sessions older than this many days (default: undefined = no age filter) */
	olderThanDays?: number;

	/** Keep at least this many most recent sessions (default: 0) */
	keepMinSessions?: number;

	/** Delete sessions exceeding this size in bytes (default: undefined = no size filter) */
	maxSessionSizeBytes?: number;

	/** Clear the session cache for remote sessions (default: false) */
	clearCache?: boolean;

	/** Clear the offline message queue (default: false) */
	clearOfflineQueue?: boolean;
}

/**
 * Result of a storage cleanup operation.
 */
export interface CleanupResult {
	/** Number of sessions deleted */
	sessionsDeleted: number;

	/** Total bytes freed from deleted sessions */
	bytesFreed: number;

	/** Whether the session cache was cleared */
	cacheCleared: boolean;

	/** Whether the offline queue was cleared */
	queueCleared: boolean;

	/** Number of cached sessions deleted (if clearCache was true) */
	cacheEntriesDeleted?: number;

	/** Number of queued messages deleted (if clearOfflineQueue was true) */
	queueMessagesDeleted?: number;
}

/**
 * Preview of what would be deleted by a cleanup operation.
 */
export interface CleanupPreview {
	/** Number of sessions that would be deleted */
	sessionsToDelete: number;

	/** Estimated total bytes that would be freed */
	estimatedBytesToFree: number;

	/** Number of cache entries that would be cleared (if clearCache is true) */
	cacheEntriesToClear?: number;

	/** Number of queue messages that would be cleared (if clearOfflineQueue is true) */
	queueMessagesToClear?: number;
}

/**
 * Estimate the size of a session in bytes.
 * Uses a rough approximation based on JSON serialization.
 */
async function estimateSessionSize(session: SessionData | SessionMetadata): Promise<number> {
	try {
		const json = JSON.stringify(session);
		return new Blob([json]).size;
	} catch {
		// Fallback: estimate based on properties
		const baseSize = 500; // Base overhead
		const titleSize = (session.title?.length || 0) * 2; // UTF-16 chars
		return baseSize + titleSize;
	}
}

/**
 * Get sessions that match the cleanup criteria.
 */
async function getSessionsToDelete(options: CleanupOptions): Promise<SessionMetadata[]> {
	const storage = getAppStorage();
	const allMetadata = await storage.sessions.getAllMetadata();

	if (allMetadata.length === 0) {
		return [];
	}

	// Sort by lastModified descending (most recent first)
	const sorted = [...allMetadata].sort((a, b) => b.lastModified.localeCompare(a.lastModified));

	// Keep minimum number of recent sessions
	const keepMin = options.keepMinSessions ?? 0;
	const candidates = keepMin > 0 ? sorted.slice(keepMin) : sorted;

	const cutoffTime =
		options.olderThanDays !== undefined
			? new Date(Date.now() - options.olderThanDays * 24 * 60 * 60 * 1000).toISOString()
			: undefined;

	const maxSize = options.maxSessionSizeBytes;

	const toDelete: SessionMetadata[] = [];

	for (const metadata of candidates) {
		let deleteSession = false;

		// Check age
		if (cutoffTime && metadata.lastModified < cutoffTime) {
			deleteSession = true;
		}

		// Check size (if session data exists)
		if (maxSize !== undefined) {
			try {
				const session = await storage.sessions.get(metadata.id);
				if (session) {
					const size = await estimateSessionSize(session);
					if (size > maxSize) {
						deleteSession = true;
					}
				}
			} catch {
				// If we can't get the session, skip size check
			}
		}

		if (deleteSession) {
			toDelete.push(metadata);
		}
	}

	return toDelete;
}

/**
 * Preview what would be deleted by a cleanup operation without actually deleting anything.
 *
 * @param options - Cleanup options to preview
 * @returns Preview of what would be deleted
 */
export async function getCleanupPreview(options: CleanupOptions): Promise<CleanupPreview> {
	const storage = getAppStorage();

	// Get sessions that would be deleted
	const sessionsToDelete = await getSessionsToDelete(options);

	let estimatedBytesToFree = 0;
	for (const metadata of sessionsToDelete) {
		try {
			const session = await storage.sessions.get(metadata.id);
			if (session) {
				const size = await estimateSessionSize(session);
				estimatedBytesToFree += size;
			}
		} catch {
			// Use metadata size estimate if session can't be loaded
			const metadataSize = await estimateSessionSize(metadata);
			estimatedBytesToFree += metadataSize * 2; // Rough estimate: full session is ~2x metadata
		}
	}

	const preview: CleanupPreview = {
		sessionsToDelete: sessionsToDelete.length,
		estimatedBytesToFree,
	};

	// Preview cache clearing
	if (options.clearCache) {
		try {
			// Count cache entries (session-cache store)
			const cacheKeys = await storage.backend.keys("session-cache");
			preview.cacheEntriesToClear = cacheKeys.length;
		} catch {
			// Cache preview failed
		}
	}

	// Preview queue clearing
	if (options.clearOfflineQueue) {
		try {
			await offlineQueue.init();
			const messages = await offlineQueue.getAll();
			preview.queueMessagesToClear = messages.length;
		} catch {
			// Queue preview failed
		}
	}

	return preview;
}

/**
 * Perform storage cleanup based on the provided options.
 *
 * @param options - Cleanup options
 * @returns Result of the cleanup operation
 */
export async function cleanupStorage(options: CleanupOptions): Promise<CleanupResult> {
	const storage = getAppStorage();
	const result: CleanupResult = {
		sessionsDeleted: 0,
		bytesFreed: 0,
		cacheCleared: false,
		queueCleared: false,
	};

	// Delete sessions matching criteria
	const sessionsToDelete = await getSessionsToDelete(options);

	for (const metadata of sessionsToDelete) {
		try {
			// Calculate size before deleting
			const session = await storage.sessions.get(metadata.id);
			let sessionSize = 0;
			if (session) {
				sessionSize = await estimateSessionSize(session);
			}

			// Delete the session
			await storage.sessions.delete(metadata.id);

			result.sessionsDeleted++;
			result.bytesFreed += sessionSize;
		} catch (error) {
			// Log but continue with other sessions
			console.error(`Failed to delete session ${metadata.id}:`, error);
		}
	}

	// Clear session cache if requested
	if (options.clearCache) {
		try {
			// Clear the session-cache store
			await storage.backend.clear("session-cache");
			result.cacheCleared = true;
			result.cacheEntriesDeleted = 0;
		} catch (error) {
			console.error("Failed to clear session cache:", error);
			result.cacheCleared = false;
		}
	}

	// Clear offline queue if requested
	if (options.clearOfflineQueue) {
		try {
			await offlineQueue.init();
			const messages = await offlineQueue.getAll();
			result.queueMessagesDeleted = messages.length;
			await offlineQueue.clear();
			result.queueCleared = true;
		} catch (error) {
			console.error("Failed to clear offline queue:", error);
			result.queueCleared = false;
		}
	}

	return result;
}

/**
 * Factory reset: Clear all stored data including sessions, settings, cache, and offline queue.
 * This is a destructive operation that cannot be undone.
 *
 * @returns Promise that resolves when all data is cleared
 */
export async function factoryReset(): Promise<void> {
	const storage = getAppStorage();

	// Clear all stores
	try {
		await storage.sessions.clear();
		await storage.backend.clear("settings");
		await storage.backend.clear("provider-keys");
		await storage.backend.clear("custom-providers");
		await storage.backend.clear("connections");
		await storage.backend.clear("session-cache");
	} catch (error) {
		console.error("Failed to clear some stores:", error);
		throw error;
	}

	// Clear offline queue (separate IndexedDB)
	try {
		await offlineQueue.init();
		await offlineQueue.clear();
	} catch (error) {
		console.error("Failed to clear offline queue:", error);
		throw error;
	}

	// Clear service worker cache if available
	try {
		if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
			const { clearServiceWorkerCache } = await import("./sw-register.js");
			await clearServiceWorkerCache();
		}
	} catch (error) {
		console.error("Failed to clear service worker cache:", error);
		// Don't throw - service worker cache clearing is non-critical
	}
}

/**
 * Get the total size of all stored data in bytes.
 * Provides a breakdown by store type.
 *
 * @returns Object containing size breakdown
 */
export async function getStorageSize(): Promise<{
	sessions: number;
	metadata: number;
	cache: number;
	settings: number;
	providerKeys: number;
	customProviders: number;
	connections: number;
	total: number;
}> {
	const storage = getAppStorage();
	const sizes = {
		sessions: 0,
		metadata: 0,
		cache: 0,
		settings: 0,
		providerKeys: 0,
		customProviders: 0,
		connections: 0,
		total: 0,
	};

	// Helper to calculate store size
	const calculateStoreSize = async (storeName: string): Promise<number> => {
		try {
			const keys = await storage.backend.keys(storeName);
			let size = 0;
			for (const key of keys) {
				const value = await storage.backend.get(storeName, key);
				if (value) {
					size += await estimateSessionSize(value as SessionData | SessionMetadata);
				}
			}
			return size;
		} catch {
			return 0;
		}
	};

	// Calculate sizes for each store
	sizes.sessions = await calculateStoreSize("sessions");
	sizes.metadata = await calculateStoreSize("sessions-metadata");
	sizes.cache = await calculateStoreSize("session-cache");
	sizes.settings = await calculateStoreSize("settings");
	sizes.providerKeys = await calculateStoreSize("provider-keys");
	sizes.customProviders = await calculateStoreSize("custom-providers");
	sizes.connections = await calculateStoreSize("connections");

	// Calculate total
	sizes.total =
		sizes.sessions +
		sizes.metadata +
		sizes.cache +
		sizes.settings +
		sizes.providerKeys +
		sizes.customProviders +
		sizes.connections;

	return sizes;
}

/**
 * Get storage statistics including quota information.
 *
 * @returns Storage statistics
 */
export async function getStorageStats(): Promise<{
	quota: {
		usage: number;
		quota: number;
		percent: number;
	};
	sizes: Awaited<ReturnType<typeof getStorageSize>>;
	sessionCount: number;
	cacheEntryCount: number;
	queueMessageCount: number;
}> {
	const storage = getAppStorage();

	const [quota, sizes, allMetadata] = await Promise.all([
		storage.getQuotaInfo(),
		getStorageSize(),
		storage.sessions.getAllMetadata(),
	]);

	let cacheEntryCount = 0;
	let queueMessageCount = 0;

	try {
		const cacheKeys = await storage.backend.keys("session-cache");
		cacheEntryCount = cacheKeys.length;
	} catch {
		// Ignore cache count errors
	}

	try {
		await offlineQueue.init();
		const messages = await offlineQueue.getAll();
		queueMessageCount = messages.length;
	} catch {
		// Ignore queue count errors
	}

	return {
		quota,
		sizes,
		sessionCount: allMetadata.length,
		cacheEntryCount,
		queueMessageCount,
	};
}
