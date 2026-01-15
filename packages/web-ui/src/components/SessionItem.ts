import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { i18n } from "../utils/i18n.js";
import type { SessionMetadata } from "./Sidebar.js";

/** Max swipe distance to reveal delete button */
const DELETE_BUTTON_WIDTH = 80;
/** Threshold to snap open vs closed */
const SWIPE_THRESHOLD = 40;

/**
 * Format cost in dollars for display
 * @param cost - Cost in dollars
 */
function formatSessionCost(cost: number): string {
	if (cost < 0.01) return "<$0.01";
	return `$${cost.toFixed(2)}`;
}

/**
 * Format a date string to a relative time display
 */
function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		// Today: show time
		return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
	} else if (diffDays === 1) {
		return i18n("Yesterday");
	} else if (diffDays < 7) {
		return date.toLocaleDateString(undefined, { weekday: "long" });
	} else {
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}
}

@customElement("pi-session-item")
export class SessionItem extends LitElement {
	@property({ attribute: false }) session!: SessionMetadata;
	@property({ type: Boolean }) isActive = false;
	@property({ type: Boolean }) isEditing = false;
	@property({ attribute: false }) onClick?: () => void;
	@property({ attribute: false }) onContextMenu?: (e: Event) => void;
	@property({ attribute: false }) onRename?: (newTitle: string) => void;
	@property({ attribute: false }) onCancelEdit?: () => void;
	@property({ attribute: false }) onDelete?: () => void;

	@state() private isHovered = false;
	@state() private swipeOffset = 0;
	@state() private isSwiping = false;

	/** Touch start X position */
	private touchStartX = 0;
	/** Touch start Y position */
	private touchStartY = 0;
	/** Whether we've determined the swipe direction */
	private swipeDirectionLocked = false;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	private handleClick() {
		// If swiped open, snap back instead of selecting
		if (this.swipeOffset !== 0) {
			this.swipeOffset = 0;
			return;
		}
		if (this.onClick) {
			this.onClick();
		}
	}

	private handleTouchStart(e: TouchEvent) {
		this.touchStartX = e.touches[0].clientX;
		this.touchStartY = e.touches[0].clientY;
		this.isSwiping = true;
		this.swipeDirectionLocked = false;
	}

	private handleTouchMove(e: TouchEvent) {
		if (!this.isSwiping) return;

		const currentX = e.touches[0].clientX;
		const currentY = e.touches[0].clientY;
		const deltaX = currentX - this.touchStartX;
		const deltaY = currentY - this.touchStartY;

		// Lock direction on first significant movement
		if (!this.swipeDirectionLocked) {
			if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
				// If vertical movement is greater, cancel horizontal swipe
				if (Math.abs(deltaY) > Math.abs(deltaX)) {
					this.isSwiping = false;
					return;
				}
				this.swipeDirectionLocked = true;
			} else {
				return; // Wait for more movement
			}
		}

		// Prevent scrolling when swiping horizontally
		e.preventDefault();

		// Calculate new offset, accounting for current state
		// If already open, offset from -DELETE_BUTTON_WIDTH
		const baseOffset = this.swipeOffset === -DELETE_BUTTON_WIDTH ? -DELETE_BUTTON_WIDTH : 0;
		let newOffset = baseOffset + deltaX;

		// Clamp to valid range: [-DELETE_BUTTON_WIDTH, 0]
		newOffset = Math.max(-DELETE_BUTTON_WIDTH, Math.min(0, newOffset));

		this.swipeOffset = newOffset;
	}

	private handleTouchEnd() {
		if (!this.isSwiping) return;
		this.isSwiping = false;

		// Snap to open or closed based on threshold
		if (this.swipeOffset < -SWIPE_THRESHOLD) {
			this.swipeOffset = -DELETE_BUTTON_WIDTH;
		} else {
			this.swipeOffset = 0;
		}
	}

	private handleDeleteClick(e: Event) {
		e.stopPropagation();
		this.swipeOffset = 0;
		if (this.onDelete) {
			this.onDelete();
		}
	}

	private handleContextMenu(e: Event) {
		e.preventDefault();
		if (this.onContextMenu) {
			this.onContextMenu(e);
		}
	}

	private handleMenuClick(e: Event) {
		e.stopPropagation();
		if (this.onContextMenu) {
			this.onContextMenu(e);
		}
	}

	private handleMouseEnter() {
		this.isHovered = true;
	}

	private handleMouseLeave() {
		this.isHovered = false;
	}

	override updated(changedProperties: Map<string, unknown>) {
		if (changedProperties.has("isEditing") && this.isEditing) {
			const input = this.querySelector("input");
			if (input) {
				input.focus();
				input.select();
			}
		}
	}

	private handleEditKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			const input = e.target as HTMLInputElement;
			if (this.onRename) {
				this.onRename(input.value);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			if (this.onCancelEdit) {
				this.onCancelEdit();
			}
		}
	}

	private handleEditBlur() {
		if (this.onCancelEdit) {
			this.onCancelEdit();
		}
	}

	override render() {
		const title = this.session.title || i18n("New Chat");
		const preview = this.session.preview || i18n("No messages yet");
		const relativeTime = formatRelativeTime(this.session.lastModified);
		const messageCount = this.session.messageCount;

		// Base classes for the session item button
		const baseClasses = "w-full text-left p-3 rounded-md transition-colors relative group";
		const activeClasses = this.isActive
			? "bg-accent border-l-2 border-primary"
			: "hover:bg-accent/50 border-l-2 border-transparent";

		// Transition class for spring-back animation (only when not actively swiping)
		const transitionClass = this.isSwiping ? "" : "transition-transform duration-200 ease-out";

		return html`
			<div class="relative overflow-hidden rounded-md">
				<!-- Delete button (revealed when swiping) -->
				<button
					@click=${this.handleDeleteClick}
					class="absolute right-0 top-0 bottom-0 w-20 bg-destructive text-destructive-foreground flex flex-col items-center justify-center gap-1 text-xs font-medium"
					aria-label="${i18n("Delete session")}"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
					${i18n("Delete")}
				</button>

				<!-- Session content (slides left to reveal delete) -->
				<div
					class="relative bg-background ${transitionClass}"
					style="transform: translateX(${this.swipeOffset}px)"
					@touchstart=${this.handleTouchStart}
					@touchmove=${this.handleTouchMove}
					@touchend=${this.handleTouchEnd}
				>
					<button
						@click=${this.handleClick}
						@contextmenu=${this.handleContextMenu}
						@mouseenter=${this.handleMouseEnter}
						@mouseleave=${this.handleMouseLeave}
						class="${baseClasses} ${activeClasses}"
						aria-selected=${this.isActive}
						aria-label="${title} - ${preview}"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="flex-1 min-w-0">
								<!-- Title row -->
								${
									this.isEditing
										? html`
											<input
												type="text"
												.value=${this.session.title || ""}
												@keydown=${this.handleEditKeydown}
												@blur=${this.handleEditBlur}
												class="w-full px-1 py-0 text-sm font-medium bg-transparent border border-primary rounded focus:outline-none focus:ring-1 focus:ring-ring"
											/>
										`
										: html`<div class="font-medium text-sm truncate text-foreground">${title}</div>`
								}

								<!-- Preview row -->
								<div class="text-xs text-muted-foreground truncate mt-1">${preview}</div>

								<!-- Metadata row -->
								<div class="text-xs text-muted-foreground mt-1">
									${relativeTime} · ${messageCount} ${messageCount === 1 ? i18n("message") : i18n("messages")}${this.session.usage?.totalCost ? html` · ${formatSessionCost(this.session.usage.totalCost)}` : nothing}
								</div>
							</div>

							<!-- Context menu trigger -->
							${
								this.isHovered || this.isActive
									? html`
										<button
											@click=${this.handleMenuClick}
											class="flex-shrink-0 p-2 min-w-11 min-h-11 -m-1 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
											aria-label="${i18n("Session menu")}"
										>
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												<path
													d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
												/>
											</svg>
										</button>
									`
									: nothing
							}
						</div>
					</button>
				</div>
			</div>
		`;
	}
}

// Register custom element with guard
if (!customElements.get("pi-session-item")) {
	customElements.define("pi-session-item", SessionItem);
}
