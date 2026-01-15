import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { DialogBase } from "@mariozechner/mini-lit/dist/DialogBase.js";
import { html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { RPCClient } from "../networking/RPCClient.js";
import { i18n } from "../utils/i18n.js";

/**
 * Represents a remote session from the server.
 */
export interface RemoteSession {
	/** Unique identifier for the session */
	id: string;
	/** First message preview/title */
	title: string;
	/** Total number of messages in the session */
	messageCount: number;
	/** ISO timestamp of last modification */
	lastModified: string;
	/** Path to the session file (used for switching) */
	path: string;
}

/**
 * Response from list_sessions RPC command.
 */
interface ListSessionsResponse {
	sessions: RemoteSession[];
}

/**
 * Dialog for browsing and selecting remote sessions from a connected server.
 *
 * Features:
 * - Fetches session list via list_sessions RPC command
 * - Shows sessions with first message preview, message count, and last modified
 * - Click to select and open session
 * - New session button
 * - Loading and empty states
 * - Error handling for graceful degradation
 *
 * @example
 * ```typescript
 * const dialog = await RemoteSessionsDialog.open(
 *   rpcClient,
 *   (sessionId) => {
 *     console.log("Selected session:", sessionId);
 *   },
 *   () => {
 *     console.log("New session requested");
 *   }
 * );
 * ```
 */
@customElement("remote-sessions-dialog")
export class RemoteSessionsDialog extends DialogBase {
	@state() private sessions: RemoteSession[] = [];
	@state() private loading = true;
	@state() private error: string | null = null;

	private onSessionSelectCallback?: (session: RemoteSession) => void;
	private onNewSessionCallback?: () => void;

	private rpcClient!: RPCClient;

	protected modalWidth = "min(600px, 90vw)";
	protected modalHeight = "min(700px, 90vh)";

	/**
	 * Opens the remote sessions dialog.
	 *
	 * @param rpcClient - The connected RPC client to use for fetching sessions
	 * @param onSessionSelect - Callback when a session is selected
	 * @param onNewSession - Callback when "New Session" button is clicked
	 * @returns The dialog instance
	 */
	static async open(
		rpcClient: RPCClient,
		onSessionSelect: (session: RemoteSession) => void,
		onNewSession?: () => void,
	) {
		const dialog = new RemoteSessionsDialog();
		dialog.rpcClient = rpcClient;
		dialog.onSessionSelectCallback = onSessionSelect;
		dialog.onNewSessionCallback = onNewSession;
		dialog.open();
		await dialog.loadSessions();
	}

	/**
	 * Loads sessions from the remote server.
	 */
	private async loadSessions() {
		this.loading = true;
		this.error = null;

		try {
			// Note: list_sessions command may not be implemented in the server yet
			// We use a type assertion to bypass type checking for now
			const response = await this.rpcClient.sendCommand<ListSessionsResponse>({
				type: "list_sessions",
			} as any);

			if (response && typeof response === "object" && "sessions" in response) {
				this.sessions = response.sessions || [];
			} else {
				// Handle response that doesn't match expected format
				console.warn("Unexpected list_sessions response format:", response);
				this.sessions = [];
			}
		} catch (err) {
			// Graceful error handling - show empty state with message
			console.error("Failed to load remote sessions:", err);
			this.error = err instanceof Error ? err.message : String(err);
			this.sessions = [];
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Handles clicking on a session card.
	 */
	private handleSelect(session: RemoteSession) {
		if (this.onSessionSelectCallback) {
			this.onSessionSelectCallback(session);
		}
		this.close();
	}

	/**
	 * Handles clicking the "New Session" button.
	 */
	private handleNewSession() {
		this.close();
		if (this.onNewSessionCallback) {
			this.onNewSessionCallback();
		}
	}

	/**
	 * Formats an ISO date string for display.
	 */
	private formatDate(isoString: string): string {
		const date = new Date(isoString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) {
			return i18n("Today");
		} else if (days === 1) {
			return i18n("Yesterday");
		} else if (days < 7) {
			return i18n("{days} days ago").replace("{days}", days.toString());
		} else {
			return date.toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		}
	}

	/**
	 * Renders the error state.
	 */
	private renderErrorState(): TemplateResult {
		return html`
			<div class="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
				<p>${i18n("Failed to load sessions")}</p>
				${this.error ? html`<p class="text-sm text-destructive">${this.error}</p>` : null}
				${Button({
					onClick: () => this.loadSessions(),
					variant: "outline",
					children: i18n("Retry"),
				})}
			</div>
		`;
	}

	/**
	 * Renders the empty state.
	 */
	private renderEmptyState(): TemplateResult {
		return html`
			<div class="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
				<p>${i18n("No remote sessions yet")}</p>
				${Button({
					onClick: () => this.handleNewSession(),
					variant: "default",
					children: html`<span class="inline-flex items-center gap-1">+ ${i18n("New Session")}</span>`,
				})}
			</div>
		`;
	}

	/**
	 * Renders a session card.
	 */
	private renderSessionCard(session: RemoteSession): TemplateResult {
		return html`
			<div
				class="p-4 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors"
				@click=${() => this.handleSelect(session)}
			>
				<div class="font-medium text-foreground mb-2 truncate">"${session.title}"</div>
				<div class="text-sm text-muted-foreground">
					${session.messageCount} ${i18n("messages")} · ${this.formatDate(session.lastModified)}
				</div>
			</div>
		`;
	}

	/**
	 * Renders the session list.
	 */
	private renderSessionList(): TemplateResult {
		if (this.sessions.length === 0) {
			return this.renderEmptyState();
		}

		return html`
			<div class="flex flex-col h-full overflow-hidden">
				<!-- Session list -->
				<div class="flex-1 overflow-y-auto p-4 space-y-2">
					${this.sessions.map((session) => this.renderSessionCard(session))}
				</div>

				<!-- Footer -->
				<div class="p-4 border-t border-border flex justify-between items-center">
					${Button({
						onClick: () => this.handleNewSession(),
						variant: "outline",
						children: html`<span class="inline-flex items-center gap-1">+ ${i18n("New Session")}</span>`,
					})}
					${Button({
						onClick: () => this.close(),
						variant: "ghost",
						children: i18n("Close"),
					})}
				</div>
			</div>
		`;
	}

	/**
	 * Renders the loading state.
	 */
	private renderLoadingState(): TemplateResult {
		return html`
			<div class="flex items-center justify-center h-full text-muted-foreground">
				${i18n("Loading...")}
			</div>
		`;
	}

	protected override renderContent(): TemplateResult {
		return html`
			<div class="p-6 pb-4 flex-shrink-0 border-b border-border">
				<h2 class="text-lg font-semibold text-foreground">${i18n("Remote Sessions")}</h2>
			</div>

			${this.loading ? this.renderLoadingState() : this.error ? this.renderErrorState() : this.renderSessionList()}
		`;
	}
}
