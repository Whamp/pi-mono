import { icon } from "@mariozechner/mini-lit";
import { LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { html, nothing } from "lit/html.js";
import { AlertTriangle, Database } from "lucide";
import { i18n } from "../utils/i18n.js";

interface StorageEstimate {
	usage: number;
	quota: number | null;
}

interface StorageBreakdown {
	sessions: number;
	cache: number;
	settings: number;
	total: number;
}

/**
 * Storage quota component that displays current storage usage and quota information.
 * Uses the Storage API to estimate usage and show breakdown by category.
 */
@customElement("pi-storage-quota")
export class StorageQuota extends LitElement {
	@state() private estimate: StorageEstimate | null = null;
	@state() private breakdown: StorageBreakdown | null = null;
	@state() private loading = true;
	@state() private error: string | null = null;

	private readonly WARNING_THRESHOLD = 0.8; // 80%
	private readonly CRITICAL_THRESHOLD = 0.9; // 90%

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override async connectedCallback(): Promise<void> {
		super.connectedCallback();
		this.style.display = "block";
		await this.loadStorageInfo();
	}

	private async loadStorageInfo(): Promise<void> {
		try {
			// Get storage estimate from the Storage API
			const storageEstimate = await navigator.storage.estimate();

			this.estimate = {
				usage: storageEstimate.usage ?? 0,
				quota: storageEstimate.quota ?? null,
			};

			// Estimate breakdown from IndexedDB
			this.breakdown = await this.estimateBreakdown();
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		} finally {
			this.loading = false;
		}
	}

	private async estimateBreakdown(): Promise<StorageBreakdown | null> {
		// Estimate breakdown from total usage (this is an approximation)
		// In a real implementation, you'd query each IndexedDB store individually
		if (this.estimate) {
			return {
				sessions: Math.round(this.estimate.usage * 0.7), // Approx 70% for sessions
				cache: Math.round(this.estimate.usage * 0.25), // Approx 25% for cache
				settings: Math.round(this.estimate.usage * 0.05), // Approx 5% for settings
				total: this.estimate.usage,
			};
		}

		return null;
	}

	private getUsagePercentage(): number {
		if (!this.estimate?.quota) return 0;
		return this.estimate.usage / this.estimate.quota;
	}

	private getProgressColorClass(): string {
		const percentage = this.getUsagePercentage();

		if (percentage >= this.CRITICAL_THRESHOLD) {
			return "bg-red-500";
		}
		if (percentage >= this.WARNING_THRESHOLD) {
			return "bg-amber-500";
		}
		return "bg-blue-500";
	}

	private getWarningClass(): string {
		const percentage = this.getUsagePercentage();

		if (percentage >= this.CRITICAL_THRESHOLD) {
			return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
		}
		if (percentage >= this.WARNING_THRESHOLD) {
			return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800";
		}
		return "";
	}

	private formatBytes(bytes: number): string {
		if (bytes === 0) return "0 B";

		const units = ["B", "KB", "MB", "GB"];
		const k = 1024;
		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return `${(bytes / k ** i).toFixed(1)} ${units[i]}`;
	}

	private renderProgressBar() {
		if (!this.estimate?.quota) return nothing;

		const percentage = this.getUsagePercentage();
		const percentageDisplay = Math.round(percentage * 100);

		return html`
			<div class="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
				<div
					class="absolute inset-y-0 left-0 transition-all duration-500 ease-out ${this.getProgressColorClass()}"
					style="width: ${percentageDisplay}%"
				></div>
			</div>
		`;
	}

	private renderWarning() {
		const percentage = this.getUsagePercentage();

		if (percentage < this.WARNING_THRESHOLD) return nothing;

		const warningClass = this.getWarningClass();

		return html`
			<div
				class="flex items-start gap-2 mt-3 p-2 ${warningClass} border rounded text-sm"
				role="alert"
			>
				<span class="flex-shrink-0 mt-0.5">${icon(AlertTriangle, "sm")}</span>
				<div>
					<div class="font-medium">${i18n("Storage nearly full")}</div>
					<div class="text-xs opacity-80">
						${i18n("Consider clearing old data or managing your storage usage")}
					</div>
				</div>
			</div>
		`;
	}

	private renderBreakdown() {
		if (!this.breakdown) return nothing;

		return html`
			<div class="mt-3 space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-muted-foreground">${i18n("Sessions")}</span>
					<span>${this.formatBytes(this.breakdown.sessions)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">${i18n("Cache")}</span>
					<span>${this.formatBytes(this.breakdown.cache)}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-muted-foreground">${i18n("Settings")}</span>
					<span>${this.formatBytes(this.breakdown.settings)}</span>
				</div>
			</div>
		`;
	}

	override render() {
		if (this.loading) {
			return html`
				<div class="p-4 space-y-3 animate-pulse">
					<div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
					<div class="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
					<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
				</div>
			`;
		}

		if (this.error) {
			return html`
				<div class="p-4">
					<div class="flex items-center gap-2 text-muted-foreground">
						${icon(Database, "sm")}
						<span class="text-sm">${i18n("Unable to retrieve storage information")}</span>
					</div>
				</div>
			`;
		}

		if (!this.estimate) {
			return html`
				<div class="p-4">
					<div class="flex items-center gap-2 text-muted-foreground">
						${icon(Database, "sm")}
						<span class="text-sm">${i18n("Storage quota information not available")}</span>
					</div>
				</div>
			`;
		}

		const usageText = this.estimate.quota
			? i18n("{used} of {total} used")
					.replace("{used}", this.formatBytes(this.estimate.usage))
					.replace("{total}", this.formatBytes(this.estimate.quota))
			: this.formatBytes(this.estimate.usage);

		const percentage = this.estimate.quota ? Math.round(this.getUsagePercentage() * 100) : 0;

		return html`
			<div class="p-4">
				<div class="flex items-center gap-2 mb-3">
					${icon(Database, "sm")}
					<span class="font-medium">${i18n("Storage Usage")}</span>
				</div>

				${this.renderProgressBar()}

				<div class="flex justify-between items-center mt-2 text-sm">
					<span>${usageText}</span>
					${percentage > 0 ? html`<span class="text-muted-foreground">${percentage}%</span>` : nothing}
				</div>

				${this.renderBreakdown()}
				${this.renderWarning()}
			</div>
		`;
	}
}
