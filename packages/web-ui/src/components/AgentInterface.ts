import { streamSimple, type ToolResultMessage, type Usage } from "@mariozechner/pi-ai";
import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { ModelSelector } from "../dialogs/ModelSelector.js";
import type { MessageEditor } from "./MessageEditor.js";
import "./MessageEditor.js";
import "./MessageList.js";
import "./Messages.js"; // Import for side effects to register the custom elements
import { getAppStorage } from "../storage/app-storage.js";
import "./StreamingMessageContainer.js";
import "./FindBar.js";
import "./ContextWarning.js";
import type { Agent, AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";
import type { Attachment } from "../utils/attachment-utils.js";
import { formatUsage } from "../utils/format.js";
import { i18n } from "../utils/i18n.js";
import { createStreamFn } from "../utils/proxy-utils.js";
import type { FindBarOptions } from "./FindBar.js";
import type { UserMessageWithAttachments } from "./Messages.js";
import type { StreamingMessageContainer } from "./StreamingMessageContainer.js";

export interface MessageMatch {
	messageId: string;
	messageIndex: number;
	positions: Array<{ start: number; end: number }>;
}

@customElement("agent-interface")
export class AgentInterface extends LitElement {
	// Optional external session: when provided, this component becomes a view over the session
	@property({ attribute: false }) session?: Agent;
	@property({ type: Boolean }) enableAttachments = true;
	@property({ type: Boolean }) enableModelSelector = true;
	@property({ type: Boolean }) enableThinkingSelector = true;
	@property({ type: Boolean }) showThemeToggle = false;
	// Optional custom API key prompt handler - if not provided, uses default dialog
	@property({ attribute: false }) onApiKeyRequired?: (provider: string) => Promise<boolean>;
	// Optional callback called before sending a message
	@property({ attribute: false }) onBeforeSend?: () => void | Promise<void>;
	// Optional callback called before executing a tool call - return false to prevent execution
	@property({ attribute: false }) onBeforeToolCall?: (toolName: string, args: any) => boolean | Promise<boolean>;
	// Optional callback called when cost display is clicked
	@property({ attribute: false }) onCostClick?: () => void;
	// Optional callback called when "Compact Now" is clicked in context warning
	@property({ attribute: false }) onCompact?: () => void;
	// Maximum context tokens for the current model
	@property({ type: Number }) maxContextTokens = 128000;

	// References
	@query("message-editor") private _messageEditor!: MessageEditor;
	@query("streaming-message-container") private _streamingContainer!: StreamingMessageContainer;

	// Find bar state
	@state() private _findBarOpen = false;
	@state() private _findQuery = "";
	@state() private _findMatches: MessageMatch[] = [];
	@state() private _findCurrentIndex = 0;
	@state() private _findCaseSensitive = false;
	@state() private _findRegex = false;

	private _autoScroll = true;
	private _lastScrollTop = 0;
	private _lastClientHeight = 0;
	private _scrollContainer?: HTMLElement;
	private _resizeObserver?: ResizeObserver;
	private _unsubscribeSession?: () => void;

	public setInput(text: string, attachments?: Attachment[]) {
		const update = () => {
			if (!this._messageEditor) requestAnimationFrame(update);
			else {
				this._messageEditor.value = text;
				this._messageEditor.attachments = attachments || [];
			}
		};
		update();
	}

	public setAutoScroll(enabled: boolean) {
		this._autoScroll = enabled;
	}

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override willUpdate(changedProperties: Map<string, any>) {
		super.willUpdate(changedProperties);

		// Re-subscribe when session property changes
		if (changedProperties.has("session")) {
			this.setupSessionSubscription();
		}
	}

	override async connectedCallback() {
		super.connectedCallback();

		this.style.display = "flex";
		this.style.flexDirection = "column";
		this.style.height = "100%";
		this.style.minHeight = "0";

		// Add keyboard listener for Cmd/Ctrl+F
		document.addEventListener("keydown", this._handleGlobalKeydown);

		// Wait for first render to get scroll container
		await this.updateComplete;
		this._scrollContainer = this.querySelector(".overflow-y-auto") as HTMLElement;

		if (this._scrollContainer) {
			// Set up ResizeObserver to detect content changes
			this._resizeObserver = new ResizeObserver(() => {
				if (this._autoScroll && this._scrollContainer) {
					this._scrollContainer.scrollTop = this._scrollContainer.scrollHeight;
				}
			});

			// Observe the content container inside the scroll container
			const contentContainer = this._scrollContainer.querySelector(".max-w-3xl");
			if (contentContainer) {
				this._resizeObserver.observe(contentContainer);
			}

			// Set up scroll listener with better detection
			this._scrollContainer.addEventListener("scroll", this._handleScroll);
		}

		// Subscribe to external session if provided
		this.setupSessionSubscription();
	}

	override disconnectedCallback() {
		super.disconnectedCallback();

		// Remove keyboard listener
		document.removeEventListener("keydown", this._handleGlobalKeydown);

		// Clean up observers and listeners
		if (this._resizeObserver) {
			this._resizeObserver.disconnect();
			this._resizeObserver = undefined;
		}

		if (this._scrollContainer) {
			this._scrollContainer.removeEventListener("scroll", this._handleScroll);
		}

		if (this._unsubscribeSession) {
			this._unsubscribeSession();
			this._unsubscribeSession = undefined;
		}
	}

	private setupSessionSubscription() {
		if (this._unsubscribeSession) {
			this._unsubscribeSession();
			this._unsubscribeSession = undefined;
		}
		if (!this.session) return;

		// Set default streamFn with proxy support if not already set
		if (this.session.streamFn === streamSimple) {
			this.session.streamFn = createStreamFn(async () => {
				const enabled = await getAppStorage().settings.get<boolean>("proxy.enabled");
				return enabled ? (await getAppStorage().settings.get<string>("proxy.url")) || undefined : undefined;
			});
		}

		// Set default getApiKey if not already set
		if (!this.session.getApiKey) {
			this.session.getApiKey = async (provider: string) => {
				const key = await getAppStorage().providerKeys.get(provider);
				return key ?? undefined;
			};
		}

		this._unsubscribeSession = this.session.subscribe(async (ev: AgentEvent) => {
			switch (ev.type) {
				case "message_start":
				case "message_end":
				case "turn_start":
				case "turn_end":
				case "agent_start":
					this.requestUpdate();
					break;
				case "agent_end":
					// Clear streaming container when agent finishes
					if (this._streamingContainer) {
						this._streamingContainer.isStreaming = false;
						this._streamingContainer.setMessage(null, true);
					}
					this.requestUpdate();
					break;
				case "message_update":
					if (this._streamingContainer) {
						const isStreaming = this.session?.state.isStreaming || false;
						this._streamingContainer.isStreaming = isStreaming;
						this._streamingContainer.setMessage(ev.message, !isStreaming);
					}
					this.requestUpdate();
					break;
			}
		});
	}

	private _handleScroll = (_ev: any) => {
		if (!this._scrollContainer) return;

		const currentScrollTop = this._scrollContainer.scrollTop;
		const scrollHeight = this._scrollContainer.scrollHeight;
		const clientHeight = this._scrollContainer.clientHeight;
		const distanceFromBottom = scrollHeight - currentScrollTop - clientHeight;

		// Ignore relayout due to message editor getting pushed up by stats
		if (clientHeight < this._lastClientHeight) {
			this._lastClientHeight = clientHeight;
			return;
		}

		// Only disable auto-scroll if user scrolled UP or is far from bottom
		if (currentScrollTop !== 0 && currentScrollTop < this._lastScrollTop && distanceFromBottom > 50) {
			this._autoScroll = false;
		} else if (distanceFromBottom < 10) {
			// Re-enable if very close to bottom
			this._autoScroll = true;
		}

		this._lastScrollTop = currentScrollTop;
		this._lastClientHeight = clientHeight;
	};

	// Find bar methods
	private _handleGlobalKeydown = (e: KeyboardEvent) => {
		// Cmd/Ctrl+F to open find bar
		if ((e.metaKey || e.ctrlKey) && e.key === "f") {
			e.preventDefault();
			this._openFindBar();
		}
		// F3 for next match (when find bar is open)
		if (this._findBarOpen && e.key === "F3") {
			e.preventDefault();
			if (e.shiftKey) {
				this._findPrevious();
			} else {
				this._findNext();
			}
		}
		// Cmd/Ctrl+Shift+C to copy last assistant response
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "C") {
			e.preventDefault();
			this._copyLastAssistantResponse();
		}
		// Cmd/Ctrl+ArrowDown or Cmd/Ctrl+End to scroll to bottom
		if (this._scrollContainer && (e.metaKey || e.ctrlKey) && (e.key === "ArrowDown" || e.key === "End")) {
			e.preventDefault();
			this._scrollContainer.scrollTo({ top: this._scrollContainer.scrollHeight, behavior: "smooth" });
		}
		// Cmd/Ctrl+ArrowUp or Cmd/Ctrl+Home to scroll to top
		if (this._scrollContainer && (e.metaKey || e.ctrlKey) && (e.key === "ArrowUp" || e.key === "Home")) {
			e.preventDefault();
			this._scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
		}
	};

	private _openFindBar() {
		this._findBarOpen = true;
	}

	private _closeFindBar = () => {
		this._findBarOpen = false;
		this._findQuery = "";
		this._findMatches = [];
		this._findCurrentIndex = 0;
	};

	private _handleFindQueryChange = (query: string) => {
		this._findQuery = query;
		this._performSearch();
	};

	private _handleFindOptionsChange = (options: Partial<FindBarOptions>) => {
		if (options.caseSensitive !== undefined) {
			this._findCaseSensitive = options.caseSensitive;
		}
		if (options.regex !== undefined) {
			this._findRegex = options.regex;
		}
		this._performSearch();
	};

	private _performSearch() {
		if (!this._findQuery || !this.session) {
			this._findMatches = [];
			this._findCurrentIndex = 0;
			return;
		}

		const matches: MessageMatch[] = [];
		const messages = this.session.state.messages;

		for (let i = 0; i < messages.length; i++) {
			const message = messages[i];
			const text = this._extractMessageText(message);
			if (!text) continue;

			const positions = this._findMatchPositions(text);
			if (positions.length > 0) {
				matches.push({
					messageId: `message-${i}`,
					messageIndex: i,
					positions,
				});
			}
		}

		this._findMatches = matches;
		// Reset to first match if we have matches
		this._findCurrentIndex = matches.length > 0 ? 1 : 0;
		// Scroll is handled by MessageList after highlighting is applied
	}

	private _extractMessageText(message: AgentMessage): string {
		if (message.role === "user") {
			return typeof message.content === "string" ? message.content : "";
		}
		if (message.role === "assistant") {
			const parts = message.content;
			return parts
				.filter((p) => p.type === "text")
				.map((p) => (p as { type: "text"; text: string }).text)
				.join(" ");
		}
		return "";
	}

	private async _copyLastAssistantResponse() {
		if (!this.session) return;

		const messages = this.session.state.messages;
		// Find the last assistant message
		const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");

		if (!lastAssistantMessage) return;

		// Extract plain text content from the message (ignore tool calls)
		const text = this._extractMessageText(lastAssistantMessage);
		if (!text) return;

		try {
			await navigator.clipboard.writeText(text);
			// Show toast confirmation
			const { showToast } = await import("../utils/toast.js");
			showToast({ message: i18n("Copied to clipboard") });
		} catch (error) {
			console.error("Failed to copy to clipboard:", error);
		}
	}

	private _findMatchPositions(text: string): Array<{ start: number; end: number }> {
		const positions: Array<{ start: number; end: number }> = [];

		if (this._findRegex) {
			try {
				const flags = this._findCaseSensitive ? "g" : "gi";
				const regex = new RegExp(this._findQuery, flags);
				let match = regex.exec(text);
				while (match !== null) {
					positions.push({ start: match.index, end: match.index + match[0].length });
					// Prevent infinite loop for zero-length matches
					if (match[0].length === 0) regex.lastIndex++;
					match = regex.exec(text);
				}
			} catch {
				// Invalid regex, return no matches
				return [];
			}
		} else {
			const searchText = this._findCaseSensitive ? text : text.toLowerCase();
			const searchQuery = this._findCaseSensitive ? this._findQuery : this._findQuery.toLowerCase();
			let index = 0;
			while (true) {
				const pos = searchText.indexOf(searchQuery, index);
				if (pos === -1) break;
				positions.push({ start: pos, end: pos + searchQuery.length });
				index = pos + 1;
			}
		}

		return positions;
	}

	private _findNext = () => {
		if (this._findMatches.length === 0) return;
		const nextIndex = this._findCurrentIndex % this._findMatches.length;
		this._findCurrentIndex = nextIndex + 1;
		// Scroll is handled by MessageList after highlighting is applied
	};

	private _findPrevious = () => {
		if (this._findMatches.length === 0) return;
		const prevIndex = (this._findCurrentIndex - 2 + this._findMatches.length) % this._findMatches.length;
		this._findCurrentIndex = prevIndex + 1;
		// Scroll is handled by MessageList after highlighting is applied
	};

	public async sendMessage(input: string, attachments?: Attachment[]) {
		if ((!input.trim() && attachments?.length === 0) || this.session?.state.isStreaming) return;
		const session = this.session;
		if (!session) throw new Error("No session set on AgentInterface");
		if (!session.state.model) throw new Error("No model set on AgentInterface");

		// Check if API key exists for the provider (only needed in direct mode)
		const provider = session.state.model.provider;
		const apiKey = await getAppStorage().providerKeys.get(provider);

		// If no API key, prompt for it
		if (!apiKey) {
			if (!this.onApiKeyRequired) {
				console.error("No API key configured and no onApiKeyRequired handler set");
				return;
			}

			const success = await this.onApiKeyRequired(provider);

			// If still no API key, abort the send
			if (!success) {
				return;
			}
		}

		// Call onBeforeSend hook before sending
		if (this.onBeforeSend) {
			await this.onBeforeSend();
		}

		// Only clear editor after we know we can send
		this._messageEditor.value = "";
		this._messageEditor.attachments = [];
		this._autoScroll = true; // Enable auto-scroll when sending a message

		// Compose message with attachments if any
		if (attachments && attachments.length > 0) {
			const message: UserMessageWithAttachments = {
				role: "user-with-attachments",
				content: input,
				attachments,
				timestamp: Date.now(),
			};
			await this.session?.prompt(message);
		} else {
			await this.session?.prompt(input);
		}
	}

	private handleSuggestedPrompt = (prompt: string) => {
		this.setInput(prompt);
		// Focus the message editor
		if (this._messageEditor) {
			this._messageEditor.focus();
		}
	};

	private renderMessages() {
		if (!this.session)
			return html`<div class="p-4 text-center text-muted-foreground">${i18n("No session available")}</div>`;
		const state = this.session.state;
		// Build a map of tool results to allow inline rendering in assistant messages
		const toolResultsById = new Map<string, ToolResultMessage<any>>();
		for (const message of state.messages) {
			if (message.role === "toolResult") {
				toolResultsById.set(message.toolCallId, message);
			}
		}
		return html`
			<div class="flex flex-col gap-3">
				<!-- Stable messages list - won't re-render during streaming -->
				<message-list
					.messages=${this.session.state.messages}
					.tools=${state.tools}
					.pendingToolCalls=${this.session ? this.session.state.pendingToolCalls : new Set<string>()}
					.isStreaming=${state.isStreaming}
					.onCostClick=${this.onCostClick}
					.onSuggestedPrompt=${this.handleSuggestedPrompt}
					.searchQuery=${this._findQuery}
					.searchOptions=${{ caseSensitive: this._findCaseSensitive, regex: this._findRegex }}
					.searchMatches=${this._findMatches}
					.currentMatchIndex=${this._findCurrentIndex}
				></message-list>

				<!-- Streaming message container - manages its own updates -->
				<streaming-message-container
					class="${state.isStreaming ? "" : "hidden"}"
					.tools=${state.tools}
					.isStreaming=${state.isStreaming}
					.pendingToolCalls=${state.pendingToolCalls}
					.toolResultsById=${toolResultsById}
					.onCostClick=${this.onCostClick}
				></streaming-message-container>
			</div>
		`;
	}

	private _getTotalTokens(): number {
		if (!this.session) return 0;

		const state = this.session.state;
		return state.messages
			.filter((m) => m.role === "assistant")
			.reduce((total: number, msg: any) => {
				const usage = msg.usage;
				if (usage) {
					return total + usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
				}
				return total;
			}, 0);
	}

	private renderStats() {
		if (!this.session) return html`<div class="text-xs h-5"></div>`;

		const state = this.session.state;
		const totals = state.messages
			.filter((m) => m.role === "assistant")
			.reduce(
				(acc, msg: any) => {
					const usage = msg.usage;
					if (usage) {
						acc.input += usage.input;
						acc.output += usage.output;
						acc.cacheRead += usage.cacheRead;
						acc.cacheWrite += usage.cacheWrite;
						acc.cost.total += usage.cost.total;
					}
					return acc;
				},
				{
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				} satisfies Usage,
			);

		const hasTotals = totals.input || totals.output || totals.cacheRead || totals.cacheWrite;
		const totalsText = hasTotals ? formatUsage(totals) : "";

		return html`
			<div class="text-xs text-muted-foreground flex justify-between items-center h-5">
				<div class="flex items-center gap-1">
					${this.showThemeToggle ? html`<theme-toggle></theme-toggle>` : html``}
				</div>
				<div class="flex ml-auto items-center gap-3">
					${
						totalsText
							? this.onCostClick
								? html`<span class="cursor-pointer hover:text-foreground transition-colors" @click=${this.onCostClick}>${totalsText}</span>`
								: html`<span>${totalsText}</span>`
							: ""
					}
				</div>
			</div>
		`;
	}

	override render() {
		if (!this.session)
			return html`<div class="p-4 text-center text-muted-foreground">${i18n("No session set")}</div>`;

		const session = this.session;
		const state = this.session.state;
		const totalTokens = this._getTotalTokens();

		return html`
			<div class="flex flex-col h-full bg-background text-foreground">
				<!-- Find Bar -->
				<find-bar
					.isOpen=${this._findBarOpen}
					.query=${this._findQuery}
					.currentMatch=${this._findCurrentIndex}
					.totalMatches=${this._findMatches.length}
					.caseSensitive=${this._findCaseSensitive}
					.regex=${this._findRegex}
					.onQueryChange=${this._handleFindQueryChange}
					.onNext=${this._findNext}
					.onPrevious=${this._findPrevious}
					.onClose=${this._closeFindBar}
					.onOptionsChange=${this._handleFindOptionsChange}
				></find-bar>

				<!-- Context Warning Banner -->
				<context-warning
					.currentTokens=${totalTokens}
					.maxTokens=${this.maxContextTokens}
					.onCompact=${this.onCompact}
				></context-warning>

				<!-- Messages Area -->
				<div class="flex-1 overflow-y-auto">
					<div class="max-w-3xl mx-auto p-4 pb-0">${this.renderMessages()}</div>
				</div>

				<!-- Input Area -->
				<div class="shrink-0">
					<div class="max-w-3xl mx-auto px-2">
						<message-editor
							.isStreaming=${state.isStreaming}
							.currentModel=${state.model}
							.thinkingLevel=${state.thinkingLevel}
							.showAttachmentButton=${this.enableAttachments}
							.showModelSelector=${this.enableModelSelector}
							.showThinkingSelector=${this.enableThinkingSelector}
							.onSend=${(input: string, attachments: Attachment[]) => {
								this.sendMessage(input, attachments);
							}}
							.onAbort=${() => session.abort()}
							.onModelSelect=${() => {
								ModelSelector.open(state.model, (model) => session.setModel(model));
							}}
							.onThinkingChange=${
								this.enableThinkingSelector
									? (level: "off" | "minimal" | "low" | "medium" | "high") => {
											session.setThinkingLevel(level);
										}
									: undefined
							}
						></message-editor>
						${this.renderStats()}
					</div>
				</div>
			</div>
		`;
	}
}

// Register custom element with guard
if (!customElements.get("agent-interface")) {
	customElements.define("agent-interface", AgentInterface);
}
