import type { WebSocket } from 'ws';
import {
    createAgentSession,
    discoverAuthStorage,
    discoverModels,
    AgentSession,
    SessionManager,
    SettingsManager,
    ModelRegistry
} from '@mariozechner/pi-coding-agent';

// initTheme is not exported, but we probably don't need it for headless/server mode
// unless AgentSession relies on global theme state for markdown processing?
// Looking at AgentSession code, it calls exportSessionToHtml which uses theme.
// But mostly it's for TUI.
// We will skip initTheme for now.

export class AgentManager {
    private authStorage = discoverAuthStorage();
    private modelRegistry: ModelRegistry;

    constructor() {
        this.modelRegistry = discoverModels(this.authStorage);
        // Initialize theme for syntax highlighting - skipped
        // const cwd = process.cwd();
        // const settingsManager = SettingsManager.create(cwd);
        // initTheme(settingsManager.getTheme(), false);
    }

    async createSession(sessionPath?: string): Promise<AgentSession> {
        const cwd = process.cwd();
        let sessionManager: SessionManager;

        if (sessionPath) {
             sessionManager = SessionManager.open(sessionPath);
        } else {
             // Create new session in default location
             // passing undefined for sessionDir uses default logic
             sessionManager = SessionManager.create(cwd);
        }

        const { session } = await createAgentSession({
            sessionManager,
            authStorage: this.authStorage,
            modelRegistry: this.modelRegistry,
            // We can add more options here like system prompt, etc.
        });

        // If no model is set (new session), set default if available
        if (!session.model) {
            const available = await session.getAvailableModels();
            if (available.length > 0) {
                // Try to find a reasonable default or just pick first
                const defaultModel = available.find(m => m.id.includes('sonnet') || m.id.includes('gpt-4')) || available[0];
                await session.setModel(defaultModel);
            }
        }

        return session;
    }
}
