import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { DialogContent, DialogHeader } from "@mariozechner/mini-lit/dist/Dialog.js";
import { DialogBase } from "@mariozechner/mini-lit/dist/DialogBase.js";
import { html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { i18n } from "../utils/i18n.js";

interface CompactionResult {
	beforeTokens: number;
	afterTokens: number;
}

@customElement("compaction-dialog")
export class CompactionDialog extends DialogBase {
	@state() private currentTokens = 0;
	@state() private maxTokens = 0;
	@state() private instructions = "";
	@state() private compacting = false;
	@state() private result: CompactionResult | null = null;

	private resolvePromise?: (result: CompactionResult | null) => void;

	protected modalWidth = "min(500px, 90vw)";
	protected modalHeight = "auto";

	/**
	 * Open the compaction dialog.
	 * @param currentTokens - Current token count
	 * @param maxTokens - Maximum token limit
	 * @returns Promise with compaction result or null if cancelled
	 */
	static async open(currentTokens: number, maxTokens: number): Promise<CompactionResult | null> {
		const dialog = new CompactionDialog();
		dialog.currentTokens = currentTokens;
		dialog.maxTokens = maxTokens;
		dialog.open();

		return new Promise((resolve) => {
			dialog.resolvePromise = resolve;
		});
	}

	private handleCancel() {
		if (this.resolvePromise) {
			this.resolvePromise(null);
			this.resolvePromise = undefined;
		}
		this.close();
	}

	async handleCompact() {
		this.compacting = true;

		try {
			// This would be called with the actual compaction function
			// For now, simulate with a delay
			// In real usage, you'd pass the compaction function or handle it externally
			await new Promise((resolve) => setTimeout(resolve, 1000));

			this.result = {
				beforeTokens: this.currentTokens,
				afterTokens: Math.floor(this.currentTokens * 0.4), // Simulated
			};

			if (this.resolvePromise) {
				this.resolvePromise(this.result);
				this.resolvePromise = undefined;
			}
		} catch (error) {
			console.error("Compaction failed:", error);
		} finally {
			this.compacting = false;
		}
	}

	private handleClose() {
		if (this.resolvePromise) {
			this.resolvePromise(this.result);
			this.resolvePromise = undefined;
		}
		this.close();
	}

	override close() {
		super.close();
		if (this.resolvePromise) {
			this.resolvePromise(null);
		}
	}

	protected override renderContent() {
		if (this.result) {
			return this.renderResult();
		}
		return this.renderForm();
	}

	private renderForm() {
		const percentFull = Math.round((this.currentTokens / this.maxTokens) * 100);

		return html`
			${DialogContent({
				children: html`
					${DialogHeader({
						title: i18n("Compact Conversation"),
					})}

					<div class="flex flex-col gap-4">
						<div class="text-sm">
							<div class="flex justify-between mb-2">
								<span class="text-muted-foreground">${i18n("Current tokens")}</span>
								<span class="font-medium">${this.formatNumber(this.currentTokens)}</span>
							</div>
							<div class="flex justify-between mb-2">
								<span class="text-muted-foreground">${i18n("Context limit")}</span>
								<span class="font-medium">${this.formatNumber(this.maxTokens)}</span>
							</div>
							<div class="mt-3">
								<div class="h-2 bg-secondary rounded-full overflow-hidden">
									<div
										class="h-full bg-primary transition-all duration-300"
										style="width: ${Math.min(percentFull, 100)}%"
									></div>
								</div>
								<div class="text-xs text-muted-foreground mt-1 text-right">
									${percentFull}%
								</div>
							</div>
						</div>

						<div class="flex flex-col gap-2">
							<label class="text-sm font-medium">${i18n("Instructions (optional)")}</label>
							<textarea
								class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
								placeholder="${i18n("Focus on the recent discussion about authentication...")}"
								.value="${this.instructions}"
								@input=${(e: Event) => {
									const target = e.target as HTMLTextAreaElement;
									this.instructions = target.value;
								}}
								?disabled=${this.compacting}
							></textarea>
						</div>
					</div>

					<div class="mt-6 flex gap-3 justify-end">
						${Button({
							variant: "outline",
							onClick: () => this.handleCancel(),
							disabled: this.compacting,
							children: i18n("Cancel"),
						})}
						${Button({
							variant: "default",
							onClick: () => this.handleCompact(),
							disabled: this.compacting,
							children: this.compacting ? i18n("Compacting") : i18n("Compact"),
						})}
					</div>
				`,
			})}
		`;
	}

	private renderResult() {
		const savedTokens = this.result!.beforeTokens - this.result!.afterTokens;
		const savedPercent = Math.round((savedTokens / this.result!.beforeTokens) * 100);

		return html`
			${DialogContent({
				children: html`
					${DialogHeader({
						title: i18n("Compact Conversation"),
					})}

					<div class="flex flex-col gap-4">
						<div class="flex items-center gap-3 p-4 bg-success/10 border border-success/20 rounded-lg">
							<div class="flex-shrink-0 text-success">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
									<polyline points="22 4 12 14.01 9 11.01"></polyline>
								</svg>
							</div>
							<span class="font-medium text-foreground">${i18n("Compaction complete!")}</span>
						</div>

						<div class="text-sm space-y-2">
							<div class="flex justify-between">
								<span class="text-muted-foreground">${i18n("Before")}</span>
								<span class="font-medium">${this.formatNumber(this.result!.beforeTokens)} tokens</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">${i18n("After")}</span>
								<span class="font-medium">${this.formatNumber(this.result!.afterTokens)} tokens</span>
							</div>
							<div class="flex justify-between pt-2 border-t">
								<span class="text-muted-foreground">${i18n("Saved")}</span>
								<span class="font-medium text-success">
									${this.formatNumber(savedTokens)} tokens (${savedPercent}%)
								</span>
							</div>
						</div>
					</div>

					<div class="mt-6 flex justify-end">
						${Button({
							variant: "default",
							onClick: () => this.handleClose(),
							children: i18n("Close"),
						})}
					</div>
				`,
			})}
		`;
	}

	private formatNumber(num: number): string {
		return new Intl.NumberFormat().format(num);
	}
}
