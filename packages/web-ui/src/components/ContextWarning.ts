import { icon } from "@mariozechner/mini-lit";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { html } from "lit/html.js";
import { AlertTriangle } from "lucide";
import { i18n } from "../utils/i18n.js";

@customElement("context-warning")
export class ContextWarning extends LitElement {
	@property({ type: Number }) currentTokens = 0;
	@property({ type: Number }) maxTokens = 128000;
	@property({ attribute: false }) onCompact?: () => void;

	private readonly THRESHOLD = 0.8;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.style.display = this._shouldShowWarning() ? "block" : "none";
	}

	override willUpdate(): void {
		this.style.display = this._shouldShowWarning() ? "block" : "none";
	}

	private _shouldShowWarning(): boolean {
		if (this.maxTokens <= 0) return false;
		const percentage = this.currentTokens / this.maxTokens;
		return percentage >= this.THRESHOLD;
	}

	private _getPercentage(): number {
		if (this.maxTokens <= 0) return 0;
		return Math.round((this.currentTokens / this.maxTokens) * 100);
	}

	private _handleCompact(event: Event) {
		event.preventDefault();
		if (this.onCompact) {
			this.onCompact();
		}
	}

	override render() {
		const percentage = this._getPercentage();

		return html`
			<div
				class="px-4 py-3 border-b bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
				role="alert"
				aria-live="polite"
				aria-atomic="true"
			>
				<div class="flex items-center gap-3">
					<span class="text-amber-600 dark:text-amber-400 flex-shrink-0">
						${icon(AlertTriangle, "sm")}
					</span>
					<span class="text-amber-900 dark:text-amber-100 text-sm font-medium flex-grow">
						${i18n("Context is {percentage}% full").replace("{percentage}", String(percentage))}
					</span>
					${
						this.onCompact
							? html`<button
								@click=${this._handleCompact}
								class="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 text-sm font-medium rounded flex-shrink-0"
						  >
								${i18n("Compact Now")}
						  </button>`
							: ""
					}
				</div>
			</div>
		`;
	}
}
