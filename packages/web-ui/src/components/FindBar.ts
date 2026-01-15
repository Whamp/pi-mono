import { html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { i18n } from "../utils/i18n.js";

export interface FindBarOptions {
	caseSensitive: boolean;
	regex: boolean;
}

export interface FindBarProps {
	isOpen: boolean;
	query: string;
	currentMatch: number;
	totalMatches: number;
	options: FindBarOptions;
	onQueryChange: (query: string) => void;
	onNext: () => void;
	onPrevious: () => void;
	onClose: () => void;
	onOptionsChange: (options: Partial<FindBarOptions>) => void;
}

@customElement("find-bar")
export class FindBar extends LitElement {
	@property({ type: Boolean }) isOpen = false;
	@property({ type: String }) query = "";
	@property({ type: Number }) currentMatch = 0;
	@property({ type: Number }) totalMatches = 0;
	@property({ type: Boolean }) caseSensitive = false;
	@property({ type: Boolean }) regex = false;
	@property({ attribute: false }) onQueryChange?: (query: string) => void;
	@property({ attribute: false }) onNext?: () => void;
	@property({ attribute: false }) onPrevious?: () => void;
	@property({ attribute: false }) onClose?: () => void;
	@property({ attribute: false }) onOptionsChange?: (options: Partial<FindBarOptions>) => void;

	@query('input[type="search"]') private _searchInput!: HTMLInputElement;
	@state() private _regexError = "";

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override updated(changedProperties: Map<string, unknown>) {
		// Focus input when opened
		if (changedProperties.has("isOpen") && this.isOpen && this._searchInput) {
			// Use requestAnimationFrame to ensure DOM is ready
			requestAnimationFrame(() => {
				this._searchInput?.focus();
				this._searchInput?.select();
			});
		}
	}

	private handleInput(e: InputEvent) {
		const input = e.target as HTMLInputElement;
		this._regexError = "";

		// Validate regex if in regex mode
		if (this.regex && input.value) {
			try {
				new RegExp(input.value);
			} catch {
				this._regexError = i18n("Invalid regex");
			}
		}

		this.onQueryChange?.(input.value);
	}

	private handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			if (e.shiftKey) {
				this.onPrevious?.();
			} else {
				this.onNext?.();
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			this.onClose?.();
		} else if (e.key === "F3") {
			e.preventDefault();
			if (e.shiftKey) {
				this.onPrevious?.();
			} else {
				this.onNext?.();
			}
		}
	}

	private handleClose() {
		this.onClose?.();
	}

	private handlePrevious() {
		this.onPrevious?.();
	}

	private handleNext() {
		this.onNext?.();
	}

	private toggleCaseSensitive() {
		this.onOptionsChange?.({ caseSensitive: !this.caseSensitive });
	}

	private toggleRegex() {
		this.onOptionsChange?.({ regex: !this.regex });
		// Re-validate current query
		if (!this.regex && this.query) {
			// Switching TO regex mode
			try {
				new RegExp(this.query);
				this._regexError = "";
			} catch {
				this._regexError = i18n("Invalid regex");
			}
		} else {
			this._regexError = "";
		}
	}

	private renderMatchCounter() {
		if (!this.query) {
			return nothing;
		}

		const text = this.totalMatches === 0 ? i18n("No results") : `${this.currentMatch}/${this.totalMatches}`;

		return html`
			<span class="text-xs text-muted-foreground whitespace-nowrap min-w-[3.5rem] text-center">
				${text}
			</span>
		`;
	}

	override render() {
		if (!this.isOpen) {
			return nothing;
		}

		const hasMatches = this.totalMatches > 0;
		const navButtonClass = `p-1.5 rounded hover:bg-accent transition-colors ${
			hasMatches ? "" : "opacity-50 cursor-not-allowed"
		}`;

		const toggleActiveClass = "bg-primary text-primary-foreground";
		const toggleInactiveClass = "hover:bg-accent";

		return html`
			<div
				class="flex items-center gap-2 px-4 py-2 border-b border-border bg-background"
				role="search"
				aria-label="${i18n("Find in conversation")}"
			>
				<!-- Search icon -->
				<svg class="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>

				<!-- Search input -->
				<div class="relative flex-1 min-w-0">
					<input
						type="search"
						class="w-full h-8 px-2 text-sm bg-muted/50 border ${this._regexError ? "border-destructive" : "border-transparent"} rounded focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
						placeholder="${i18n("Find...")}"
						.value=${this.query}
						@input=${this.handleInput}
						@keydown=${this.handleKeyDown}
						aria-label="${i18n("Search query")}"
						aria-invalid=${this._regexError ? "true" : "false"}
					/>
					${this._regexError ? html`<span class="absolute -bottom-4 left-0 text-xs text-destructive">${this._regexError}</span>` : nothing}
				</div>

				<!-- Close button -->
				<button
					@click=${this.handleClose}
					class="p-1.5 rounded hover:bg-accent transition-colors"
					aria-label="${i18n("Close find bar")}"
					title="${i18n("Close")} (Escape)"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>

				<!-- Separator -->
				<div class="w-px h-4 bg-border"></div>

				<!-- Navigation -->
				<div class="flex items-center gap-1">
					<button
						@click=${this.handlePrevious}
						class="${navButtonClass}"
						?disabled=${!hasMatches}
						aria-label="${i18n("Previous match")}"
						title="${i18n("Previous match")} (Shift+Enter)"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
					</button>

					${this.renderMatchCounter()}

					<button
						@click=${this.handleNext}
						class="${navButtonClass}"
						?disabled=${!hasMatches}
						aria-label="${i18n("Next match")}"
						title="${i18n("Next match")} (Enter)"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				</div>

				<!-- Separator -->
				<div class="w-px h-4 bg-border"></div>

				<!-- Options -->
				<div class="flex items-center gap-1">
					<button
						@click=${this.toggleCaseSensitive}
						class="px-2 py-1 text-xs font-medium rounded transition-colors ${this.caseSensitive ? toggleActiveClass : toggleInactiveClass}"
						aria-pressed=${this.caseSensitive}
						aria-label="${i18n("Match case")}"
						title="${i18n("Match case")}"
					>
						Aa
					</button>

					<button
						@click=${this.toggleRegex}
						class="px-2 py-1 text-xs font-medium rounded transition-colors ${this.regex ? toggleActiveClass : toggleInactiveClass}"
						aria-pressed=${this.regex}
						aria-label="${i18n("Use regex")}"
						title="${i18n("Use regex")}"
					>
						.*
					</button>
				</div>
			</div>
		`;
	}
}

// Register custom element with guard
if (!customElements.get("find-bar")) {
	customElements.define("find-bar", FindBar);
}
