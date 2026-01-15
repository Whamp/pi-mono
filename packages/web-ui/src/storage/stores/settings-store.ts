import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { Store } from "../store.js";
import type { StoreConfig } from "../types.js";

export type ThemePreference = "light" | "dark" | "system";

/**
 * Store for application settings (theme, proxy config, etc.).
 */
export class SettingsStore extends Store {
	getConfig(): StoreConfig {
		return {
			name: "settings",
			// No keyPath - uses out-of-line keys
		};
	}

	async get<T>(key: string): Promise<T | null> {
		return this.getBackend().get("settings", key);
	}

	async set<T>(key: string, value: T): Promise<void> {
		await this.getBackend().set("settings", key, value);
	}

	async delete(key: string): Promise<void> {
		await this.getBackend().delete("settings", key);
	}

	async list(): Promise<string[]> {
		return this.getBackend().keys("settings");
	}

	async clear(): Promise<void> {
		await this.getBackend().clear("settings");
	}

	// Preference helpers

	async getDefaultModel(): Promise<string | null> {
		return this.get<string>("preferences.defaultModel");
	}

	async setDefaultModel(modelId: string | null): Promise<void> {
		if (modelId === null) {
			await this.delete("preferences.defaultModel");
		} else {
			await this.set("preferences.defaultModel", modelId);
		}
	}

	async getDefaultThinkingLevel(): Promise<ThinkingLevel> {
		const level = await this.get<ThinkingLevel>("preferences.defaultThinkingLevel");
		return level ?? "off";
	}

	async setDefaultThinkingLevel(level: ThinkingLevel): Promise<void> {
		await this.set("preferences.defaultThinkingLevel", level);
	}

	async getThemePreference(): Promise<ThemePreference> {
		const theme = await this.get<ThemePreference>("preferences.theme");
		return theme ?? "system";
	}

	async setThemePreference(theme: ThemePreference): Promise<void> {
		await this.set("preferences.theme", theme);
		// Also update localStorage for mini-lit's ThemeToggle compatibility
		if (theme === "system") {
			localStorage.removeItem("theme");
		} else {
			localStorage.setItem("theme", theme);
		}
		// Apply the theme
		this.applyTheme(theme);
	}

	private applyTheme(theme: ThemePreference): void {
		const effectiveTheme =
			theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
		document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
	}

	async getSidebarCollapsed(): Promise<boolean> {
		const collapsed = await this.get<boolean>("preferences.sidebarCollapsed");
		return collapsed ?? false;
	}

	async setSidebarCollapsed(collapsed: boolean): Promise<void> {
		await this.set("preferences.sidebarCollapsed", collapsed);
	}
}
