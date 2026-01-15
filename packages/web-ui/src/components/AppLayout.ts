import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createSwipeHandler, type SwipeHandler } from "../utils/gesture-utils.js";
import { createShortcutManager, type ShortcutManager } from "../utils/keyboard-shortcuts.js";

/**
 * App layout component that orchestrates the sidebar, main content, and artifacts panel
 * with responsive breakpoints.
 *
 * Breakpoints:
 * - Mobile: <768px - sidebar and artifacts as full-screen overlay
 * - Tablet: 768-1023px - sidebar as drawer, artifacts as overlay
 * - Desktop: ≥1024px - sidebar visible, artifacts as overlay
 * - Desktop XL: ≥1280px - sidebar and artifacts can be side panels
 */
@customElement("pi-app-layout")
export class AppLayout extends LitElement {
	@property({ type: Boolean }) sidebarOpen = false;
	@property({ type: Boolean }) artifactsOpen = false;
	@property({ attribute: false }) onSidebarToggle?: () => void;
	@property({ attribute: false }) onArtifactsToggle?: () => void;
	@property({ attribute: false }) onNewChat?: () => void;
	@property({ attribute: false }) onSearch?: () => void;

	@state() private isMobile = false;
	@state() private isTablet = false;
	@state() private isDesktop = false;
	@state() private isDesktopXL = false;

	private sidebarOpenSwipeHandler?: SwipeHandler;
	private sidebarCloseSwipeHandler?: SwipeHandler;
	private sidebarElement?: HTMLElement;
	private shortcutManager?: ShortcutManager;

	private handleResize = () => {
		this.updateBreakpoints();
	};

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback() {
		super.connectedCallback();
		this.updateBreakpoints();
		window.addEventListener("resize", this.handleResize);
		this.setupSwipeHandlers();
		this.setupKeyboardShortcuts();
	}

	override disconnectedCallback() {
		super.disconnectedCallback();
		window.removeEventListener("resize", this.handleResize);
		this.cleanupSwipeHandlers();
		this.shortcutManager?.detach();
	}

	private setupSwipeHandlers() {
		// Swipe right from left edge to open sidebar (mobile/tablet only)
		this.sidebarOpenSwipeHandler = createSwipeHandler({
			direction: "right",
			fromEdge: "left",
			onSwipe: () => {
				if (!this.isDesktop && !this.sidebarOpen && this.onSidebarToggle) {
					this.onSidebarToggle();
				}
			},
		});
		this.sidebarOpenSwipeHandler.attach(this);
	}

	private cleanupSwipeHandlers() {
		this.sidebarOpenSwipeHandler?.detach();
		this.sidebarCloseSwipeHandler?.detach();
	}

	private setupKeyboardShortcuts() {
		this.shortcutManager = createShortcutManager();

		// Cmd/Ctrl+B: Toggle sidebar
		this.shortcutManager.register({
			key: "b",
			meta: true,
			ctrl: true,
			handler: () => this.onSidebarToggle?.(),
			description: "Toggle sidebar",
		});

		// Cmd/Ctrl+N: New chat
		this.shortcutManager.register({
			key: "n",
			meta: true,
			ctrl: true,
			handler: () => this.onNewChat?.(),
			description: "New chat",
		});

		// Cmd/Ctrl+K: Search / focus search input
		this.shortcutManager.register({
			key: "k",
			meta: true,
			ctrl: true,
			handler: () => this.onSearch?.(),
			description: "Search",
		});

		// Escape: Close sidebar (if open on mobile) and artifacts panel
		this.shortcutManager.register({
			key: "escape",
			handler: () => {
				if (this.sidebarOpen && !this.isDesktop) {
					this.onSidebarToggle?.();
				}
				if (this.artifactsOpen) {
					this.onArtifactsToggle?.();
				}
			},
			description: "Close modals and panels",
		});

		this.shortcutManager.attach();
	}

	override updated(changedProperties: Map<string, unknown>) {
		super.updated(changedProperties);

		// Attach/detach sidebar close swipe handler based on sidebar open state
		if (changedProperties.has("sidebarOpen")) {
			if (this.sidebarOpen && !this.isDesktop) {
				// Sidebar just opened on mobile/tablet - attach close swipe handler
				const sidebarEl = this.querySelector('[class*="inset-y-0"][class*="left-0"]') as HTMLElement | null;
				if (sidebarEl && sidebarEl !== this.sidebarElement) {
					this.sidebarCloseSwipeHandler?.detach();
					this.sidebarElement = sidebarEl;
					this.sidebarCloseSwipeHandler = createSwipeHandler({
						direction: "left",
						onSwipe: () => {
							if (this.sidebarOpen && this.onSidebarToggle) {
								this.onSidebarToggle();
							}
						},
					});
					this.sidebarCloseSwipeHandler.attach(sidebarEl);
				}
			} else if (!this.sidebarOpen) {
				// Sidebar closed - detach close handler
				this.sidebarCloseSwipeHandler?.detach();
				this.sidebarElement = undefined;
			}
		}
	}

	private updateBreakpoints() {
		const width = window.innerWidth;
		this.isMobile = width < 768;
		this.isTablet = width >= 768 && width < 1024;
		this.isDesktop = width >= 1024;
		this.isDesktopXL = width >= 1280;
	}

	/**
	 * Whether to show the backdrop overlay.
	 * Shown when sidebar or artifacts are open as a drawer/overlay on mobile/tablet.
	 */
	private get showBackdrop(): boolean {
		// On mobile: backdrop for sidebar or artifacts
		if (this.isMobile) {
			return this.sidebarOpen || this.artifactsOpen;
		}
		// On tablet: backdrop for sidebar or artifacts
		if (this.isTablet) {
			return this.sidebarOpen || this.artifactsOpen;
		}
		// On desktop (not XL): backdrop only for artifacts
		if (this.isDesktop && !this.isDesktopXL) {
			return this.artifactsOpen;
		}
		// On desktop XL: no backdrop (both are side panels)
		return false;
	}

	private handleBackdropClick() {
		// Close whichever panel is open
		if (this.sidebarOpen && this.onSidebarToggle) {
			this.onSidebarToggle();
		}
		if (this.artifactsOpen && this.onArtifactsToggle) {
			this.onArtifactsToggle();
		}
	}

	/**
	 * Get classes for the sidebar container based on breakpoint and open state.
	 */
	private getSidebarClasses(): string {
		const baseClasses = "h-full bg-background";

		// Desktop: static sidebar
		if (this.isDesktop) {
			return `${baseClasses} relative w-[280px] flex-shrink-0 border-r border-border`;
		}

		// Mobile/Tablet: drawer that slides in from left
		const drawerClasses = `${baseClasses} fixed inset-y-0 left-0 z-20 w-[280px] transform transition-transform duration-300 ease-in-out`;
		const translateClass = this.sidebarOpen ? "translate-x-0" : "-translate-x-full";

		return `${drawerClasses} ${translateClass}`;
	}

	/**
	 * Get classes for the artifacts container based on breakpoint and open state.
	 */
	private getArtifactsClasses(): string {
		const baseClasses = "h-full bg-background";

		// Desktop XL: side panel when open
		if (this.isDesktopXL && this.artifactsOpen) {
			return `${baseClasses} relative w-[400px] flex-shrink-0 border-l border-border`;
		}

		// All other cases: drawer that slides in from right
		// On mobile: full width; on tablet/desktop: 400px width
		const widthClass = this.isMobile ? "w-full" : "w-[400px]";
		const drawerClasses = `${baseClasses} fixed inset-y-0 right-0 z-20 ${widthClass} transform transition-transform duration-300 ease-in-out`;
		const translateClass = this.artifactsOpen ? "translate-x-0" : "translate-x-full";

		return `${drawerClasses} ${translateClass}`;
	}

	private renderBackdrop() {
		if (!this.showBackdrop) {
			return nothing;
		}

		return html`
			<div
				class="fixed inset-0 z-10 bg-black/50 transition-opacity duration-300"
				@click=${this.handleBackdropClick}
			></div>
		`;
	}

	override render() {
		return html`
			<div
				class="flex h-dvh w-full overflow-hidden bg-background"
				style="padding-top: env(safe-area-inset-top, 0px); padding-left: env(safe-area-inset-left, 0px); padding-right: env(safe-area-inset-right, 0px);"
			>
				<!-- Sidebar container -->
				<div class="${this.getSidebarClasses()}">
					<slot name="sidebar"></slot>
				</div>

				<!-- Main content -->
				<div class="flex flex-col flex-1 min-w-0 h-full">
					<slot name="header"></slot>
					<div class="flex-1 min-h-0 overflow-hidden">
						<slot></slot>
					</div>
				</div>

				<!-- Artifacts container -->
				${
					this.artifactsOpen || !this.isDesktopXL
						? html`
							<div class="${this.getArtifactsClasses()}">
								<slot name="artifacts"></slot>
							</div>
						`
						: nothing
				}

				<!-- Backdrop for drawers -->
				${this.renderBackdrop()}
			</div>
		`;
	}
}

// Register custom element with guard
if (!customElements.get("pi-app-layout")) {
	customElements.define("pi-app-layout", AppLayout);
}
