import type { ConnectionProfile } from "../../networking/connection-types.js";
import { Store } from "../store.js";
import type { StoreConfig } from "../types.js";

/**
 * Store for connection profiles (saved WebSocket connections to remote sessions).
 */
export class ConnectionsStore extends Store {
	getConfig(): StoreConfig {
		return {
			name: "connections",
			keyPath: "id",
			indices: [{ name: "url", keyPath: "url", unique: false }],
		};
	}

	async add(profile: ConnectionProfile): Promise<void> {
		await this.getBackend().set("connections", profile.id, profile);
	}

	async get(id: string): Promise<ConnectionProfile | null> {
		return this.getBackend().get<ConnectionProfile>("connections", id);
	}

	async getAll(): Promise<ConnectionProfile[]> {
		const keys = await this.getBackend().keys("connections");
		const profiles: ConnectionProfile[] = [];
		for (const key of keys) {
			const profile = await this.get(key);
			if (profile) {
				profiles.push(profile);
			}
		}
		return profiles;
	}

	async update(profile: ConnectionProfile): Promise<void> {
		await this.getBackend().set("connections", profile.id, profile);
	}

	async delete(id: string): Promise<void> {
		await this.getBackend().delete("connections", id);
	}

	async getByUrl(url: string): Promise<ConnectionProfile | null> {
		const allProfiles = await this.getAll();
		return allProfiles.find((p) => p.url === url) ?? null;
	}

	async clear(): Promise<void> {
		await this.getBackend().clear("connections");
	}
}
