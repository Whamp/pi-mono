import { i18n } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { Dialog, DialogContent, DialogHeader } from "@mariozechner/mini-lit/dist/Dialog.js";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import { Label } from "@mariozechner/mini-lit/dist/Label.js";
import { Select } from "@mariozechner/mini-lit/dist/Select.js";
import { Switch } from "@mariozechner/mini-lit/dist/Switch.js";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { getModels, getProviders, type Model } from "@mariozechner/pi-ai";
import { html, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "../components/ProviderKeyInput.js";
import { getAppStorage } from "../storage/app-storage.js";
import type { ThemePreference } from "../storage/stores/settings-store.js";

// Base class for settings tabs
export abstract class SettingsTab extends LitElement {
	abstract getTabName(): string;

	protected createRenderRoot() {
		return this;
	}
}

// API Keys Tab
@customElement("api-keys-tab")
export class ApiKeysTab extends SettingsTab {
	getTabName(): string {
		return i18n("API Keys");
	}

	render(): TemplateResult {
		const providers = getProviders();

		return html`
			<div class="flex flex-col gap-6">
				<p class="text-sm text-muted-foreground">
					${i18n("Configure API keys for LLM providers. Keys are stored locally in your browser.")}
				</p>
				${providers.map((provider) => html`<provider-key-input .provider=${provider}></provider-key-input>`)}
			</div>
		`;
	}
}

// Proxy Tab
@customElement("proxy-tab")
export class ProxyTab extends SettingsTab {
	@state() private proxyEnabled = false;
	@state() private proxyUrl = "http://localhost:3001";

	override async connectedCallback() {
		super.connectedCallback();
		// Load proxy settings when tab is connected
		try {
			const storage = getAppStorage();
			const enabled = await storage.settings.get<boolean>("proxy.enabled");
			const url = await storage.settings.get<string>("proxy.url");

			if (enabled !== null) this.proxyEnabled = enabled;
			if (url !== null) this.proxyUrl = url;
		} catch (error) {
			console.error("Failed to load proxy settings:", error);
		}
	}

	private async saveProxySettings() {
		try {
			const storage = getAppStorage();
			await storage.settings.set("proxy.enabled", this.proxyEnabled);
			await storage.settings.set("proxy.url", this.proxyUrl);
		} catch (error) {
			console.error("Failed to save proxy settings:", error);
		}
	}

	getTabName(): string {
		return i18n("Proxy");
	}

	render(): TemplateResult {
		return html`
			<div class="flex flex-col gap-4">
				<p class="text-sm text-muted-foreground">
					${i18n("Allows browser-based apps to bypass CORS restrictions when calling LLM providers. Required for Z-AI and Anthropic with OAuth token.")}
				</p>

				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-foreground">${i18n("Use CORS Proxy")}</span>
					${Switch({
						checked: this.proxyEnabled,
						onChange: (checked: boolean) => {
							this.proxyEnabled = checked;
							this.saveProxySettings();
						},
					})}
				</div>

				<div class="space-y-2">
					${Label({ children: i18n("Proxy URL") })}
					${Input({
						type: "text",
						value: this.proxyUrl,
						disabled: !this.proxyEnabled,
						onInput: (e) => {
							this.proxyUrl = (e.target as HTMLInputElement).value;
						},
						onChange: () => this.saveProxySettings(),
					})}
					<p class="text-xs text-muted-foreground">
						${i18n("Format: The proxy must accept requests as <proxy-url>/?url=<target-url>")}
					</p>
				</div>
			</div>
		`;
	}
}

// Preferences Tab
@customElement("preferences-tab")
export class PreferencesTab extends SettingsTab {
	@state() private defaultModel: string | null = null;
	@state() private defaultThinkingLevel: ThinkingLevel = "off";
	@state() private themePreference: ThemePreference = "system";
	@state() private sidebarCollapsed = false;
	@state() private allModels: Model<any>[] = [];

	override async connectedCallback() {
		super.connectedCallback();
		await this.loadPreferences();
		this.loadModels();
	}

	private loadModels() {
		const models: Model<any>[] = [];
		const providers = getProviders();
		for (const provider of providers) {
			const providerModels = getModels(provider as any);
			models.push(...providerModels);
		}
		this.allModels = models;
	}

	private async loadPreferences() {
		try {
			const storage = getAppStorage();
			this.defaultModel = await storage.settings.getDefaultModel();
			this.defaultThinkingLevel = await storage.settings.getDefaultThinkingLevel();
			this.themePreference = await storage.settings.getThemePreference();
			this.sidebarCollapsed = await storage.settings.getSidebarCollapsed();
		} catch (error) {
			console.error("Failed to load preferences:", error);
		}
	}

	private async saveDefaultModel(modelId: string | null) {
		try {
			const storage = getAppStorage();
			await storage.settings.setDefaultModel(modelId);
			this.defaultModel = modelId;
		} catch (error) {
			console.error("Failed to save default model:", error);
		}
	}

	private async saveDefaultThinkingLevel(level: ThinkingLevel) {
		try {
			const storage = getAppStorage();
			await storage.settings.setDefaultThinkingLevel(level);
			this.defaultThinkingLevel = level;
		} catch (error) {
			console.error("Failed to save default thinking level:", error);
		}
	}

	private async saveThemePreference(theme: ThemePreference) {
		try {
			const storage = getAppStorage();
			await storage.settings.setThemePreference(theme);
			this.themePreference = theme;
		} catch (error) {
			console.error("Failed to save theme preference:", error);
		}
	}

	private async saveSidebarCollapsed(collapsed: boolean) {
		try {
			const storage = getAppStorage();
			await storage.settings.setSidebarCollapsed(collapsed);
			this.sidebarCollapsed = collapsed;
		} catch (error) {
			console.error("Failed to save sidebar collapsed preference:", error);
		}
	}

	getTabName(): string {
		return i18n("Preferences");
	}

	render(): TemplateResult {
		const thinkingLevels: Array<{ value: ThinkingLevel; label: string }> = [
			{ value: "off", label: i18n("Off") },
			{ value: "minimal", label: i18n("Minimal") },
			{ value: "low", label: i18n("Low") },
			{ value: "medium", label: i18n("Medium") },
			{ value: "high", label: i18n("High") },
			{ value: "xhigh", label: i18n("Extra High") },
		];

		const modelOptions = [
			{ value: "", label: i18n("Use last selected") },
			...this.allModels.map((m) => ({ value: m.id, label: `${m.id} (${m.provider})` })),
		];

		return html`
			<div class="flex flex-col gap-6">
				<!-- Default Model -->
				<div class="space-y-2">
					${Label({ children: i18n("Default Model") })}
					${Select({
						value: this.defaultModel ?? "",
						options: modelOptions,
						onChange: (value: string) => this.saveDefaultModel(value || null),
						placeholder: i18n("Use last selected"),
					})}
					<p class="text-xs text-muted-foreground">
						${i18n("Model used when starting a new chat")}
					</p>
				</div>

				<!-- Default Thinking Level -->
				<div class="space-y-2">
					${Label({ children: i18n("Default Thinking Level") })}
					${Select({
						value: this.defaultThinkingLevel,
						options: thinkingLevels,
						onChange: (value: string) => this.saveDefaultThinkingLevel(value as ThinkingLevel),
					})}
					<p class="text-xs text-muted-foreground">
						${i18n("Extended thinking level for reasoning models")}
					</p>
				</div>

				<!-- Theme -->
				<div class="space-y-2">
					${Label({ children: i18n("Theme") })}
					<div class="flex gap-2">
						${Button({
							variant: this.themePreference === "light" ? "default" : "outline",
							size: "sm",
							onClick: () => this.saveThemePreference("light"),
							children: i18n("Light"),
						})}
						${Button({
							variant: this.themePreference === "dark" ? "default" : "outline",
							size: "sm",
							onClick: () => this.saveThemePreference("dark"),
							children: i18n("Dark"),
						})}
						${Button({
							variant: this.themePreference === "system" ? "default" : "outline",
							size: "sm",
							onClick: () => this.saveThemePreference("system"),
							children: i18n("System"),
						})}
					</div>
					<p class="text-xs text-muted-foreground">
						${i18n("Choose your preferred color scheme")}
					</p>
				</div>

				<!-- Sidebar Default -->
				<div class="flex items-center justify-between">
					<div>
						<span class="text-sm font-medium text-foreground">${i18n("Start with sidebar closed")}</span>
						<p class="text-xs text-muted-foreground">${i18n("On desktop, collapse the sidebar by default")}</p>
					</div>
					${Switch({
						checked: this.sidebarCollapsed,
						onChange: (checked: boolean) => this.saveSidebarCollapsed(checked),
					})}
				</div>
			</div>
		`;
	}
}

@customElement("settings-dialog")
export class SettingsDialog extends LitElement {
	@property({ type: Array, attribute: false }) tabs: SettingsTab[] = [];
	@state() private isOpen = false;
	@state() private activeTabIndex = 0;

	protected createRenderRoot() {
		return this;
	}

	static async open(tabs: SettingsTab[]) {
		const dialog = new SettingsDialog();
		dialog.tabs = tabs;
		dialog.isOpen = true;
		document.body.appendChild(dialog);
	}

	private setActiveTab(index: number) {
		this.activeTabIndex = index;
	}

	private renderSidebarItem(tab: SettingsTab, index: number): TemplateResult {
		const isActive = this.activeTabIndex === index;
		return html`
			<button
				class="w-full text-left px-4 py-3 rounded-md transition-colors ${
					isActive
						? "bg-secondary text-foreground font-medium"
						: "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
				}"
				@click=${() => this.setActiveTab(index)}
			>
				${tab.getTabName()}
			</button>
		`;
	}

	private renderMobileTab(tab: SettingsTab, index: number): TemplateResult {
		const isActive = this.activeTabIndex === index;
		return html`
			<button
				class="px-3 py-2 text-sm font-medium transition-colors ${
					isActive ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
				}"
				@click=${() => this.setActiveTab(index)}
			>
				${tab.getTabName()}
			</button>
		`;
	}

	render() {
		if (this.tabs.length === 0) {
			return html``;
		}

		return Dialog({
			isOpen: this.isOpen,
			onClose: () => {
				this.isOpen = false;
				this.remove();
			},
			width: "min(1000px, 90vw)",
			height: "min(800px, 90vh)",
			backdropClassName: "bg-black/50 backdrop-blur-sm",
			children: html`
				${DialogContent({
					className: "h-full p-6",
					children: html`
						<div class="flex flex-col h-full overflow-hidden">
							<!-- Header -->
							<div class="pb-4 flex-shrink-0">${DialogHeader({ title: i18n("Settings") })}</div>

							<!-- Mobile Tabs -->
							<div class="md:hidden flex flex-shrink-0 pb-4">
								${this.tabs.map((tab, index) => this.renderMobileTab(tab, index))}
							</div>

							<!-- Layout -->
							<div class="flex flex-1 overflow-hidden">
								<!-- Sidebar (desktop only) -->
								<div class="hidden md:block w-64 flex-shrink-0 space-y-1">
									${this.tabs.map((tab, index) => this.renderSidebarItem(tab, index))}
								</div>

								<!-- Content -->
								<div class="flex-1 overflow-y-auto md:pl-6">
									${this.tabs.map(
										(tab, index) =>
											html`<div style="display: ${this.activeTabIndex === index ? "block" : "none"}">${tab}</div>`,
									)}
								</div>
							</div>
						</div>
					`,
				})}
			`,
		});
	}
}
