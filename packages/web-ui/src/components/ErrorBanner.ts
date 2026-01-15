import { icon } from "@mariozechner/mini-lit";
import { LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { html, nothing } from "lit/html.js";
import { AlertCircle, Clock, Database, Key, WifiOff, X } from "lucide";
import { i18n } from "../utils/i18n.js";

export type ErrorType = "rate-limit" | "network" | "context-overflow" | "auth" | "generic";

@customElement("pi-error-banner")
export class ErrorBanner extends LitElement {
	@property({ type: String }) type: ErrorType = "generic";
	@property({ type: String }) message = "";
	@property({ type: Number }) retryAfter?: number;
	@property({ attribute: false }) onRetry?: () => void;
	@property({ attribute: false }) onDismiss?: () => void;

	@state() private countdown = 0;
	private countdownInterval?: number;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.style.display = "block";
	}

	override willUpdate(changed: Map<string, unknown>) {
		if (changed.has("retryAfter") && this.retryAfter !== undefined && this.retryAfter > 0) {
			this.startCountdown(this.retryAfter);
		}
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.clearCountdown();
	}

	private startCountdown(seconds: number) {
		this.countdown = seconds;
		this.clearCountdown();
		this.countdownInterval = window.setInterval(() => {
			this.countdown--;
			if (this.countdown <= 0) {
				this.clearCountdown();
				this.onRetry?.();
			}
		}, 1000);
	}

	private clearCountdown() {
		if (this.countdownInterval !== undefined) {
			window.clearInterval(this.countdownInterval);
			this.countdownInterval = undefined;
		}
	}

	private handleRetry() {
		this.clearCountdown();
		this.onRetry?.();
	}

	private handleDismiss() {
		this.clearCountdown();
		this.onDismiss?.();
	}

	private getIcon() {
		switch (this.type) {
			case "rate-limit":
				return icon(Clock, "sm");
			case "network":
				return icon(WifiOff, "sm");
			case "context-overflow":
				return icon(Database, "sm");
			case "auth":
				return icon(Key, "sm");
			default:
				return icon(AlertCircle, "sm");
		}
	}

	private getColorClasses() {
		switch (this.type) {
			case "rate-limit":
				return {
					container: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800",
					icon: "text-amber-600 dark:text-amber-400",
					title: "text-amber-800 dark:text-amber-200",
					subtitle: "text-amber-600 dark:text-amber-400",
					button: "bg-amber-600 hover:bg-amber-700 text-white",
					dismissButton: "text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900",
				};
			case "context-overflow":
				return {
					container: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
					icon: "text-blue-600 dark:text-blue-400",
					title: "text-blue-800 dark:text-blue-200",
					subtitle: "text-blue-600 dark:text-blue-400",
					button: "bg-blue-600 hover:bg-blue-700 text-white",
					dismissButton: "text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900",
				};
			default:
				// network, auth, generic all use red
				return {
					container: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
					icon: "text-red-600 dark:text-red-400",
					title: "text-red-800 dark:text-red-200",
					subtitle: "text-red-600 dark:text-red-400",
					button: "bg-red-600 hover:bg-red-700 text-white",
					dismissButton: "text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900",
				};
		}
	}

	private getTitle() {
		switch (this.type) {
			case "rate-limit":
				return i18n("Rate limit reached");
			case "network":
				return i18n("Connection lost");
			case "context-overflow":
				return i18n("Context limit reached");
			case "auth":
				return i18n("Authentication failed");
			default:
				return i18n("Something went wrong");
		}
	}

	private getSubtitle() {
		switch (this.type) {
			case "rate-limit":
				return this.countdown > 0 ? `${i18n("Retrying in")} ${this.countdown}s...` : i18n("Ready to retry");
			case "network":
				return i18n("Unable to reach the server");
			case "context-overflow":
				return i18n("Compacting conversation to continue...");
			case "auth":
				return this.message || i18n("Please check your API key");
			default:
				return this.message || i18n("An unexpected error occurred");
		}
	}

	private renderAction() {
		const colors = this.getColorClasses();

		switch (this.type) {
			case "rate-limit":
				// Show countdown and optional cancel button
				if (this.countdown > 0 && this.onDismiss) {
					return html`
						<button
							@click=${() => this.handleDismiss()}
							class="px-3 py-1.5 text-sm ${colors.button} rounded-md transition-colors"
						>
							${i18n("Cancel")}
						</button>
					`;
				}
				return nothing;

			case "network":
				// Show retry button
				if (this.onRetry) {
					return html`
						<button
							@click=${() => this.handleRetry()}
							class="px-3 py-1.5 text-sm ${colors.button} rounded-md transition-colors"
						>
							${i18n("Retry")}
						</button>
					`;
				}
				return nothing;

			case "auth":
				// Show dismiss button
				if (this.onDismiss) {
					return html`
						<button
							@click=${() => this.handleDismiss()}
							class="p-1 ${colors.dismissButton} rounded transition-colors"
							aria-label="${i18n("Dismiss")}"
						>
							${icon(X, "sm")}
						</button>
					`;
				}
				return nothing;

			case "context-overflow":
				// No action needed - auto-compacting
				return nothing;

			default:
				// Generic - show dismiss button
				if (this.onDismiss) {
					return html`
						<button
							@click=${() => this.handleDismiss()}
							class="p-1 ${colors.dismissButton} rounded transition-colors"
							aria-label="${i18n("Dismiss")}"
						>
							${icon(X, "sm")}
						</button>
					`;
				}
				return nothing;
		}
	}

	override render() {
		const colors = this.getColorClasses();

		return html`
			<div
				class="flex items-center gap-3 p-4 ${colors.container} border rounded-lg"
				role="alert"
				aria-live=${this.type === "network" || this.type === "auth" ? "assertive" : "polite"}
			>
				<div class="${colors.icon} flex-shrink-0">
					${this.getIcon()}
				</div>
				<div class="flex-1 min-w-0">
					<div class="font-medium ${colors.title}">${this.getTitle()}</div>
					<div class="text-sm ${colors.subtitle}">${this.getSubtitle()}</div>
				</div>
				${this.renderAction()}
			</div>
		`;
	}
}
