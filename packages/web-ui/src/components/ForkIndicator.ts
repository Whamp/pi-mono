import { LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { html } from "lit/html.js";
import { i18n } from "../utils/i18n.js";

export interface ForkBranch {
	id: string;
	name: string;
	preview: string;
	forkPoint: number;
}

/**
 * Custom event type for branch switching
 */
export class SwitchBranchEvent extends CustomEvent<{ branchId: string }> {
	constructor(branchId: string) {
		super("switch-branch", { detail: { branchId }, bubbles: true, composed: true });
	}
}

@customElement("fork-indicator")
export class ForkIndicator extends LitElement {
	@property({ type: Boolean }) hasForks = false;
	@property({ type: Array }) branches: ForkBranch[] = [];
	@property({ type: String }) currentBranchId = "";

	@state() private isDropdownOpen = false;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	private boundHandleClickOutside = this.handleClickOutside.bind(this);

	override connectedCallback(): void {
		super.connectedCallback();
		document.addEventListener("click", this.boundHandleClickOutside);
		this.classList.add("inline-flex", "items-center", "relative");
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("click", this.boundHandleClickOutside);
	}

	private handleClickOutside(e: Event): void {
		if (!this.isDropdownOpen) return;

		const target = e.target as HTMLElement;
		if (!target.closest("fork-indicator")) {
			this.isDropdownOpen = false;
		}
	}

	private toggleDropdown(): void {
		this.isDropdownOpen = !this.isDropdownOpen;
		if (this.isDropdownOpen) {
			// Add click outside listener on next tick to avoid immediate close
			setTimeout(() => {
				document.addEventListener("click", this.boundHandleClickOutside);
			}, 0);
		} else {
			document.removeEventListener("click", this.boundHandleClickOutside);
		}
	}

	private handleBranchClick(branchId: string): void {
		this.isDropdownOpen = false;
		this.dispatchEvent(new SwitchBranchEvent(branchId));
	}

	private renderDropdown() {
		if (!this.isDropdownOpen) {
			return html``;
		}

		return html`
			<div
				class="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[200px] max-w-[300px]"
				role="menu"
				aria-label="${i18n("Fork branches")}"
			>
				${
					this.branches.length === 0
						? html`
							<div class="px-3 py-2 text-sm text-muted-foreground">
								${i18n("No branches yet")}
							</div>
						`
						: html`
							${this.branches.map(
								(branch) => html`
									<button
										@click=${() => this.handleBranchClick(branch.id)}
										class="w-full px-3 py-2 text-sm text-left hover:bg-accent flex flex-col gap-1 ${
											branch.id === this.currentBranchId ? "bg-accent/50 text-primary" : "text-foreground"
										}"
										role="menuitem"
										aria-current=${branch.id === this.currentBranchId ? "true" : "false"}
									>
										<div class="flex items-center justify-between gap-2">
											<span class="font-medium truncate flex-1">${branch.name}</span>
											${
												branch.id === this.currentBranchId
													? html`
														<span
															class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium"
														>
															${i18n("current")}
														</span>
													`
													: ""
											}
										</div>
										<div class="text-xs text-muted-foreground truncate">
											${branch.preview}
										</div>
										<div class="text-[10px] text-muted-foreground">
											${i18n("Fork at message {number}").replace("{number}", String(branch.forkPoint + 1))}
										</div>
									</button>
								`,
							)}
						`
				}
			</div>
		`;
	}

	// GitBranch icon SVG path (from lucide)
	private gitBranchIcon() {
		return html`
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="text-muted-foreground hover:text-foreground transition-colors"
			>
				<line x1="6" y1="3" x2="6" y2="15" />
				<circle cx="18" cy="6" r="3" />
				<circle cx="6" cy="18" r="3" />
				<path d="M18 9a9 9 0 0 1-9 9" />
			</svg>
		`;
	}

	override render() {
		if (!this.hasForks) {
			return html``;
		}

		return html`
			<div class="relative">
				<button
					@click=${() => this.toggleDropdown()}
					class="p-1.5 min-w-[28px] min-h-[28px] rounded-md hover:bg-accent flex items-center justify-center transition-colors"
					aria-label="${i18n("View fork branches")}"
					aria-expanded="${this.isDropdownOpen}"
					aria-haspopup="true"
				>
					${this.gitBranchIcon()}
				</button>
				${this.renderDropdown()}
			</div>
		`;
	}
}

// Register custom element with guard
if (!customElements.get("fork-indicator")) {
	customElements.define("fork-indicator", ForkIndicator);
}
