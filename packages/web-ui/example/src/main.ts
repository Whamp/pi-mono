import "@mariozechner/mini-lit/dist/ThemeToggle.js";
import { Agent, type AgentMessage, type AgentState } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import {
	ApiKeyPromptDialog,
	AppStorage,
	ChatPanel,
	ConnectionsStore,
	CustomProvidersStore,
	createJavaScriptReplTool,
	exportSessionAsJson,
	IndexedDBStorageBackend,
	// PersistentStorageDialog, // TODO: Fix - currently broken
	ProviderKeysStore,
	ProvidersModelsTab,
	ProxyTab,
	SessionsStore,
	SettingsDialog,
	SettingsStore,
	type SidebarSessionMetadata,
	setAppStorage,
} from "@mariozechner/pi-web-ui";
// Side-effect imports: these register custom elements
import "@mariozechner/pi-web-ui/dist/components/AppLayout.js";
import "@mariozechner/pi-web-ui/dist/components/Header.js";
import "@mariozechner/pi-web-ui/dist/components/Sidebar.js";
import { html, render } from "lit";
import { Bell } from "lucide";
import "./app.css";
import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { createSystemNotification, customConvertToLlm, registerCustomMessageRenderers } from "./custom-messages.js";

// Register custom message renderers
registerCustomMessageRenderers();

// Create stores
const settings = new SettingsStore();
const providerKeys = new ProviderKeysStore();
const sessions = new SessionsStore();
const customProviders = new CustomProvidersStore();
const connections = new ConnectionsStore();

// Gather configs
const configs = [
	settings.getConfig(),
	SessionsStore.getMetadataConfig(),
	providerKeys.getConfig(),
	customProviders.getConfig(),
	connections.getConfig(),
	sessions.getConfig(),
];

// Create backend
const backend = new IndexedDBStorageBackend({
	dbName: "pi-web-ui-example",
	version: 3, // Incremented for connections store
	stores: configs,
});

// Wire backend to stores
settings.setBackend(backend);
providerKeys.setBackend(backend);
customProviders.setBackend(backend);
connections.setBackend(backend);
sessions.setBackend(backend);

// Create and set app storage
const storage = new AppStorage(settings, providerKeys, sessions, customProviders, connections, backend);
setAppStorage(storage);

let currentSessionId: string | undefined;
let currentTitle = "";
let agent: Agent;
let chatPanel: ChatPanel;
let agentUnsubscribe: (() => void) | undefined;

// New state for layout
let sidebarOpen = false;
let sessionsList: SidebarSessionMetadata[] = [];

const generateTitle = (messages: AgentMessage[]): string => {
	const firstUserMsg = messages.find((m) => m.role === "user" || m.role === "user-with-attachments");
	if (!firstUserMsg || (firstUserMsg.role !== "user" && firstUserMsg.role !== "user-with-attachments")) return "";

	let text = "";
	const content = firstUserMsg.content;

	if (typeof content === "string") {
		text = content;
	} else {
		const textBlocks = content.filter((c: unknown) => (c as { type?: string }).type === "text");
		text = textBlocks.map((c: unknown) => (c as { text?: string }).text || "").join(" ");
	}

	text = text.trim();
	if (!text) return "";

	const sentenceEnd = text.search(/[.!?]/);
	if (sentenceEnd > 0 && sentenceEnd <= 50) {
		return text.substring(0, sentenceEnd + 1);
	}
	return text.length <= 50 ? text : `${text.substring(0, 47)}...`;
};

const shouldSaveSession = (messages: AgentMessage[]): boolean => {
	const hasUserMsg = messages.some((m) => m.role === "user" || m.role === "user-with-attachments");
	const hasAssistantMsg = messages.some((m) => m.role === "assistant");
	return hasUserMsg && hasAssistantMsg;
};

const loadSessionsList = async () => {
	if (!storage.sessions) return;
	const allMetadata = await storage.sessions.getAllMetadata();
	// Convert to sidebar format
	sessionsList = allMetadata.map((meta) => ({
		id: meta.id,
		title: meta.title || "Untitled",
		preview: meta.preview || "",
		lastModified: meta.lastModified,
		messageCount: meta.messageCount || 0,
		usage: meta.usage
			? {
					totalInputTokens: meta.usage.input || 0,
					totalOutputTokens: meta.usage.output || 0,
					totalCost: meta.usage.cost?.total || 0,
				}
			: undefined,
	}));
};

const saveSession = async () => {
	if (!storage.sessions || !currentSessionId || !agent || !currentTitle) return;

	const state = agent.state;
	if (!shouldSaveSession(state.messages)) return;

	try {
		// Create session data
		const sessionData = {
			id: currentSessionId,
			title: currentTitle,
			model: state.model!,
			thinkingLevel: state.thinkingLevel,
			messages: state.messages,
			createdAt: new Date().toISOString(),
			lastModified: new Date().toISOString(),
		};

		// Create session metadata
		const metadata = {
			id: currentSessionId,
			title: currentTitle,
			createdAt: sessionData.createdAt,
			lastModified: sessionData.lastModified,
			messageCount: state.messages.length,
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
			modelId: state.model?.id || null,
			thinkingLevel: state.thinkingLevel,
			preview: generateTitle(state.messages),
		};

		await storage.sessions.save(sessionData, metadata);

		// Refresh sidebar list
		await loadSessionsList();
	} catch (err) {
		console.error("Failed to save session:", err);
	}
};

const updateUrl = (sessionId: string) => {
	const url = new URL(window.location.href);
	url.searchParams.set("session", sessionId);
	window.history.replaceState({}, "", url);
};

const createAgent = async (initialState?: Partial<AgentState>) => {
	if (agentUnsubscribe) {
		agentUnsubscribe();
	}

	agent = new Agent({
		initialState: initialState || {
			systemPrompt: `You are a helpful AI assistant with access to various tools.

Available tools:
- JavaScript REPL: Execute JavaScript code in a sandboxed browser environment (can do calculations, get time, process data, create visualizations, etc.)
- Artifacts: Create interactive HTML, SVG, Markdown, and text artifacts

Feel free to use these tools when needed to provide accurate and helpful responses.`,
			model: getModel("anthropic", "claude-sonnet-4-5-20250929"),
			thinkingLevel: "off",
			messages: [],
			tools: [],
		},
		// Custom transformer: convert custom messages to LLM-compatible format
		convertToLlm: customConvertToLlm,
	});

	agentUnsubscribe = agent.subscribe((event) => {
		// React to message and turn events for UI updates and session saving
		const updateEvents = ["message_start", "message_end", "turn_start", "turn_end", "agent_start", "agent_end"];
		if (updateEvents.includes(event.type)) {
			const messages = agent.state.messages;

			// Generate title after first successful response
			if (!currentTitle && shouldSaveSession(messages)) {
				currentTitle = generateTitle(messages);
			}

			// Create session ID on first successful save
			if (!currentSessionId && shouldSaveSession(messages)) {
				currentSessionId = crypto.randomUUID();
				updateUrl(currentSessionId);
			}

			// Auto-save
			if (currentSessionId) {
				saveSession();
			}

			renderApp();
		} else if (event.type === "message_update") {
			// Handle streaming updates - just re-render
			renderApp();
		}
	});

	await chatPanel.setAgent(agent, {
		onApiKeyRequired: async (provider: string) => {
			return await ApiKeyPromptDialog.prompt(provider);
		},
		toolsFactory: (_agent, _agentInterface, _artifactsPanel, runtimeProvidersFactory) => {
			// Create javascript_repl tool with access to attachments + artifacts
			const replTool = createJavaScriptReplTool();
			replTool.runtimeProvidersFactory = runtimeProvidersFactory;
			return [replTool];
		},
	});
};

const loadSession = async (sessionId: string): Promise<boolean> => {
	if (!storage.sessions) return false;

	const sessionData = await storage.sessions.get(sessionId);
	if (!sessionData) {
		console.error("Session not found:", sessionId);
		return false;
	}

	currentSessionId = sessionId;
	const metadata = await storage.sessions.getMetadata(sessionId);
	currentTitle = metadata?.title || "";

	await createAgent({
		model: sessionData.model,
		thinkingLevel: sessionData.thinkingLevel,
		messages: sessionData.messages,
		tools: [],
	});

	updateUrl(sessionId);
	renderApp();
	return true;
};

const newSession = () => {
	const url = new URL(window.location.href);
	url.search = "";
	window.location.href = url.toString();
};

// ============================================================================
// RENDER
// ============================================================================
const renderApp = () => {
	const app = document.getElementById("app");
	if (!app) return;

	const isMobile = window.innerWidth < 1024;

	const appHtml = html`
		<pi-app-layout
			?sidebarOpen=${sidebarOpen}
			.onSidebarToggle=${() => {
				sidebarOpen = !sidebarOpen;
				renderApp();
			}}
		>
			<!-- Sidebar -->
			<pi-sidebar
				slot="sidebar"
				.sessions=${sessionsList}
				.activeSessionId=${currentSessionId || null}
				.onSelect=${async (sessionId: string) => {
					await loadSession(sessionId);
					if (isMobile) sidebarOpen = false;
					renderApp();
				}}
				.onNewChat=${() => {
					newSession();
				}}
				.onDelete=${async (sessionId: string) => {
					if (storage.sessions) {
						await storage.sessions.delete(sessionId);
						await loadSessionsList();
						if (sessionId === currentSessionId) {
							newSession();
						} else {
							renderApp();
						}
					}
				}}
				.onRename=${async (sessionId: string, newTitle: string) => {
					if (storage.sessions) {
						await storage.sessions.updateTitle(sessionId, newTitle);
						if (sessionId === currentSessionId) {
							currentTitle = newTitle;
						}
						await loadSessionsList();
						renderApp();
					}
				}}
				.onExport=${async (sessionId: string) => {
					if (storage.sessions) {
						const sessionData = await storage.sessions.get(sessionId);
						if (sessionData) {
							exportSessionAsJson({
								id: sessionData.id,
								title: sessionData.title,
								messages: sessionData.messages,
								metadata: {
									createdAt: sessionData.createdAt,
									lastModified: sessionData.lastModified,
									model: sessionData.model?.id,
								},
							});
						}
					}
				}}
			></pi-sidebar>

			<!-- Header wrapper with pi-header and extra controls -->
			<div slot="header" class="flex items-center border-b border-border bg-background">
				<pi-header
					class="flex-1 border-b-0"
					.title=${currentTitle || "New Chat"}
					?showMenuButton=${isMobile}
					.modelName=${agent?.state.model?.name || ""}
					.thinkingLevel=${agent?.state.thinkingLevel || "off"}
					?isStreaming=${agent?.state.isStreaming || false}
					.onMenuClick=${() => {
						sidebarOpen = !sidebarOpen;
						renderApp();
					}}
					.onTitleEdit=${async (newTitle: string) => {
						if (currentSessionId && storage.sessions) {
							await storage.sessions.updateTitle(currentSessionId, newTitle);
							currentTitle = newTitle;
							await loadSessionsList();
							renderApp();
						}
					}}
					.onSettingsClick=${() => SettingsDialog.open([new ProvidersModelsTab(), new ProxyTab()])}
					.onNewChatClick=${() => newSession()}
				></pi-header>
				<!-- Extra controls (theme toggle and demo button) -->
				<div class="flex items-center gap-1 px-2">
					${Button({
						variant: "ghost",
						size: "sm",
						children: icon(Bell, "sm"),
						onClick: () => {
							// Demo: Inject custom message (will appear on next agent run)
							if (agent) {
								agent.steer(
									createSystemNotification(
										"This is a custom message! It appears in the UI but is never sent to the LLM.",
									),
								);
							}
						},
						title: "Demo: Add Custom Notification",
					})}
					<theme-toggle></theme-toggle>
				</div>
			</div>

			<!-- Main content (default slot) -->
			${chatPanel}
		</pi-app-layout>
	`;

	render(appHtml, app);
};

// Handle resize for responsive layout
window.addEventListener("resize", () => {
	renderApp();
});

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
				<div class="text-muted-foreground">Loading...</div>
			</div>
		`,
		app,
	);

	// TODO: Fix PersistentStorageDialog - currently broken
	// Request persistent storage
	// if (storage.sessions) {
	// 	await PersistentStorageDialog.request();
	// }

	// Create ChatPanel
	chatPanel = new ChatPanel();

	// Load sessions list for sidebar
	await loadSessionsList();

	// Check for session in URL
	const urlParams = new URLSearchParams(window.location.search);
	const sessionIdFromUrl = urlParams.get("session");

	if (sessionIdFromUrl) {
		const loaded = await loadSession(sessionIdFromUrl);
		if (!loaded) {
			// Session doesn't exist, redirect to new session
			newSession();
			return;
		}
	} else {
		await createAgent();
	}

	renderApp();
}

initApp();
