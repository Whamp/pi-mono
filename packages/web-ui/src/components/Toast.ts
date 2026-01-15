import { icon } from "@mariozechner/mini-lit";
import { LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { html } from "lit/html.js";
import { AlertCircle, CheckCircle, Info, X } from "lucide";
import { i18n } from "../utils/i18n.js";

export type ToastVariant = "success" | "error" | "info";

@customElement("pi-toast")
export class Toast extends LitElement {
	@property({ type: String }) message = "";
	@property({ type: String }) variant: ToastVariant = "info";
	@property({ type: Boolean }) visible = false;
	@property({ type: Number }) duration = 3000;
	@property({ attribute: false }) onClose?: () => void;

	private dismissTimeout?: number;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.style.display = "block";
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.clearDismissTimeout();
	}

	override updated(changed: Map<string, unknown>) {
		if (changed.has("visible") && this.visible) {
			this.scheduleDismiss();
		}
	}

	private clearDismissTimeout() {
		if (this.dismissTimeout !== undefined) {
			window.clearTimeout(this.dismissTimeout);
			this.dismissTimeout = undefined;
		}
	}

	private scheduleDismiss() {
		this.clearDismissTimeout();
		if (this.duration > 0) {
			this.dismissTimeout = window.setTimeout(() => {
				if (this.onClose) this.onClose();
			}, this.duration);
		}
	}

	private handleClose() {
		this.clearDismissTimeout();
		if (this.onClose) this.onClose();
	}

	private getIcon() {
		switch (this.variant) {
			case "success":
				return icon(CheckCircle, "sm");
			case "error":
				return icon(AlertCircle, "sm");
			default:
				return icon(Info, "sm");
		}
	}

	private getVariantClasses() {
		switch (this.variant) {
			case "success":
				return "bg-green-600 text-white";
			case "error":
				return "bg-red-600 text-white";
			default:
				return "bg-zinc-800 text-white";
		}
	}

	override render() {
		const variantClasses = this.getVariantClasses();
		const visibilityClasses = this.visible
			? "opacity-100 translate-y-0"
			: "opacity-0 translate-y-4 pointer-events-none";

		return html`
			<div
				class="px-4 py-3 rounded-lg shadow-lg ${variantClasses} transform transition-all duration-300 ${visibilityClasses}"
				role="status"
				aria-live=${this.variant === "error" ? "assertive" : "polite"}
				aria-atomic="true"
			>
				<div class="flex items-center gap-3">
					${this.getIcon()}
					<span class="text-sm font-medium">${this.message}</span>
					<button
						@click=${() => this.handleClose()}
						class="p-1 hover:bg-black/10 rounded ml-auto flex-shrink-0"
						aria-label="${i18n("Dismiss")}"
					>
						${icon(X, "sm")}
					</button>
				</div>
			</div>
		`;
	}
}
