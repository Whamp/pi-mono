import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { type DateGroup, type GroupedSessions, groupSessionsByDate } from "../utils/date-utils.js";
import { i18n } from "../utils/i18n.js";
import { type ContextualShortcutHandler, createContextualShortcutHandler } from "../utils/keyboard-shortcuts.js";
import type { DateRangeFilter, SearchFiltersState } from "./SearchFilters.js";
import "./SearchFilters.js";
import "./SessionItem.js";
import "./BottomSheet.js";

export interface SessionUsage {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCost: number;
}

export interface SessionMetadata {
	id: string;
	title: string;
	preview: string;
	lastModified: string;
	messageCount: number;
	usage?: SessionUsage;
	/** Model ID used in this session (optional, for filtering) */
	model?: string;
}

@customElement("pi-sidebar")
export class Sidebar extends LitElement {
	@property({ attribute: false }) sessions: SessionMetadata[] = [];
	@property({ attribute: false }) activeSessionId: string | null = null;
	@property({ type: Boolean }) loading = false;
	@property({ attribute: false }) onSelect?: (sessionId: string) => void;
	@property({ attribute: false }) onNewChat?: () => void;
	@property({ attribute: false }) onDelete?: (sessionId: string) => void;
	@property({ attribute: false }) onRename?: (sessionId: string, newTitle: string) => void;
	@property({ attribute: false }) onExport?: (sessionId: string) => void;
	@property({ attribute: false }) onExportHtml?: (sessionId: string) => void;
	@property({ attribute: false }) onInfo?: (sessionId: string) => void;
	@property({ attribute: false }) onRefresh?: () => void;

	@state() private searchQuery = "";
	@state() private editingSessionId: string | null = null;
	@state() private contextMenuSessionId: string | null = null;
	@state() private contextMenuPosition: { x: number; y: number } | null = null;
	@state() private showDeleteConfirm: string | null = null;
	@state() private showFilters = false;
	@state() private filters: SearchFiltersState = { dateRange: "all", model: null };
	@state() private focusedSessionIndex: number = -1;
	@state() private windowWidth = 0;
	@state() private bottomSheetOpen = false;
	@state() private isPulling = false;
	@state() private pullDistance = 0;
	@state() private isRefreshing = false;

	private searchTimeout?: number;
	private boundHandleClickOutside = this.handleClickOutside.bind(this);
	private boundHandleResize = this.handleResize.bind(this);
	private shortcutHandler: ContextualShortcutHandler = createContextualShortcutHandler();

	// Pull-to-refresh state
	private touchStartY = 0;
	private touchStartX = 0;
	private sessionListElement: HTMLElement | null = null;
	private readonly PULL_THRESHOLD = 60;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback() {
		super.connectedCallback();
		this.setupShortcuts();
		this.windowWidth = window.innerWidth;
		window.addEventListener("resize", this.boundHandleResize);
	}

	private handleResize() {
		this.windowWidth = window.innerWidth;
	}

	protected override willUpdate(changedProperties: Map<string | number | symbol, unknown>): void {
		super.willUpdate(changedProperties);
		// Reset focused index if sessions change and current index is out of bounds
		if (changedProperties.has("sessions") || changedProperties.has("searchQuery")) {
			const filteredSessions = this.getFilteredSessions();
			if (this.focusedSessionIndex >= filteredSessions.length) {
				this.focusedSessionIndex = filteredSessions.length > 0 ? 0 : -1;
			}
		}
		// Reset refreshing state when loading completes
		if (changedProperties.has("loading") && !this.loading) {
			this.isRefreshing = false;
			this.pullDistance = 0;
			this.isPulling = false;
		}
	}

	private setupShortcuts() {
		// Arrow up: navigate to previous session
		this.shortcutHandler.register({
			key: "arrowup",
			handler: () => this.navigateSession(-1),
			description: i18n("Navigate up"),
		});

		// Arrow down: navigate to next session
		this.shortcutHandler.register({
			key: "arrowdown",
			handler: () => this.navigateSession(1),
			description: i18n("Navigate down"),
		});

		// Enter: select/open the focused session
		this.shortcutHandler.register({
			key: "enter",
			handler: () => this.selectFocusedSession(),
			description: i18n("Select session"),
		});

		// Slash: focus search input
		this.shortcutHandler.register({
			key: "/",
			handler: () => this.focusSearchInput(),
			description: i18n("Search"),
		});

		// Attach to the sidebar element
		this.shortcutHandler.attach(this);
	}

	private navigateSession(delta: number) {
		const filteredSessions = this.getFilteredSessions();
		if (filteredSessions.length === 0) return;

		let newIndex = this.focusedSessionIndex + delta;

		// Wrap around
		if (newIndex < 0) {
			newIndex = filteredSessions.length - 1;
		} else if (newIndex >= filteredSessions.length) {
			newIndex = 0;
		}

		this.focusedSessionIndex = newIndex;
		this.scrollFocusedSessionIntoView(filteredSessions[newIndex].id);
	}

	private selectFocusedSession() {
		const filteredSessions = this.getFilteredSessions();
		if (this.focusedSessionIndex >= 0 && this.focusedSessionIndex < filteredSessions.length) {
			const session = filteredSessions[this.focusedSessionIndex];
			this.handleSessionClick(session.id);
		}
	}

	private focusSearchInput() {
		const input = this.querySelector('input[type="text"]') as HTMLInputElement | null;
		if (input) {
			input.focus();
		}
	}

	private scrollFocusedSessionIntoView(sessionId: string) {
		requestAnimationFrame(() => {
			const sessionElement = this.querySelector(`[data-session-id="${sessionId}"]`);
			if (sessionElement) {
				sessionElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}
		});
	}

	override disconnectedCallback() {
		super.disconnectedCallback();
		document.removeEventListener("click", this.boundHandleClickOutside);
		window.removeEventListener("resize", this.boundHandleResize);
		this.shortcutHandler.detach();
	}

	private handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		// Check if click is outside the context menu
		if (this.contextMenuSessionId && !target.closest(".context-menu-container")) {
			this.closeContextMenu();
		}
	}

	private handleSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		clearTimeout(this.searchTimeout);
		this.searchTimeout = window.setTimeout(() => {
			this.searchQuery = value;
		}, 300);
	}

	private handleSearchClear() {
		this.searchQuery = "";
		const input = this.querySelector('input[type="text"]') as HTMLInputElement | null;
		if (input) {
			input.value = "";
		}
	}

	private handleToggleFilters() {
		this.showFilters = !this.showFilters;
	}

	private handleFiltersChange(newFilters: SearchFiltersState) {
		this.filters = newFilters;
	}

	private handleClearFilters() {
		this.filters = { dateRange: "all", model: null };
		this.showFilters = false;
	}

	private hasActiveFilters(): boolean {
		return this.filters.dateRange !== "all" || this.filters.model !== null;
	}

	private getAvailableModels(): string[] {
		const modelSet = new Set<string>();
		for (const session of this.sessions) {
			if (session.model) {
				modelSet.add(session.model);
			}
		}
		return Array.from(modelSet).sort();
	}

	private isWithinDateRange(dateStr: string, range: DateRangeFilter): boolean {
		if (range === "all") return true;

		const date = new Date(dateStr);
		const now = new Date();

		// Reset time to start of day for comparison
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		switch (range) {
			case "today": {
				return date >= startOfToday;
			}
			case "last7": {
				const sevenDaysAgo = new Date(startOfToday);
				sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
				return date >= sevenDaysAgo;
			}
			case "last30": {
				const thirtyDaysAgo = new Date(startOfToday);
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
				return date >= thirtyDaysAgo;
			}
			default:
				return true;
		}
	}

	private isMobile(): boolean {
		return this.windowWidth < 768;
	}

	private getFilteredSessions(): SessionMetadata[] {
		let filtered = this.sessions;

		// Apply text search filter
		if (this.searchQuery.trim()) {
			const query = this.searchQuery.toLowerCase();
			filtered = filtered.filter(
				(session) => session.title.toLowerCase().includes(query) || session.preview.toLowerCase().includes(query),
			);
		}

		// Apply date range filter
		if (this.filters.dateRange !== "all") {
			filtered = filtered.filter((session) => this.isWithinDateRange(session.lastModified, this.filters.dateRange));
		}

		// Apply model filter
		if (this.filters.model !== null) {
			filtered = filtered.filter((session) => session.model === this.filters.model);
		}

		return filtered;
	}

	private handleSessionClick(sessionId: string) {
		if (this.onSelect) {
			this.onSelect(sessionId);
		}
	}

	private handleNewChat() {
		if (this.onNewChat) {
			this.onNewChat();
		}
	}

	private renderActionsBar() {
		return html`
			<div class="flex items-center justify-between p-3 border-b border-border">
				<button
					@click=${this.handleNewChat}
					class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					${i18n("New Chat")}
				</button>
				<button
					class="p-2 min-w-11 min-h-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center justify-center"
					aria-label="${i18n("Settings")}"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</button>
			</div>
		`;
	}

	private renderSearchInput() {
		const hasActiveFilters = this.hasActiveFilters();
		return html`
			<div class="p-3 border-b border-border">
				<div class="relative flex items-center gap-2">
					<div class="relative flex-1">
						<svg
							class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						<input
							type="text"
							placeholder="${i18n("Search conversations")}"
							@input=${this.handleSearchInput}
							class="w-full pl-10 pr-8 py-2 text-sm bg-muted/50 border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
						/>
						${
							this.searchQuery
								? html`
									<button
										@click=${this.handleSearchClear}
										class="absolute right-1 top-1/2 transform -translate-y-1/2 p-2.5 rounded text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
										aria-label="${i18n("Clear search")}"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								`
								: null
						}
					</div>
					<!-- Filter toggle button -->
					<button
						@click=${this.handleToggleFilters}
						class="p-2 rounded-md transition-colors flex items-center justify-center ${
							this.showFilters || hasActiveFilters
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:text-foreground hover:bg-accent"
						}"
						aria-label="${i18n("Toggle filters")}"
						aria-expanded="${this.showFilters}"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
							/>
						</svg>
						${hasActiveFilters ? html`<span class="ml-1 w-2 h-2 rounded-full bg-primary"></span>` : null}
					</button>
				</div>
			</div>
			${
				this.showFilters
					? html`
						<pi-search-filters
							.filters=${this.filters}
							.availableModels=${this.getAvailableModels()}
							.onFiltersChange=${(f: SearchFiltersState) => this.handleFiltersChange(f)}
						></pi-search-filters>
					`
					: null
			}
			${
				hasActiveFilters && !this.showFilters
					? html`
						<div class="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 text-xs">
							<span class="text-muted-foreground">${i18n("Filters")}:</span>
							${
								this.filters.dateRange !== "all"
									? html`<span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full">${this.getDateRangeLabel(this.filters.dateRange)}</span>`
									: null
							}
							${
								this.filters.model !== null
									? html`<span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full truncate max-w-[100px]">${this.filters.model}</span>`
									: null
							}
							<button
								@click=${this.handleClearFilters}
								class="ml-auto text-muted-foreground hover:text-foreground transition-colors"
								aria-label="${i18n("Clear filters")}"
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					`
					: null
			}
		`;
	}

	private getDateRangeLabel(value: DateRangeFilter): string {
		switch (value) {
			case "today":
				return i18n("Today");
			case "last7":
				return i18n("Last 7 Days");
			case "last30":
				return i18n("Last 30 Days");
			default:
				return i18n("All time");
		}
	}

	private handleSessionContextMenu(session: SessionMetadata, e: Event) {
		e.preventDefault();
		e.stopPropagation();

		// On mobile, show bottom sheet instead of dropdown
		if (this.isMobile()) {
			this.contextMenuSessionId = session.id;
			this.bottomSheetOpen = true;
			return;
		}

		// Calculate position from the click event
		const mouseEvent = e as MouseEvent;
		const x = mouseEvent.clientX;
		const y = mouseEvent.clientY;

		// Ensure menu stays within viewport
		const menuWidth = 160;
		const menuHeight = 80;
		const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
		const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

		this.contextMenuSessionId = session.id;
		this.contextMenuPosition = { x: adjustedX, y: adjustedY };

		// Add click outside listener
		// Defer to next tick to avoid immediate close from the current click
		setTimeout(() => {
			document.addEventListener("click", this.boundHandleClickOutside);
		}, 0);
	}

	private closeContextMenu() {
		this.contextMenuSessionId = null;
		this.contextMenuPosition = null;
		this.bottomSheetOpen = false;
		document.removeEventListener("click", this.boundHandleClickOutside);
	}

	private handleRenameClick(sessionId: string) {
		this.closeContextMenu();
		this.editingSessionId = sessionId;
	}

	private handleExportClick(sessionId: string) {
		this.closeContextMenu();
		if (this.onExport) {
			this.onExport(sessionId);
		}
	}

	private handleExportHtmlClick(sessionId: string) {
		this.closeContextMenu();
		if (this.onExportHtml) {
			this.onExportHtml(sessionId);
		}
	}

	private handleInfoClick(sessionId: string) {
		this.closeContextMenu();
		if (this.onInfo) {
			this.onInfo(sessionId);
		}
	}

	private handleSessionRename(sessionId: string, newTitle: string) {
		if (this.onRename && newTitle.trim()) {
			this.onRename(sessionId, newTitle.trim());
		}
		this.editingSessionId = null;
	}

	private handleCancelEdit() {
		this.editingSessionId = null;
	}

	private handleDeleteClick(sessionId: string) {
		this.closeContextMenu();
		this.showDeleteConfirm = sessionId;
	}

	private closeDeleteConfirm() {
		this.showDeleteConfirm = null;
	}

	private confirmDelete() {
		if (this.showDeleteConfirm && this.onDelete) {
			this.onDelete(this.showDeleteConfirm);
		}
		this.showDeleteConfirm = null;
	}

	private renderSessionItem(session: SessionMetadata) {
		const isActive = session.id === this.activeSessionId;
		const isEditing = session.id === this.editingSessionId;
		// Find index in filtered sessions for focus tracking
		const filteredSessions = this.getFilteredSessions();
		const index = filteredSessions.findIndex((s) => s.id === session.id);
		const isFocused = index === this.focusedSessionIndex;
		return html`
			<div data-session-id="${session.id}" class="${isFocused ? "ring-2 ring-primary rounded-md" : ""}">
				<pi-session-item
					.session=${session}
					.isActive=${isActive}
					.isEditing=${isEditing}
					.onClick=${() => this.handleSessionClick(session.id)}
					.onContextMenu=${(e: Event) => this.handleSessionContextMenu(session, e)}
					.onRename=${(newTitle: string) => this.handleSessionRename(session.id, newTitle)}
					.onCancelEdit=${() => this.handleCancelEdit()}
				></pi-session-item>
			</div>
		`;
	}

	private renderDateGroupHeader(group: DateGroup) {
		return html`
			<div
				class="sticky top-0 z-10 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-background/95 backdrop-blur-sm border-b border-border/50"
			>
				${i18n(group)}
			</div>
		`;
	}

	private renderSessionGroup(groupedSession: GroupedSessions<SessionMetadata>) {
		return html`
			${this.renderDateGroupHeader(groupedSession.group)}
			<div class="flex flex-col gap-1 px-2 py-1">
				${groupedSession.sessions.map((session) => this.renderSessionItem(session))}
			</div>
		`;
	}

	private renderSessionSkeleton() {
		// Render 4 skeleton session items to match expected content
		return html`
			<div class="flex flex-col gap-2 p-2">
				${[1, 2, 3, 4].map(
					() => html`
						<div class="p-3 rounded-md">
							<div class="h-4 bg-muted rounded w-3/4 mb-2 animate-pulse"></div>
							<div class="h-3 bg-muted rounded w-full mb-2 animate-pulse"></div>
							<div class="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
						</div>
					`,
				)}
			</div>
		`;
	}

	private renderSessionList() {
		if (this.loading) {
			return this.renderSessionSkeleton();
		}
		if (this.sessions.length === 0) {
			return html`
				<div class="flex flex-col items-center justify-center p-8 text-center">
					<svg class="w-12 h-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						/>
					</svg>
					<p class="text-muted-foreground text-sm">${i18n("No conversations yet")}</p>
					<p class="text-muted-foreground text-xs mt-1">${i18n("Start a new chat to begin")}</p>
				</div>
			`;
		}

		const filteredSessions = this.getFilteredSessions();

		if (filteredSessions.length === 0) {
			return html`
				<div class="flex flex-col items-center justify-center p-8 text-center">
					<svg class="w-12 h-12 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<p class="text-muted-foreground text-sm">${i18n("No results found")}</p>
					<p class="text-muted-foreground text-xs mt-1">${i18n("Try a different search term")}</p>
				</div>
			`;
		}

		const groupedSessions = groupSessionsByDate(filteredSessions);

		return html`
			<div class="flex flex-col">${groupedSessions.map((group) => this.renderSessionGroup(group))}</div>
		`;
	}

	private renderContextMenu() {
		if (!this.contextMenuSessionId) {
			return nothing;
		}

		// On mobile, show bottom sheet
		if (this.isMobile() && this.bottomSheetOpen) {
			return html`
				<pi-bottom-sheet
					.open=${this.bottomSheetOpen}
					.onClose=${() => this.closeContextMenu()}
				>
					<div class="flex flex-col gap-1">
						<button
							@click=${() => this.handleInfoClick(this.contextMenuSessionId!)}
							class="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-3 text-foreground min-h-[48px] rounded-md"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span class="text-base">${i18n("Info")}</span>
						</button>
						<button
							@click=${() => this.handleRenameClick(this.contextMenuSessionId!)}
							class="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-3 text-foreground min-h-[48px] rounded-md"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
								/>
							</svg>
							<span class="text-base">${i18n("Rename")}</span>
						</button>
						<button
							@click=${() => this.handleExportClick(this.contextMenuSessionId!)}
							class="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-3 text-foreground min-h-[48px] rounded-md"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
								/>
							</svg>
							<span class="text-base">${i18n("Export as JSON")}</span>
						</button>
						<button
							@click=${() => this.handleExportHtmlClick(this.contextMenuSessionId!)}
							class="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-3 text-foreground min-h-[48px] rounded-md"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							<span class="text-base">${i18n("Export as HTML")}</span>
						</button>
						<div class="border-t border-border my-1"></div>
						<button
							@click=${() => this.handleDeleteClick(this.contextMenuSessionId!)}
							class="w-full px-4 py-3 text-left hover:bg-accent text-destructive flex items-center gap-3 min-h-[48px] rounded-md"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
							<span class="text-base">${i18n("Delete")}</span>
						</button>
					</div>
				</pi-bottom-sheet>
			`;
		}

		// Desktop: show dropdown at position
		if (!this.contextMenuPosition) {
			return nothing;
		}

		const { x, y } = this.contextMenuPosition;

		return html`
			<div
				class="context-menu-container fixed z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px]"
				style="left: ${x}px; top: ${y}px;"
			>
				<button
					@click=${() => this.handleInfoClick(this.contextMenuSessionId!)}
					class="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 text-foreground"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					${i18n("Info")}
				</button>
				<button
					@click=${() => this.handleRenameClick(this.contextMenuSessionId!)}
					class="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 text-foreground"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
						/>
					</svg>
					${i18n("Rename")}
				</button>
				<button
					@click=${() => this.handleExportClick(this.contextMenuSessionId!)}
					class="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 text-foreground"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
						/>
					</svg>
					${i18n("Export as JSON")}
				</button>
				<button
					@click=${() => this.handleExportHtmlClick(this.contextMenuSessionId!)}
					class="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 text-foreground"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					${i18n("Export as HTML")}
				</button>
				<button
					@click=${() => this.handleDeleteClick(this.contextMenuSessionId!)}
					class="w-full px-3 py-2 text-sm text-left hover:bg-accent text-destructive flex items-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
					${i18n("Delete")}
				</button>
			</div>
		`;
	}

	private renderDeleteConfirmDialog() {
		if (!this.showDeleteConfirm) {
			return nothing;
		}

		return html`
			<!-- Backdrop -->
			<div class="fixed inset-0 z-40 bg-black/50" @click=${this.closeDeleteConfirm}></div>

			<!-- Dialog -->
			<div
				class="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background border border-border rounded-lg p-6 shadow-xl max-w-sm w-full mx-4"
			>
				<h3 class="text-lg font-semibold text-foreground">${i18n("Delete conversation?")}</h3>
				<p class="text-muted-foreground text-sm mt-2">${i18n("This action cannot be undone.")}</p>
				<div class="flex justify-end gap-3 mt-6">
					<button
						@click=${this.closeDeleteConfirm}
						class="px-4 py-2 text-sm rounded-md hover:bg-accent text-foreground"
					>
						${i18n("Cancel")}
					</button>
					<button
						@click=${this.confirmDelete}
						class="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						${i18n("Delete")}
					</button>
				</div>
			</div>
		`;
	}

	// Pull-to-refresh handlers
	private handleTouchStart = (e: TouchEvent) => {
		if (!this.isMobile() || this.isRefreshing) return;

		const touch = e.touches[0];
		this.touchStartY = touch.clientY;
		this.touchStartX = touch.clientX;
		this.isPulling = false;
		this.pullDistance = 0;
	};

	private handleTouchMove = (e: TouchEvent) => {
		if (!this.isMobile() || this.isRefreshing) return;

		const touch = e.touches[0];
		const deltaY = touch.clientY - this.touchStartY;
		const deltaX = touch.clientX - this.touchStartX;

		// Only trigger if at top of list and pulling down
		if (!this.sessionListElement) {
			this.sessionListElement = this.querySelector('[class*="overflow-y-auto"]');
		}
		if (!this.sessionListElement) return;

		// Check if we're at the top of the list
		const isAtTop = this.sessionListElement.scrollTop <= 0;

		if (isAtTop && deltaY > 0 && Math.abs(deltaX) < Math.abs(deltaY)) {
			// Vertical pull dominates over horizontal swipe
			e.preventDefault();
			this.isPulling = true;

			// Use a spring effect - pull distance increases slower as you pull more
			this.pullDistance = Math.min(deltaY * 0.5, this.PULL_THRESHOLD * 1.5);
		}
	};

	private handleTouchEnd = (_e: TouchEvent) => {
		if (!this.isMobile() || this.isRefreshing) return;

		if (this.isPulling && this.pullDistance >= this.PULL_THRESHOLD) {
			// Trigger refresh
			this.isRefreshing = true;
			this.pullDistance = 0;
			this.isPulling = false;

			if (this.onRefresh) {
				this.onRefresh();
			}
		} else {
			// Reset without refreshing
			this.isPulling = false;
			this.pullDistance = 0;
		}
	};

	private renderPullIndicator() {
		if (!this.isPulling && !this.isRefreshing) return nothing;

		const pullProgress = Math.min(this.pullDistance / this.PULL_THRESHOLD, 1);
		const rotation = pullProgress * 360;
		const opacity = pullProgress * 0.7;

		return html`
			<div
				class="flex flex-col items-center justify-center py-4 transition-all duration-200"
				style="transform: translateY(${this.pullDistance}px); opacity: ${opacity};"
			>
				${
					this.isRefreshing
						? html`
						<div class="flex flex-col items-center gap-2">
							<svg class="w-6 h-6 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							<span class="text-xs text-muted-foreground">${i18n("Refreshing...")}</span>
						</div>
					`
						: html`
						<div class="flex flex-col items-center gap-1">
							<svg
								class="w-5 h-5 text-muted-foreground transition-transform"
								style="transform: rotate(${rotation}deg);"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
							<span class="text-xs text-muted-foreground">
								${pullProgress >= 1 ? i18n("Release to refresh") : i18n("Pull to refresh")}
							</span>
						</div>
					`
				}
			</div>
		`;
	}

	override render() {
		return html`
			<div class="flex flex-col h-full bg-background border-r border-border">
				${this.renderActionsBar()} ${this.renderSearchInput()}
				<div
					class="flex-1 overflow-y-auto"
					@touchstart=${this.handleTouchStart}
					@touchmove=${this.handleTouchMove}
					@touchend=${this.handleTouchEnd}
				>
					${this.renderPullIndicator()}
					${this.renderSessionList()}
				</div>
			</div>
			${this.renderContextMenu()}
			${this.renderDeleteConfirmDialog()}
		`;
	}
}

// Register custom element with guard
if (!customElements.get("pi-sidebar")) {
	customElements.define("pi-sidebar", Sidebar);
}
