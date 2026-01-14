import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import { type AgentMessage } from "@mariozechner/pi-agent-core";
import {
	ChatPanel,
	IndexedDBStorageBackend,
	SettingsStore,
	setAppStorage,
    AppStorage,
    ProviderKeysStore,
    SessionsStore,
    CustomProvidersStore,
    ApiKeyPromptDialog
} from "@mariozechner/pi-web-ui";
import { html, render } from "lit";
import { Bell, History, Plus, Settings } from "lucide";
import "./app.css";
import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { createSystemNotification, registerCustomMessageRenderers } from "./custom-messages.js";
import { RemoteAgent } from "./remote-agent.js";

// Register custom message renderers
registerCustomMessageRenderers();

// Create stores (still needed for theme/settings)
const settings = new SettingsStore();
const providerKeys = new ProviderKeysStore();
const sessions = new SessionsStore();
const customProviders = new CustomProvidersStore();

const backend = new IndexedDBStorageBackend({
	dbName: "pi-droid-client",
	version: 1,
	stores: [
        settings.getConfig(),
        providerKeys.getConfig(),
        sessions.getConfig(),
        SessionsStore.getMetadataConfig(),
        customProviders.getConfig()
    ],
});

settings.setBackend(backend);
providerKeys.setBackend(backend);
sessions.setBackend(backend);
customProviders.setBackend(backend);

const storage = new AppStorage(settings, providerKeys, sessions, customProviders, backend);
setAppStorage(storage);

let currentTitle = "Droid";
let agent: RemoteAgent;
let chatPanel: ChatPanel;

// ============================================================================
// RENDER
// ============================================================================
const renderApp = () => {
	const app = document.getElementById("app");
	if (!app) return;

	const appHtml = html`
		<div class="w-full h-screen flex flex-col bg-background text-foreground overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-border shrink-0">
				<div class="flex items-center gap-2 px-4 py-2">
					${Button({
						variant: "ghost",
						size: "sm",
						children: icon(Plus, "sm"),
						onClick: () => window.location.reload(),
						title: "New Session",
					})}

					<span class="text-base font-semibold text-foreground">${currentTitle}</span>
				</div>
				<div class="flex items-center gap-1 px-2">
					<theme-toggle></theme-toggle>
				</div>
			</div>

			<!-- Chat Panel -->
			${chatPanel}
		</div>
	`;

	render(appHtml, app);
};

// ============================================================================
// INIT
// ============================================================================
async function initApp() {
	const app = document.getElementById("app");
	if (!app) throw new Error("App container not found");

	// Show loading
	render(
		html`
			<div class="w-full h-screen flex items-center justify-center bg-background text-foreground">
				<div class="text-muted-foreground">Connecting to Droid...</div>
			</div>
		`,
		app,
	);

	chatPanel = new ChatPanel();

    const wsUrl = import.meta.env.DEV ? 'ws://localhost:3000' : `ws://${window.location.host}`;
    agent = new RemoteAgent(wsUrl);

    // Update title when first user message arrives (mirrored from backend)
    agent.subscribe((event: any) => {
        if (event.type === 'state-update') {
            renderApp();
        }
    });

	await chatPanel.setAgent(agent, {
		onApiKeyRequired: async (provider: string) => {
             // Backend handles keys
			return false;
		},
		toolsFactory: () => [], // Remote tools only
	});

	renderApp();
}

initApp();
