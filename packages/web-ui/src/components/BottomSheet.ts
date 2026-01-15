import { LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { html } from "lit/html.js";

/**
 * BottomSheet - A mobile bottom sheet component that slides up from the bottom.
 *
 * Features:
 * - Slide-up animation from bottom
 * - Backdrop overlay that dismisses on tap
 * - Handle bar at top for visual cue
 * - Escape key to close
 * - Focus trap while open
 *
 * @example
 * ```ts
 * const sheet = document.createElement("pi-bottom-sheet") as BottomSheet;
 * sheet.open = true;
 * sheet.onClose = () => console.log("Closed");
 * document.body.appendChild(sheet);
 * ```
 */
@customElement("pi-bottom-sheet")
export class BottomSheet extends LitElement {
	@property({ type: Boolean }) open = false;
	@property({ attribute: false }) onClose?: () => void;

	private previousFocus?: HTMLElement | null;
	private boundHandleKeyDown?: (e: KeyboardEvent) => void;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.style.display = "block";
	}

	override updated(changedProperties: Map<string, unknown>) {
		super.updated(changedProperties);

		if (changedProperties.has("open")) {
			if (this.open) {
				this.handleOpen();
			} else {
				this.handleClose();
			}
		}
	}

	private handleOpen() {
		// Store the currently focused element
		this.previousFocus = document.activeElement as HTMLElement | null;
		document.body.appendChild(this);

		// Add keyboard event listener for Escape key
		this.boundHandleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				this.close();
			}
		};
		window.addEventListener("keydown", this.boundHandleKeyDown);

		// Focus the sheet for accessibility
		const dialogEl = this.querySelector("[role='dialog']") as HTMLElement | null;
		dialogEl?.focus();
	}

	private handleClose() {
		// Remove keyboard event listener
		if (this.boundHandleKeyDown) {
			window.removeEventListener("keydown", this.boundHandleKeyDown);
			this.boundHandleKeyDown = undefined;
		}

		// Remove from DOM
		this.remove();

		// Restore focus to the previously focused element
		if (this.previousFocus instanceof HTMLElement) {
			requestAnimationFrame(() => {
				this.previousFocus?.focus();
			});
		}
	}

	private handleBackdropClick(e: MouseEvent) {
		// Close if clicking on the backdrop (not the sheet content)
		if ((e.target as HTMLElement).classList.contains("bottom-sheet-backdrop")) {
			this.close();
		}
	}

	/**
	 * Programmatically close the bottom sheet
	 */
	public close() {
		this.open = false;
		if (this.onClose) {
			this.onClose();
		}
	}

	override render() {
		const visibilityClasses = this.open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none";

		const sheetTransformClasses = this.open ? "translate-y-0" : "translate-y-full";

		return html`
			<div
				class="bottom-sheet-backdrop fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${visibilityClasses}"
				@click=${this.handleBackdropClick}
				aria-hidden="true"
			></div>

			<div
				class="bottom-sheet fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-out ${sheetTransformClasses}"
				role="dialog"
				aria-modal="true"
				tabindex="-1"
			>
				<div class="mx-auto w-full max-w-lg bg-background rounded-t-2xl shadow-lg pb-safe">
					<!-- Handle bar at top -->
					<div class="flex justify-center pt-3 pb-2">
						<div class="w-12 h-1.5 bg-border rounded-full"></div>
					</div>

					<!-- Content slot -->
					<div class="px-4 pb-4 pt-2">
						<slot></slot>
					</div>
				</div>
			</div>
		`;
	}
}
