import { icon } from "@mariozechner/mini-lit";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { html } from "lit/html.js";
import { AlertCircle, AlertTriangle, Info, X } from "lucide";
import { i18n } from "../utils/i18n.js";

export type BannerVariant = "info" | "warning" | "error";

export interface BannerOptions {
	id?: string;
	message: string;
	variant?: BannerVariant;
	actionLabel?: string;
	onAction?: () => void;
	onDismiss?: () => void;
}

@customElement("pi-banner")
export class Banner extends LitElement {
	@property({ type: String }) message = "";
	@property({ type: String }) variant: BannerVariant = "info";
	@property({ type: String }) actionLabel = "";
	@property({ attribute: false }) onAction?: () => void;
	@property({ attribute: false }) onDismiss?: () => void;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.style.display = "block";
	}

	private handleAction(event: Event) {
		event.preventDefault();
		if (this.onAction) {
			this.onAction();
		}
	}

	private handleDismiss() {
		if (this.onDismiss) {
			this.onDismiss();
		}
	}

	private getIcon() {
		switch (this.variant) {
			case "warning":
				return icon(AlertTriangle, "sm");
			case "error":
				return icon(AlertCircle, "sm");
			default:
				return icon(Info, "sm");
		}
	}

	private getVariantClasses() {
		switch (this.variant) {
			case "warning":
				return {
					background: "bg-amber-50 dark:bg-amber-950/30",
					icon: "text-amber-600 dark:text-amber-400",
					text: "text-amber-900 dark:text-amber-100",
					border: "border-amber-200 dark:border-amber-800",
					button: "bg-amber-600 hover:bg-amber-700 text-white",
				};
			case "error":
				return {
					background: "bg-red-50 dark:bg-red-950/30",
					icon: "text-red-600 dark:text-red-400",
					text: "text-red-900 dark:text-red-100",
					border: "border-red-200 dark:border-red-800",
					button: "bg-red-600 hover:bg-red-700 text-white",
				};
			default:
				return {
					background: "bg-blue-50 dark:bg-blue-950/30",
					icon: "text-blue-600 dark:text-blue-400",
					text: "text-blue-900 dark:text-blue-100",
					border: "border-blue-200 dark:border-blue-800",
					button: "bg-blue-600 hover:bg-blue-700 text-white",
				};
		}
	}

	override render() {
		const classes = this.getVariantClasses();

		return html`
			<div
				class="px-4 py-3 border-b ${classes.background} ${classes.border}"
				role="alert"
				aria-live=${this.variant === "error" ? "assertive" : "polite"}
				aria-atomic="true"
			>
				<div class="flex items-center gap-3">
					<span class="${classes.icon} flex-shrink-0">${this.getIcon()}</span>
					<span class="${classes.text} text-sm font-medium flex-grow">${this.message}</span>
					${
						this.actionLabel && this.onAction
							? html`<button
								@click=${this.handleAction}
								class="${classes.button} px-3 py-1 text-sm font-medium rounded flex-shrink-0"
						  >
								${this.actionLabel}
						  </button>`
							: ""
					}
					<button
						@click=${this.handleDismiss}
						class="${classes.text} p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded flex-shrink-0"
						aria-label="${i18n("Dismiss")}"
					>
						${icon(X, "sm")}
					</button>
				</div>
			</div>
		`;
	}
}
