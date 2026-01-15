import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { DialogBase } from "@mariozechner/mini-lit/dist/DialogBase.js";
import { Input } from "@mariozechner/mini-lit/dist/Input.js";
import { Label } from "@mariozechner/mini-lit/dist/Label.js";
import { html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { createRef } from "lit/directives/ref.js";
import { Monitor } from "lucide";
import type { ConnectionProfile } from "../networking/connection-types.js";
import { getAppStorage } from "../storage/app-storage.js";
import { i18n } from "../utils/i18n.js";

type View = "list" | "add" | "edit";

@customElement("connections-dialog")
export class ConnectionsDialog extends DialogBase {
	@state() private view: View = "list";
	@state() private profiles: ConnectionProfile[] = [];
	@state() private loading = true;
	@state() private editingProfile: ConnectionProfile | null = null;
	@state() private formName = "";
	@state() private formUrl = "";
	@state() private formToken = "";

	private onConnectCallback?: (profile: ConnectionProfile) => void;
	private nameInputRef = createRef<HTMLInputElement>();

	protected modalWidth = "min(500px, 90vw)";
	protected modalHeight = "min(600px, 90vh)";

	static async open(onConnect: (profile: ConnectionProfile) => void) {
		const dialog = new ConnectionsDialog();
		dialog.onConnectCallback = onConnect;
		dialog.open();
		dialog.loadProfiles();
	}

	private async loadProfiles() {
		this.loading = true;
		try {
			const storage = getAppStorage();
			this.profiles = await storage.connections.getAll();
			// Sort by lastUsed descending
			this.profiles.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
		} catch (error) {
			console.error("Failed to load profiles:", error);
			this.profiles = [];
		} finally {
			this.loading = false;
		}
	}

	private showAddForm() {
		this.view = "add";
		this.editingProfile = null;
		this.formName = "";
		this.formUrl = "";
		this.formToken = "";
		// Focus name input after render
		this.requestUpdate();
		this.updateComplete.then(() => {
			this.nameInputRef.value?.focus();
		});
	}

	private showEditForm(profile: ConnectionProfile) {
		this.view = "edit";
		this.editingProfile = profile;
		this.formName = profile.name;
		this.formUrl = profile.url;
		this.formToken = profile.token;
		// Focus name input after render
		this.requestUpdate();
		this.updateComplete.then(() => {
			this.nameInputRef.value?.focus();
		});
	}

	private async handleDelete(profile: ConnectionProfile, event: Event) {
		event.stopPropagation();

		if (!confirm(i18n("Are you sure you want to delete this connection?"))) {
			return;
		}

		try {
			const storage = getAppStorage();
			await storage.connections.delete(profile.id);
			await this.loadProfiles();
		} catch (error) {
			console.error("Failed to delete profile:", error);
		}
	}

	private async handleConnect(profile: ConnectionProfile, event: Event) {
		event.stopPropagation();

		// Update lastUsed timestamp
		try {
			const storage = getAppStorage();
			profile.lastUsed = new Date().toISOString();
			await storage.connections.update(profile);
			await this.loadProfiles();
		} catch (error) {
			console.error("Failed to update lastUsed:", error);
		}

		// Notify parent
		if (this.onConnectCallback) {
			this.onConnectCallback(profile);
		}
		this.close();
	}

	private async handleSave() {
		if (!this.formName || !this.formUrl) {
			alert(i18n("Please fill in all required fields"));
			return;
		}

		try {
			const storage = getAppStorage();

			if (this.view === "add") {
				const profile: ConnectionProfile = {
					id: crypto.randomUUID(),
					name: this.formName,
					url: this.formUrl,
					token: this.formToken,
					lastUsed: new Date().toISOString(),
				};
				await storage.connections.add(profile);
			} else if (this.view === "edit" && this.editingProfile) {
				const updated: ConnectionProfile = {
					...this.editingProfile,
					name: this.formName,
					url: this.formUrl,
					token: this.formToken,
				};
				await storage.connections.update(updated);
			}

			await this.loadProfiles();
			this.view = "list";
		} catch (error) {
			console.error("Failed to save profile:", error);
			alert(i18n("Failed to save connection"));
		}
	}

	private handleCancel() {
		this.view = "list";
		this.editingProfile = null;
		this.formName = "";
		this.formUrl = "";
		this.formToken = "";
	}

	private formatDate(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	private renderListView(): TemplateResult {
		if (this.loading) {
			return html`<div class="flex items-center justify-center h-full text-muted-foreground">
				${i18n("Loading...")}
			</div>`;
		}

		if (this.profiles.length === 0) {
			return html`
				<div class="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
					<p>${i18n("No connections yet")}</p>
					${Button({
						onClick: () => this.showAddForm(),
						variant: "default",
						children: html`<span class="inline-flex items-center gap-1">+ ${i18n("Add Connection")}</span>`,
					})}
				</div>
			`;
		}

		return html`
			<div class="flex flex-col h-full overflow-hidden">
				<!-- Profile list -->
				<div class="flex-1 overflow-y-auto p-4 space-y-3">
					${this.profiles.map(
						(profile) => html`
							<div
								class="border border-border rounded-lg p-4 hover:bg-muted cursor-pointer transition-colors"
								@click=${() => this.handleConnect(profile, { stopPropagation: () => {} } as Event)}
							>
								<div class="flex items-start gap-3 mb-2">
									<div class="text-foreground flex-shrink-0 mt-0.5">${icon(Monitor, "sm")}</div>
									<div class="flex-1 min-w-0">
										<div class="font-medium text-foreground truncate">${profile.name}</div>
										<div class="text-sm text-muted-foreground font-mono truncate">${profile.url}</div>
										<div class="text-xs text-muted-foreground mt-1">
											${i18n("Last used")}: ${this.formatDate(profile.lastUsed)}
										</div>
									</div>
								</div>
								<div class="flex gap-2 mt-3">
									${Button({
										onClick: (e: Event) => this.handleConnect(profile, e),
										variant: "default",
										size: "sm",
										children: i18n("Connect"),
									})}
									${Button({
										onClick: (e: Event) => {
											e.stopPropagation();
											this.showEditForm(profile);
										},
										variant: "outline",
										size: "sm",
										children: i18n("Edit"),
									})}
									${Button({
										onClick: (e: Event) => this.handleDelete(profile, e),
										variant: "outline",
										size: "sm",
										children: i18n("Delete"),
									})}
								</div>
							</div>
						`,
					)}
				</div>

				<!-- Footer -->
				<div class="p-4 border-t border-border flex justify-between items-center">
					${Button({
						onClick: () => this.showAddForm(),
						variant: "outline",
						children: html`<span class="inline-flex items-center gap-1">+ ${i18n("Add Connection")}</span>`,
					})}
					${Button({
						onClick: () => this.close(),
						variant: "ghost",
						children: i18n("Close"),
					})}
				</div>
			</div>
		`;
	}

	private renderFormView(): TemplateResult {
		return html`
			<div class="flex flex-col h-full overflow-hidden">
				<div class="p-6 flex-shrink-0 border-b border-border">
					<h2 class="text-lg font-semibold text-foreground">
						${this.view === "add" ? i18n("Add Connection") : i18n("Edit Connection")}
					</h2>
				</div>

				<div class="flex-1 overflow-y-auto p-6">
					<div class="flex flex-col gap-4">
						<div class="flex flex-col gap-2">
							${Label({ htmlFor: "connection-name", children: i18n("Name") })}
							${Input({
								value: this.formName,
								placeholder: i18n("e.g., Work Server"),
								inputRef: this.nameInputRef,
								onInput: (e: Event) => {
									this.formName = (e.target as HTMLInputElement).value;
								},
							})}
						</div>

						<div class="flex flex-col gap-2">
							${Label({ htmlFor: "connection-url", children: i18n("URL") })}
							${Input({
								value: this.formUrl,
								placeholder: "wss://example.com:8080",
								onInput: (e: Event) => {
									this.formUrl = (e.target as HTMLInputElement).value;
								},
							})}
						</div>

						<div class="flex flex-col gap-2">
							${Label({ htmlFor: "connection-token", children: i18n("Token") })}
							${Input({
								type: "password",
								value: this.formToken,
								placeholder: i18n("Enter auth token"),
								onInput: (e: Event) => {
									this.formToken = (e.target as HTMLInputElement).value;
								},
							})}
						</div>
					</div>
				</div>

				<div class="p-6 flex-shrink-0 border-t border-border flex justify-end gap-2">
					${Button({
						onClick: () => this.handleCancel(),
						variant: "ghost",
						children: i18n("Cancel"),
					})}
					${Button({
						onClick: () => this.handleSave(),
						variant: "default",
						disabled: !this.formName || !this.formUrl,
						children: i18n("Save"),
					})}
				</div>
			</div>
		`;
	}

	protected override renderContent(): TemplateResult {
		if (this.view === "list") {
			return html`
				<div class="p-6 pb-4 flex-shrink-0 border-b border-border">
					<h2 class="text-lg font-semibold text-foreground">${i18n("Server Connections")}</h2>
				</div>
				${this.renderListView()}
			`;
		}
		return this.renderFormView();
	}
}
