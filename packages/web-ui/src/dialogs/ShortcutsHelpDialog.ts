import { DialogContent, DialogHeader } from "@mariozechner/mini-lit/dist/Dialog.js";
import { DialogBase } from "@mariozechner/mini-lit/dist/DialogBase.js";
import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { i18n } from "../utils/i18n.js";

/**
 * Detect if the user is on macOS
 */
function isMac(): boolean {
	return typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
}

/**
 * Format a modifier key for display
 */
function formatModifier(mod: "cmd" | "shift" | "alt"): string {
	const mac = isMac();
	switch (mod) {
		case "cmd":
			return mac ? "⌘" : "Ctrl+";
		case "shift":
			return mac ? "⇧" : "Shift+";
		case "alt":
			return mac ? "⌥" : "Alt+";
	}
}

/**
 * Format a key combination for display
 */
function formatShortcut(mods: Array<"cmd" | "shift" | "alt">, key: string): string {
	const modStr = mods.map(formatModifier).join("");
	return `${modStr}${key}`;
}

interface ShortcutEntry {
	keys: string;
	description: string;
}

interface ShortcutCategory {
	title: string;
	shortcuts: ShortcutEntry[];
}

/**
 * Get all shortcuts grouped by category
 */
function getShortcuts(): ShortcutCategory[] {
	return [
		{
			title: i18n("Navigation"),
			shortcuts: [
				{ keys: formatShortcut(["cmd"], "B"), description: i18n("Toggle sidebar") },
				{ keys: formatShortcut(["cmd"], "K"), description: i18n("Search") },
				{ keys: "Escape", description: i18n("Close panels") },
			],
		},
		{
			title: i18n("Chat"),
			shortcuts: [
				{ keys: formatShortcut(["cmd"], "N"), description: i18n("New chat") },
				{ keys: formatShortcut(["cmd"], "F"), description: i18n("Find in conversation") },
				{ keys: "Enter", description: i18n("Send message") },
				{ keys: formatShortcut(["shift"], "Enter"), description: i18n("New line") },
			],
		},
		{
			title: i18n("Find"),
			shortcuts: [
				{ keys: "F3", description: i18n("Next match") },
				{ keys: formatShortcut(["shift"], "F3"), description: i18n("Previous match") },
			],
		},
		{
			title: i18n("Help"),
			shortcuts: [{ keys: formatShortcut(["cmd"], "/"), description: i18n("Show keyboard shortcuts") }],
		},
	];
}

@customElement("shortcuts-help-dialog")
export class ShortcutsHelpDialog extends DialogBase {
	protected modalWidth = "min(500px, 90vw)";
	protected modalHeight = "auto";

	static open() {
		const dialog = new ShortcutsHelpDialog();
		dialog.open();
	}

	private renderShortcutRow(shortcut: ShortcutEntry) {
		return html`
			<div class="flex justify-between items-center py-1.5">
				<kbd class="px-2 py-1 text-xs font-mono bg-muted rounded border border-border text-foreground">
					${shortcut.keys}
				</kbd>
				<span class="text-sm text-muted-foreground">${shortcut.description}</span>
			</div>
		`;
	}

	private renderCategory(category: ShortcutCategory) {
		return html`
			<div class="mb-4">
				<h3 class="text-sm font-semibold text-foreground mb-2">${category.title}</h3>
				<div class="space-y-1">
					${category.shortcuts.map((s) => this.renderShortcutRow(s))}
				</div>
			</div>
		`;
	}

	protected override renderContent() {
		const categories = getShortcuts();

		return html`
			${DialogContent({
				className: "flex flex-col",
				children: html`
					${DialogHeader({
						title: i18n("Keyboard Shortcuts"),
					})}

					<div class="mt-4 max-h-[60vh] overflow-y-auto">
						${categories.map((cat) => this.renderCategory(cat))}
					</div>

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
