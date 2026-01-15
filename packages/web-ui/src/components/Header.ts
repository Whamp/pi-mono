import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { i18n } from "../utils/i18n.js";

/**
 * Abbreviate thinking level for display
 */
function abbreviateThinkingLevel(level: string): string {
	const abbreviations: Record<string, string> = {
		off: "",
		minimal: "min",
		low: "L",
		medium: "M",
		high: "H",
		xhigh: "XH",
	};
	return abbreviations[level] ?? level;
}

/**
 * Abbreviate model name for display (extract last part)
 */
function abbreviateModelName(name: string): string {
	// Common patterns: "claude-sonnet-4", "gpt-4o", "gemini-1.5-pro"
	// Just return as-is for now, could truncate if needed
	return name;
}

@customElement("pi-header")
export class Header extends LitElement {
	@property({ type: String }) title = "New Chat";
	@property({ type: Boolean }) showMenuButton = false;
	@property({ type: String }) modelName?: string;
	@property({ type: String }) thinkingLevel?: string;
	@property({ type: Boolean }) isStreaming = false;
	@property({ attribute: false }) onMenuClick?: () => void;
	@property({ attribute: false }) onTitleEdit?: (newTitle: string) => void;
	@property({ attribute: false }) onModelClick?: () => void;
	@property({ attribute: false }) onSettingsClick?: () => void;
	@property({ attribute: false }) onNewChatClick?: () => void;

	@state() private isEditingTitle = false;
	@state() private editedTitle = "";

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	private handleMenuClick() {
		if (this.onMenuClick) {
			this.onMenuClick();
		}
	}

	private handleModelClick() {
		if (this.onModelClick) {
			this.onModelClick();
		}
	}

	private handleSettingsClick() {
		if (this.onSettingsClick) {
			this.onSettingsClick();
		}
	}

	private handleNewChatClick() {
		if (this.onNewChatClick) {
			this.onNewChatClick();
		}
	}

	private startEditingTitle() {
		if (this.isStreaming) return; // Don't allow editing while streaming
		this.editedTitle = this.title;
		this.isEditingTitle = true;
	}

	private saveTitle() {
		if (this.onTitleEdit && this.editedTitle.trim()) {
			this.onTitleEdit(this.editedTitle.trim());
		}
		this.isEditingTitle = false;
	}

	private cancelEditTitle() {
		this.isEditingTitle = false;
	}

	private handleTitleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			this.saveTitle();
		} else if (e.key === "Escape") {
			e.preventDefault();
			this.cancelEditTitle();
		}
	}

	private handleTitleBlur() {
		// Save on blur (like SessionItem does cancel, but save feels more natural)
		this.saveTitle();
	}

	private handleTitleInput(e: InputEvent) {
		const input = e.target as HTMLInputElement;
		this.editedTitle = input.value;
	}

	override updated(changedProperties: Map<string, unknown>) {
		if (changedProperties.has("isEditingTitle") && this.isEditingTitle) {
			const input = this.querySelector('input[type="text"]');
			if (input instanceof HTMLInputElement) {
				input.focus();
				input.select();
			}
		}
	}

	private renderMenuButton() {
		if (!this.showMenuButton) {
			return nothing;
		}

		return html`
			<button
				@click=${this.handleMenuClick}
				class="p-2 min-w-11 min-h-11 -ml-2 rounded-md hover:bg-accent lg:hidden flex items-center justify-center"
				aria-label="${i18n("Open menu")}"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
		`;
	}

	private renderTitle() {
		if (this.isStreaming) {
			return html`
				<div class="flex items-center gap-2">
					<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
					<span class="text-sm font-medium text-muted-foreground">${i18n("Responding...")}</span>
				</div>
			`;
		}

		if (this.isEditingTitle) {
			return html`
				<input
					type="text"
					.value=${this.editedTitle}
					@keydown=${this.handleTitleKeydown}
					@blur=${this.handleTitleBlur}
					@input=${this.handleTitleInput}
					class="w-full px-2 py-1 text-sm font-medium bg-transparent border border-primary rounded focus:outline-none focus:ring-1 focus:ring-ring"
				/>
			`;
		}

		return html`
			<button
				@click=${this.startEditingTitle}
				class="text-sm font-medium truncate text-left hover:text-primary transition-colors w-full"
				title="${i18n("Click to edit title")}"
			>
				${this.title}
			</button>
		`;
	}

	private renderModelBadge() {
		if (!this.modelName) {
			return nothing;
		}

		const displayName = abbreviateModelName(this.modelName);
		const thinkingAbbrev = this.thinkingLevel ? abbreviateThinkingLevel(this.thinkingLevel) : "";
		const displayText = thinkingAbbrev ? `${displayName} · ${thinkingAbbrev}` : displayName;

		return html`
			<button
				@click=${this.handleModelClick}
				class="px-3 min-h-11 text-xs rounded-md bg-muted hover:bg-accent truncate max-w-[200px] hidden sm:flex items-center justify-center"
				title="${this.modelName}${this.thinkingLevel ? ` · thinking: ${this.thinkingLevel}` : ""}"
			>
				${displayText}
			</button>
		`;
	}

	private renderNewChatButton() {
		return html`
			<button
				@click=${this.handleNewChatClick}
				class="p-2 min-w-11 min-h-11 rounded-md hover:bg-accent hidden sm:flex items-center justify-center"
				aria-label="${i18n("New Chat")}"
				title="${i18n("New Chat")}"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
			</button>
		`;
	}

	private renderSettingsButton() {
		return html`
			<button
				@click=${this.handleSettingsClick}
				class="p-2 min-w-11 min-h-11 rounded-md hover:bg-accent flex items-center justify-center"
				aria-label="${i18n("Settings")}"
				title="${i18n("Settings")}"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			</button>
		`;
	}

	override render() {
		return html`
			<header class="flex items-center h-14 px-4 border-b border-border bg-background gap-3" role="banner">
				${this.renderMenuButton()}

				<!-- Title area -->
				<div class="flex-1 min-w-0">
					${this.renderTitle()}
				</div>

				<!-- Actions -->
				<div class="flex items-center gap-2">
					${this.renderModelBadge()}
					${this.renderNewChatButton()}
					${this.renderSettingsButton()}
				</div>
			</header>
		`;
	}
}

// Register custom element with guard
if (!customElements.get("pi-header")) {
	customElements.define("pi-header", Header);
}
