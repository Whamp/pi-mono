import { getAppStorage } from "./app-storage.js";

/**
 * Migration interface for schema upgrades.
 */
export interface Migration {
	/** Schema version this migration upgrades to */
	version: number;
	/** Human-readable description of what this migration does */
	description: string;
	/** Migration implementation - should be idempotent */
	migrate: () => Promise<void>;
}

/**
 * All migrations in version order.
 * Add new migrations to the end of this array.
 */
export const MIGRATIONS: Migration[] = [
	// Future migrations will be added here
	// Example:
	// {
	//   version: 2,
	//   description: "Add usage tracking to sessions",
	//   migrate: async () => { ... },
	// },
];

/**
 * Key used to store the current schema version in settings.
 */
const VERSION_KEY = "schema.version";

/**
 * Get the current schema version from storage.
 * Returns 1 if no version is stored (initial state).
 */
export async function getCurrentVersion(): Promise<number> {
	try {
		const storage = getAppStorage();
		const version = await storage.settings.get<number>(VERSION_KEY);
		return version ?? 1;
	} catch (error) {
		// If storage is not available, assume version 1
		console.warn("Failed to get schema version, assuming version 1:", error);
		return 1;
	}
}

/**
 * Set the current schema version in storage.
 */
export async function setVersion(version: number): Promise<void> {
	try {
		const storage = getAppStorage();
		await storage.settings.set(VERSION_KEY, version);
	} catch (error) {
		console.error("Failed to set schema version:", error);
		throw error;
	}
}

/**
 * Run all pending migrations in sequence.
 *
 * @returns Result object with number of migrations run and final version
 * @throws Error if a migration fails (version is NOT updated on failure)
 */
export async function runMigrations(): Promise<{
	migrationsRun: number;
	currentVersion: number;
}> {
	const current = await getCurrentVersion();
	const pending = MIGRATIONS.filter((m) => m.version > current);

	if (pending.length === 0) {
		const latestVersion = MIGRATIONS.length > 0 ? MIGRATIONS[MIGRATIONS.length - 1]!.version : 1;
		return { migrationsRun: 0, currentVersion: latestVersion };
	}

	console.log(`Running ${pending.length} migration(s) from version ${current}...`);

	let migrationsRun = 0;

	for (const migration of pending) {
		console.log(`Running migration ${migration.version}: ${migration.description}`);

		try {
			await migration.migrate();
			// Only update version if migration succeeded
			await setVersion(migration.version);
			migrationsRun++;
			console.log(`Migration ${migration.version} completed successfully`);
		} catch (error) {
			console.error(`Migration ${migration.version} failed:`, error);
			// Don't update version on failure - allowing retry on next startup
			throw new Error(
				`Migration ${migration.version} (${migration.description}) failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	const finalVersion = MIGRATIONS.length > 0 ? MIGRATIONS[MIGRATIONS.length - 1]!.version : current;
	console.log(`All migrations completed. Current version: ${finalVersion}`);

	return { migrationsRun, currentVersion: finalVersion };
}

/**
 * Check if there are pending migrations without running them.
 */
export async function hasPendingMigrations(): Promise<boolean> {
	const current = await getCurrentVersion();
	return MIGRATIONS.some((m) => m.version > current);
}

/**
 * Get the latest schema version (highest migration version).
 */
export function getLatestVersion(): number {
	return MIGRATIONS.length > 0 ? MIGRATIONS[MIGRATIONS.length - 1]!.version : 1;
}
