import { icon } from "@mariozechner/mini-lit";
import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WifiOff } from "lucide";
import { offlineQueue, type QueuedMessage } from "../offline/offline-queue.js";
import { i18n } from "../utils/i18n.js";

@customElement("offline-indicator")
export class OfflineIndicator extends LitElement {
	@state() private isOnline = navigator.onLine;
	@state() private pendingMessages: QueuedMessage[] = [];
	private unsubscribe?: () => void;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.style.display = "block";

		// Listen for online/offline events
		window.addEventListener("online", this.handleOnline);
		window.addEventListener("offline", this.handleOffline);

		// Subscribe to offline queue for pending message count
		this.unsubscribe = offlineQueue.subscribe((messages) => {
			this.pendingMessages = messages;
		});

		// Initialize pending messages
		offlineQueue.getAll().then((messages) => {
			this.pendingMessages = messages;
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener("online", this.handleOnline);
		window.removeEventListener("offline", this.handleOffline);
		this.unsubscribe?.();
	}

	private handleOnline = () => {
		this.isOnline = true;
	};

	private handleOffline = () => {
		this.isOnline = false;
	};

	private getPendingCount(): number {
		return this.pendingMessages.filter((m) => m.status === "pending").length;
	}

	override render() {
		const pendingCount = this.getPendingCount();

		// Only show when offline
		if (this.isOnline) {
			return html``;
		}

		// Build message based on pending count
		let message: string;
		if (pendingCount === 0) {
			message = i18n("You're offline");
		} else if (pendingCount === 1) {
			message = i18n("You're offline. 1 message pending.");
		} else {
			message = i18n("You're offline. {count} messages pending.").replace("{count}", String(pendingCount));
		}

		return html`
			<div
				class="px-4 py-3 border-b bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-300"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				<span class="text-amber-600 dark:text-amber-400 flex-shrink-0">${icon(WifiOff, "sm")}</span>
				<span class="text-amber-900 dark:text-amber-100 text-sm font-medium">${message}</span>
			</div>
		`;
	}
}

// Register custom element with guard
if (!customElements.get("offline-indicator")) {
	customElements.define("offline-indicator", OfflineIndicator);
}
