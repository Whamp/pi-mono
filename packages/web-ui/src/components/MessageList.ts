import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type {
	AssistantMessage as AssistantMessageType,
	ToolResultMessage as ToolResultMessageType,
} from "@mariozechner/pi-ai";
import { html, LitElement, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { i18n } from "../utils/i18n.js";
import type { SearchOptions } from "../utils/search-utils.js";
import type { MessageMatch } from "./AgentInterface.js";
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

	// Search highlighting props
	@property({ type: String }) searchQuery = "";
	@property({ attribute: false }) searchOptions?: SearchOptions;
	@property({ type: Array }) searchMatches: MessageMatch[] = [];
	@property({ type: Number }) currentMatchIndex = 0; // 1-based index across all matches

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.style.display = "block";
	}

	override updated(changedProperties: Map<string, unknown>): void {
		super.updated(changedProperties);
		// Apply search highlighting after render
		if (
			changedProperties.has("searchQuery") ||
			changedProperties.has("searchOptions") ||
			changedProperties.has("searchMatches") ||
			changedProperties.has("currentMatchIndex") ||
			changedProperties.has("messages")
		) {
			this.applySearchHighlighting();
		}
	}

	/**
	 * Apply search highlighting to rendered message content using DOM manipulation.
	 * Uses CSS Custom Highlight API if available, falls back to mark element wrapping.
	 */
	private applySearchHighlighting(): void {
		// Clear any existing highlights first
		this.clearSearchHighlighting();

		if (!this.searchQuery || !this.searchOptions || this.searchMatches.length === 0) {
			return;
		}

		const currentMatchInfo = this.getCurrentMatchInfo();

		// For each message with matches, find and highlight text nodes
		for (const match of this.searchMatches) {
			const messageEl = this.querySelector(`[data-message-index="${match.messageIndex}"]`);
			if (!messageEl) continue;

			// Find markdown-block or message content containers
			const contentContainers = Array.from(messageEl.querySelectorAll("markdown-block, .message-content"));
			for (const container of contentContainers) {
				this.highlightTextInElement(container, match.positions, currentMatchInfo, match.messageIndex);
			}
		}

		// Scroll to the current match after highlighting is applied
		this.scrollToCurrentMatch();
	}

	/**
	 * Scroll the current match element into view.
	 */
	private scrollToCurrentMatch(): void {
		const currentMatch = this.querySelector(".search-match-current");
		if (currentMatch) {
			currentMatch.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}

	/**
	 * Highlight matching text within a DOM element by wrapping matches in <mark> elements.
	 */
	private highlightTextInElement(
		element: Element,
		_positions: Array<{ start: number; end: number }>,
		currentMatchInfo: { messageIndex: number; positionIndex: number } | undefined,
		messageIndex: number,
	): void {
		// Use TreeWalker to find all text nodes
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
		const textNodes: Text[] = [];
		let node: Text | null = null;

		while (true) {
			node = walker.nextNode() as Text | null;
			if (node === null) break;
			textNodes.push(node);
		}

		// Build regex from search query
		const options = this.searchOptions;
		if (!options) return;

		let regex: RegExp;
		try {
			if (options.regex) {
				const flags = options.caseSensitive ? "g" : "gi";
				regex = new RegExp(this.searchQuery, flags);
			} else {
				const escaped = this.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const flags = options.caseSensitive ? "g" : "gi";
				regex = new RegExp(escaped, flags);
			}
		} catch {
			return; // Invalid regex
		}

		// Track which match we're on within this message
		let matchIndexInMessage = 0;

		// Process each text node
		for (const textNode of textNodes) {
			const text = textNode.textContent || "";
			if (!text) continue;

			// Find matches in this text node
			const matches: Array<{ start: number; end: number; text: string }> = [];
			let m: RegExpExecArray | null = null;

			while (true) {
				m = regex.exec(text);
				if (m === null) break;
				matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
				if (m[0].length === 0) regex.lastIndex++;
			}

			if (matches.length === 0) continue;

			// Create document fragment with highlighted text
			const fragment = document.createDocumentFragment();
			let lastIndex = 0;

			for (const match of matches) {
				// Add text before match
				if (match.start > lastIndex) {
					fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.start)));
				}

				// Create mark element
				const mark = document.createElement("mark");
				mark.className = "search-match";
				mark.setAttribute("data-search-match", "true");

				// Check if this is the current match
				if (
					currentMatchInfo &&
					currentMatchInfo.messageIndex === messageIndex &&
					currentMatchInfo.positionIndex === matchIndexInMessage
				) {
					mark.classList.add("search-match-current");
				}

				mark.textContent = match.text;
				fragment.appendChild(mark);

				lastIndex = match.end;
				matchIndexInMessage++;
			}

			// Add remaining text
			if (lastIndex < text.length) {
				fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
			}

			// Replace the text node with our fragment
			textNode.parentNode?.replaceChild(fragment, textNode);
		}
	}

	/**
	 * Remove all search highlighting from the DOM.
	 */
	private clearSearchHighlighting(): void {
		const marks = Array.from(this.querySelectorAll('mark[data-search-match="true"]'));
		for (const mark of marks) {
			const parent = mark.parentNode;
			if (parent) {
				// Replace mark with its text content
				const textNode = document.createTextNode(mark.textContent || "");
				parent.replaceChild(textNode, mark);
				// Normalize to merge adjacent text nodes
				parent.normalize();
			}
		}
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

	/**
	 * Given the global currentMatchIndex (1-based), find which message has the current match
	 * and which position within that message is current.
	 * Returns { messageIndex: number, positionIndex: number } or undefined if no current match.
	 */
	private getCurrentMatchInfo(): { messageIndex: number; positionIndex: number } | undefined {
		if (this.currentMatchIndex === 0 || this.searchMatches.length === 0) {
			return undefined;
		}

		// currentMatchIndex is 1-based, convert to 0-based
		let remaining = this.currentMatchIndex - 1;

		for (const match of this.searchMatches) {
			if (remaining < match.positions.length) {
				return { messageIndex: match.messageIndex, positionIndex: remaining };
			}
			remaining -= match.positions.length;
		}

		return undefined;
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
				const msgIndex = index;
				items.push({
					key: `msg:${index}`,
					template: html`<div data-message-index="${msgIndex}"><user-message .message=${msg}></user-message></div>`,
				});
				index++;
			} else if (msg.role === "assistant") {
				const amsg = msg as AssistantMessageType;
				const msgIndex = index;
				items.push({
					key: `msg:${index}`,
					template: html`<div data-message-index="${msgIndex}"><assistant-message
						.message=${amsg}
						.tools=${this.tools}
						.isStreaming=${false}
						.pendingToolCalls=${this.pendingToolCalls}
						.toolResultsById=${resultByCallId}
						.hideToolCalls=${false}
						.onCostClick=${this.onCostClick}
					></assistant-message></div>`,
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
