import { DialogContent, DialogHeader } from "@mariozechner/mini-lit/dist/Dialog.js";
import { DialogBase } from "@mariozechner/mini-lit/dist/DialogBase.js";
import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { SessionMetadata } from "../storage/types.js";
import { formatCost, formatTokenCount } from "../utils/format.js";
import { i18n } from "../utils/i18n.js";

export interface SessionInfoDialogProps {
	session: SessionMetadata;
	/** Timestamp of the first message (optional, for duration calculation) */
	firstMessageTime?: string;
	/** User message count (optional) */
	userMessageCount?: number;
	/** Assistant message count (optional) */
	assistantMessageCount?: number;
}

@customElement("session-info-dialog")
export class SessionInfoDialog extends DialogBase {
	@property({ attribute: false }) session?: SessionMetadata;
	@property({ attribute: false }) firstMessageTime?: string;
	@property({ type: Number }) userMessageCount?: number;
	@property({ type: Number }) assistantMessageCount?: number;

	protected modalWidth = "min(450px, 90vw)";
	protected modalHeight = "auto";

	static async open(props: SessionInfoDialogProps) {
		const dialog = new SessionInfoDialog();
		dialog.session = props.session;
		dialog.firstMessageTime = props.firstMessageTime;
		dialog.userMessageCount = props.userMessageCount;
		dialog.assistantMessageCount = props.assistantMessageCount;
		dialog.open();
	}

	private formatDateTime(isoString: string): string {
		try {
			const date = new Date(isoString);
			return date.toLocaleString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
			});
		} catch {
			return i18n("N/A");
		}
	}

	private formatDuration(startIso?: string, endIso?: string): string {
		if (!startIso || !endIso) return i18n("N/A");

		try {
			const start = new Date(startIso).getTime();
			const end = new Date(endIso).getTime();
			const diffMs = end - start;

			if (diffMs < 0) return i18n("N/A");

			const minutes = Math.floor(diffMs / 60000);
			const hours = Math.floor(minutes / 60);
			const days = Math.floor(hours / 24);

			if (days > 0) {
				const remainingHours = hours % 24;
				return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
			}
			if (hours > 0) {
				const remainingMinutes = minutes % 60;
				return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
			}
			if (minutes > 0) {
				return `${minutes}m`;
			}
			return `<1m`;
		} catch {
			return i18n("N/A");
		}
	}

	private formatNumber(value: number | undefined): string {
		if (value === undefined || value === null) return i18n("N/A");
		return value.toLocaleString();
	}

	private renderInfoRow(label: string, value: string) {
		return html`
			<div class="flex justify-between py-1.5">
				<span class="text-muted-foreground">${label}</span>
				<span class="text-foreground font-medium">${value}</span>
			</div>
		`;
	}

	private renderSection(title: string, content: unknown) {
		return html`
			<div class="mt-4">
				<div class="text-sm font-semibold text-foreground mb-2">${title}</div>
				<div class="text-sm">${content}</div>
			</div>
		`;
	}

	protected override renderContent() {
		const session = this.session;
		if (!session) {
			return html`<div class="p-4 text-muted-foreground">${i18n("No session available")}</div>`;
		}

		const usage = session.usage;
		const totalMessages = session.messageCount;
		const userMessages = this.userMessageCount;
		const assistantMessages = this.assistantMessageCount;

		return html`
			${DialogContent({
				className: "flex flex-col",
				children: html`
					${DialogHeader({
						title: i18n("Session Info"),
					})}

					<div class="mt-4 text-sm">
						<!-- Title -->
						${this.renderInfoRow(i18n("Title"), session.title || i18n("N/A"))}

						<!-- Dates -->
						${this.renderInfoRow(i18n("Created"), this.formatDateTime(session.createdAt))}
						${this.renderInfoRow(i18n("Modified"), this.formatDateTime(session.lastModified))}
						${this.renderInfoRow(i18n("Duration"), this.formatDuration(this.firstMessageTime || session.createdAt, session.lastModified))}
					</div>

					<!-- Messages Section -->
					${this.renderSection(
						i18n("Messages"),
						html`
							${userMessages !== undefined ? this.renderInfoRow(i18n("User"), this.formatNumber(userMessages)) : null}
							${assistantMessages !== undefined ? this.renderInfoRow(i18n("Assistant"), this.formatNumber(assistantMessages)) : null}
							${this.renderInfoRow(i18n("Total"), this.formatNumber(totalMessages))}
						`,
					)}

					<!-- Token Usage Section -->
					${this.renderSection(
						i18n("Token Usage"),
						html`
							${this.renderInfoRow(i18n("Input"), usage?.input ? formatTokenCount(usage.input) : i18n("N/A"))}
							${this.renderInfoRow(i18n("Output"), usage?.output ? formatTokenCount(usage.output) : i18n("N/A"))}
							${this.renderInfoRow(i18n("Total"), usage?.totalTokens ? formatTokenCount(usage.totalTokens) : i18n("N/A"))}
						`,
					)}

					<!-- Cost Section -->
					<div class="mt-4 text-sm">
						${this.renderInfoRow(i18n("Estimated Cost"), usage?.cost?.total !== undefined ? formatCost(usage.cost.total) : i18n("N/A"))}
					</div>

					<!-- Close Button -->
					<div class="flex justify-end mt-6">
						<button
							@click=${() => this.close()}
							class="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
						>
							${i18n("Close")}
						</button>
					</div>
				`,
			})}
		`;
	}
}
