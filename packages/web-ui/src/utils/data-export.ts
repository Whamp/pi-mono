import type { ConnectionProfile } from "../networking/connection-types.js";
import { getAppStorage } from "../storage/app-storage.js";
import type { SessionData } from "../storage/types.js";

/**
 * Version for the export format (used for future migration compatibility)
 */
export const DATA_EXPORT_VERSION = 1;

/**
 * Complete data export structure
 */
export interface ExportData {
	/** Format version for migration compatibility */
	version: number;
	/** ISO 8601 timestamp when export was created */
	exportedAt: string;
	/** All chat sessions with full data */
	sessions: SessionData[];
	/** Application settings (key-value pairs) */
	settings: Record<string, unknown>;
	/** Saved connection profiles */
	connections: ConnectionProfile[];
	/** Provider API keys */
	providerKeys: ProviderKeyData[];
}

/**
 * Provider key data for export
 */
export interface ProviderKeyData {
	/** Provider identifier (e.g., "anthropic", "openai") */
	provider: string;
	/** API key value */
	key: string;
}

/**
 * Import result statistics
 */
export interface ImportResult {
	/** Number of items imported */
	imported: number;
	/** Number of items skipped (duplicates in merge mode) */
	skipped: number;
}

/**
 * Export all application data to a structured format
 */
export async function exportAllData(): Promise<ExportData> {
	const storage = getAppStorage();

	// Gather all sessions
	const sessions = await storage.sessions.getAll();

	// Gather all settings
	const settingKeys = await storage.settings.list();
	const settings: Record<string, unknown> = {};
	for (const key of settingKeys) {
		const value = await storage.settings.get<unknown>(key);
		if (value !== null) {
			settings[key] = value;
		}
	}

	// Gather all connections
	const connections = await storage.connections.getAll();

	// Gather all provider keys
	const providerKeyNames = await storage.providerKeys.list();
	const providerKeys: ProviderKeyData[] = [];
	for (const provider of providerKeyNames) {
		const key = await storage.providerKeys.get(provider);
		if (key !== null) {
			providerKeys.push({ provider, key });
		}
	}

	return {
		version: DATA_EXPORT_VERSION,
		exportedAt: new Date().toISOString(),
		sessions,
		settings,
		connections,
		providerKeys,
	};
}

/**
 * Trigger a browser download of the exported data
 * @param data The export data to download
 * @param filename Optional filename (defaults to timestamp-based name)
 */
export function downloadExport(data: ExportData, filename?: string): void {
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const defaultFilename = `pi-export-${new Date().toISOString().slice(0, 10)}.json`;
	const sanitizedFilename = (filename || defaultFilename).replace(/[^a-z0-9._-]/gi, "_");

	const a = document.createElement("a");
	a.href = url;
	a.download = sanitizedFilename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Import data from an export file
 * @param data The export data to import
 * @param mode Import mode: "merge" (add new, keep existing) or "replace" (clear and overwrite)
 * @returns Statistics about the import operation
 */
export async function importData(data: ExportData, mode: "merge" | "replace"): Promise<ImportResult> {
	const storage = getAppStorage();
	let imported = 0;
	let skipped = 0;

	// Validate data structure
	if (!data.version || !Array.isArray(data.sessions)) {
		throw new Error("Invalid export data format");
	}

	// Import sessions
	if (mode === "replace") {
		// Clear existing sessions first
		await storage.sessions.clear();
	}

	// Import sessions
	for (const session of data.sessions) {
		if (mode === "merge") {
			const existing = await storage.sessions.get(session.id);
			if (existing !== null) {
				skipped++;
				continue;
			}
		}
		await storage.sessions.save(session, {
			id: session.id,
			title: session.title,
			createdAt: session.createdAt,
			lastModified: session.lastModified,
			messageCount: session.messages.length,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					total: 0,
				},
			},
			thinkingLevel: session.thinkingLevel || "off",
			preview: "",
		});
		imported++;
	}

	// Import settings
	if (mode === "replace") {
		await storage.settings.clear();
	}
	for (const [key, value] of Object.entries(data.settings)) {
		if (mode === "merge") {
			const existing = await storage.settings.get<unknown>(key);
			if (existing !== null) {
				skipped++;
				continue;
			}
		}
		await storage.settings.set(key, value);
		imported++;
	}

	// Import connections
	if (mode === "replace") {
		await storage.connections.clear();
	}
	for (const connection of data.connections) {
		if (mode === "merge") {
			const existing = await storage.connections.get(connection.id);
			if (existing !== null) {
				skipped++;
				continue;
			}
		}
		await storage.connections.add(connection);
		imported++;
	}

	// Import provider keys
	if (mode === "replace") {
		await storage.providerKeys.clear();
	}
	for (const { provider, key } of data.providerKeys) {
		if (mode === "merge") {
			const existing = await storage.providerKeys.get(provider);
			if (existing !== null) {
				skipped++;
				continue;
			}
		}
		await storage.providerKeys.set(provider, key);
		imported++;
	}

	return { imported, skipped };
}

/**
 * Parse export data from a JSON string
 * @param jsonString The JSON string to parse
 * @returns Parsed export data
 * @throws Error if JSON is invalid or data structure is wrong
 */
export function parseExportData(jsonString: string): ExportData {
	try {
		const data = JSON.parse(jsonString) as ExportData;

		// Validate required fields
		if (typeof data.version !== "number" || data.version <= 0) {
			throw new Error("Invalid or missing version field");
		}
		if (typeof data.exportedAt !== "string") {
			throw new Error("Invalid or missing exportedAt field");
		}
		if (!Array.isArray(data.sessions)) {
			throw new Error("Invalid or missing sessions field");
		}
		if (typeof data.settings !== "object" || data.settings === null) {
			throw new Error("Invalid or missing settings field");
		}
		if (!Array.isArray(data.connections)) {
			throw new Error("Invalid or missing connections field");
		}
		if (!Array.isArray(data.providerKeys)) {
			throw new Error("Invalid or missing providerKeys field");
		}

		return data;
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error("Invalid JSON format");
		}
		throw error;
	}
}

/**
 * Export and immediately download all data
 * Convenience function combining exportAllData and downloadExport
 * @param filename Optional filename
 */
export async function exportAndDownload(filename?: string): Promise<void> {
	const data = await exportAllData();
	downloadExport(data, filename);
}

/**
 * Import data from a file
 * Convenience function for reading and parsing a file
 * @param file The file to import from
 * @param mode Import mode
 * @returns Import result statistics
 */
export async function importFromFile(file: File, mode: "merge" | "replace"): Promise<ImportResult> {
	const text = await file.text();
	const data = parseExportData(text);
	return importData(data, mode);
}
