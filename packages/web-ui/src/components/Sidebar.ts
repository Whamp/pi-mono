import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { type DateGroup, type GroupedSessions, groupSessionsByDate } from "../utils/date-utils.js";
import { i18n } from "../utils/i18n.js";
import "./SessionItem.js";

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

	@state() private searchQuery = "";
	@state() private editingSessionId: string | null = null;
	@state() private contextMenuSessionId: string | null = null;
	@state() private contextMenuPosition: { x: number; y: number } | null = null;
	@state() private showDeleteConfirm: string | null = null;

	private searchTimeout?: number;
	private boundHandleClickOutside = this.handleClickOutside.bind(this);

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	override connectedCallback() {
		super.connectedCallback();
	}

	override disconnectedCallback() {
		super.disconnectedCallback();
		document.removeEventListener("click", this.boundHandleClickOutside);
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

	private getFilteredSessions(): SessionMetadata[] {
		if (!this.searchQuery.trim()) {
			return this.sessions;
		}
		const query = this.searchQuery.toLowerCase();
		return this.sessions.filter(
			(session) => session.title.toLowerCase().includes(query) || session.preview.toLowerCase().includes(query),
		);
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
		return html`
			<div class="p-3 border-b border-border">
				<div class="relative">
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
			</div>
		`;
	}

	private handleSessionContextMenu(session: SessionMetadata, e: Event) {
		e.preventDefault();
		e.stopPropagation();

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
		return html`
			<pi-session-item
				.session=${session}
				.isActive=${isActive}
				.isEditing=${isEditing}
				.onClick=${() => this.handleSessionClick(session.id)}
				.onContextMenu=${(e: Event) => this.handleSessionContextMenu(session, e)}
				.onRename=${(newTitle: string) => this.handleSessionRename(session.id, newTitle)}
				.onCancelEdit=${() => this.handleCancelEdit()}
			></pi-session-item>
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
		if (!this.contextMenuSessionId || !this.contextMenuPosition) {
			return nothing;
		}

		const { x, y } = this.contextMenuPosition;

		return html`
			<div
				class="context-menu-container fixed z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px]"
				style="left: ${x}px; top: ${y}px;"
			>
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
					${i18n("Export")}
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

	override render() {
		return html`
			<div class="flex flex-col h-full bg-background border-r border-border">
				${this.renderActionsBar()} ${this.renderSearchInput()}
				<div class="flex-1 overflow-y-auto">${this.renderSessionList()}</div>
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
