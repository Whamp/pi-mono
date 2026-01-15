import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type {
	AssistantMessage as AssistantMessageType,
	ToolResultMessage as ToolResultMessageType,
} from "@mariozechner/pi-ai";
import { html, LitElement, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { i18n } from "../utils/i18n.js";
import { renderMessage } from "./message-renderer-registry.js";

export interface SuggestedPrompt {
	title: string;
	description: string;
	prompt: string;
}

export class MessageList extends LitElement {
	@property({ type: Array }) messages: AgentMessage[] = [];
	@property({ type: Array }) tools: AgentTool[] = [];
	@property({ type: Object }) pendingToolCalls?: Set<string>;
	@property({ type: Boolean }) isStreaming: boolean = false;
	@property({ attribute: false }) onCostClick?: () => void;
	@property({ attribute: false }) onSuggestedPrompt?: (prompt: string) => void;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.style.display = "block";
	}

	private readonly defaultSuggestions: SuggestedPrompt[] = [
		{
			title: i18n("Explain a concept"),
			description: i18n("Help me understand quantum computing"),
			prompt: "Explain quantum computing in simple terms",
		},
		{
			title: i18n("Write code"),
			description: i18n("Create a React component"),
			prompt: "Create a React component for a todo list",
		},
		{
			title: i18n("Brainstorm ideas"),
			description: i18n("Help me plan a project"),
			prompt: "Help me brainstorm ideas for a mobile app",
		},
		{
			title: i18n("Analyze data"),
			description: i18n("Help me understand this dataset"),
			prompt: "What insights can you provide about this data?",
		},
	];

	private renderEmptyState() {
		return html`
			<div class="flex flex-col items-center justify-center h-full p-8 text-center">
				<!-- Logo/icon -->
				<div class="w-16 h-16 mb-6 text-primary">
					<svg class="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						/>
					</svg>
				</div>

				<!-- Welcome text -->
				<h2 class="text-xl font-semibold mb-2">${i18n("How can I help you today?")}</h2>
				<p class="text-muted-foreground text-sm mb-8">
					${i18n("Ask me anything or try one of these suggestions")}
				</p>

				<!-- Suggested prompts grid -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
					${this.defaultSuggestions.map(
						(suggestion) => html`
							<button
								@click=${() => this.onSuggestedPrompt?.(suggestion.prompt)}
								class="p-4 text-left rounded-lg border border-border hover:bg-accent transition-colors"
							>
								<div class="font-medium text-sm mb-1">${suggestion.title}</div>
								<div class="text-xs text-muted-foreground">${suggestion.description}</div>
							</button>
						`,
					)}
				</div>
			</div>
		`;
	}

	private buildRenderItems() {
		// Map tool results by call id for quick lookup
		const resultByCallId = new Map<string, ToolResultMessageType>();
		for (const message of this.messages) {
			if (message.role === "toolResult") {
				resultByCallId.set(message.toolCallId, message);
			}
		}

		const items: Array<{ key: string; template: TemplateResult }> = [];
		let index = 0;
		for (const msg of this.messages) {
			// Skip artifact messages - they're for session persistence only, not UI display
			if (msg.role === "artifact") {
				continue;
			}

			// Try custom renderer first
			const customTemplate = renderMessage(msg);
			if (customTemplate) {
				items.push({ key: `msg:${index}`, template: customTemplate });
				index++;
				continue;
			}

			// Fall back to built-in renderers
			if (msg.role === "user" || msg.role === "user-with-attachments") {
				items.push({
					key: `msg:${index}`,
					template: html`<user-message .message=${msg}></user-message>`,
				});
				index++;
			} else if (msg.role === "assistant") {
				const amsg = msg as AssistantMessageType;
				items.push({
					key: `msg:${index}`,
					template: html`<assistant-message
						.message=${amsg}
						.tools=${this.tools}
						.isStreaming=${false}
						.pendingToolCalls=${this.pendingToolCalls}
						.toolResultsById=${resultByCallId}
						.hideToolCalls=${false}
						.onCostClick=${this.onCostClick}
					></assistant-message>`,
				});
				index++;
			} else {
				// Skip standalone toolResult messages; they are rendered via paired tool-message above
				// Skip unknown roles
			}
		}
		return items;
	}

	override render() {
		// Show empty state when no messages
		if (!this.messages || this.messages.length === 0) {
			return this.renderEmptyState();
		}

		const items = this.buildRenderItems();
		return html`<div class="flex flex-col gap-3">
			${repeat(
				items,
				(it) => it.key,
				(it) => it.template,
			)}
		</div>`;
	}
}

// Register custom element
if (!customElements.get("message-list")) {
	customElements.define("message-list", MessageList);
}
