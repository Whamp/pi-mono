import { icon } from "@mariozechner/mini-lit";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Wifi, WifiOff } from "lucide";
import { i18n } from "../utils/i18n.js";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

@customElement("pi-connection-status")
export class ConnectionStatus extends LitElement {
	@property({ type: String }) mode: "browser" | "remote" = "browser";
	@property({ type: String }) connectionState: ConnectionState = "disconnected";
	@property({ type: Number }) reconnectAttempt?: number;

	@state() private isOnline = navigator.onLine;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback() {
		super.connectedCallback();
		window.addEventListener("online", this.handleOnline);
		window.addEventListener("offline", this.handleOffline);
	}

	override disconnectedCallback() {
		super.disconnectedCallback();
		window.removeEventListener("online", this.handleOnline);
		window.removeEventListener("offline", this.handleOffline);
	}

	private handleOnline = () => {
		this.isOnline = true;
	};

	private handleOffline = () => {
		this.isOnline = false;
	};

	private renderOnlineIcon() {
		return html`
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
				/>
			</svg>
		`;
	}

	private renderOfflineIcon() {
		return html`
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0112 5a16 16 0 011.29.05M15.54 8.46A5.5 5.5 0 0121 12.55M3 12.55a5.5 5.5 0 015.46-5.09"
				/>
			</svg>
		`;
	}

	private renderWifiIcon(colorClass: string, pulseClass = "") {
		return html`<span class="${colorClass} ${pulseClass}">${icon(Wifi, "sm")}</span>`;
	}

	private renderWifiOffIcon(colorClass: string) {
		return html`<span class="${colorClass}">${icon(WifiOff, "sm")}</span>`;
	}

	private getRemoteStateInfo() {
		switch (this.connectionState) {
			case "disconnected":
				return {
					colorClass: "text-red-500",
					pulseClass: "",
					icon: this.renderWifiOffIcon("text-red-500"),
					tooltip: i18n("Disconnected"),
				};
			case "connecting":
				return {
					colorClass: "text-yellow-500",
					pulseClass: "animate-pulse",
					icon: this.renderWifiIcon("text-yellow-500", "animate-pulse"),
					tooltip: i18n("Connecting..."),
				};
			case "connected":
				return {
					colorClass: "text-green-500",
					pulseClass: "",
					icon: this.renderWifiIcon("text-green-500"),
					tooltip: i18n("Connected"),
				};
			case "reconnecting":
				return {
					colorClass: "text-yellow-500",
					pulseClass: "animate-pulse",
					icon: this.renderWifiIcon("text-yellow-500", "animate-pulse"),
					tooltip:
						this.reconnectAttempt !== undefined
							? i18n("Reconnecting (attempt {n})...").replace("{n}", String(this.reconnectAttempt))
							: i18n("Reconnecting..."),
				};
		}
	}

	override render() {
		// Remote mode - use connectionState prop
		if (this.mode === "remote") {
			const stateInfo = this.getRemoteStateInfo();
			return html`
				<div
					class="p-2 min-w-11 min-h-11 rounded-md hover:bg-accent flex items-center justify-center ${stateInfo.colorClass}"
					title="${stateInfo.tooltip}"
					aria-label="${stateInfo.tooltip}"
				>
					${stateInfo.icon}
				</div>
			`;
		}

		// Browser mode - use navigator.onLine as before
		if (this.isOnline) {
			return html`
				<div
					class="p-2 min-w-11 min-h-11 rounded-md hover:bg-accent flex items-center justify-center text-green-500"
					title="${i18n("Connected")}"
					aria-label="${i18n("Connected")}"
				>
					${this.renderOnlineIcon()}
				</div>
			`;
		}

		return html`
			<div
				class="p-2 min-w-11 min-h-11 rounded-md hover:bg-accent flex items-center justify-center text-red-500"
				title="${i18n("Offline")}"
				aria-label="${i18n("Offline")}"
			>
				${this.renderOfflineIcon()}
			</div>
		`;
	}
}

// Register custom element with guard
if (!customElements.get("pi-connection-status")) {
	customElements.define("pi-connection-status", ConnectionStatus);
}
