import { CopyButton } from "@mariozechner/mini-lit/dist/CopyButton.js";
import { DownloadButton } from "@mariozechner/mini-lit/dist/DownloadButton.js";
import { html, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { i18n } from "../../utils/i18n.js";
import { showToast } from "../../utils/toast.js";
import { ArtifactElement } from "./ArtifactElement.js";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

@customElement("json-viewer")
export class JsonViewer extends ArtifactElement {
	@property() override filename = "";

	@state() private _content = "";
	@state() private collapsedPaths = new Set<string>();
	@state() private parsedJson: JsonValue | undefined = undefined;
	@state() private parseError: string | null = null;

	override get content(): string {
		return this._content;
	}

	override set content(value: string) {
		this._content = value;
		this.parseJson();
		this.requestUpdate();
	}

	private parseJson(): void {
		try {
			this.parsedJson = JSON.parse(this._content) as JsonValue;
			this.parseError = null;
		} catch (e) {
			this.parsedJson = undefined;
			this.parseError = e instanceof Error ? e.message : "Failed to parse JSON";
		}
	}

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this; // light DOM
	}

	public getHeaderButtons(): TemplateResult {
		const copyButton = new CopyButton();
		copyButton.text = this.content;
		copyButton.title = i18n("Copy");
		copyButton.showText = false;

		return html`
			<div class="flex items-center gap-1">
				${copyButton}
				${DownloadButton({
					content: this.content,
					filename: this.filename,
					mimeType: "application/json",
					title: i18n("Download"),
				})}
			</div>
		`;
	}

	private toggleNode(path: string): void {
		if (this.collapsedPaths.has(path)) {
			this.collapsedPaths.delete(path);
		} else {
			this.collapsedPaths.add(path);
		}
		this.requestUpdate();
	}

	private copyPath(path: string): void {
		navigator.clipboard.writeText(path).then(() => {
			showToast({
				message: i18n("Copied path: {path}").replace("{path}", path),
				variant: "success",
				duration: 2000,
			});
		});
	}

	private renderValue(value: JsonValue, path: string, indent: number): TemplateResult {
		if (value === null) {
			return html`<span
				class="text-muted-foreground cursor-pointer hover:underline"
				@click=${() => this.copyPath(path)}
				title=${i18n("Click to copy path")}
				>null</span
			>`;
		}

		if (typeof value === "boolean") {
			return html`<span
				class="text-purple-500 dark:text-purple-400 cursor-pointer hover:underline"
				@click=${() => this.copyPath(path)}
				title=${i18n("Click to copy path")}
				>${String(value)}</span
			>`;
		}

		if (typeof value === "number") {
			return html`<span
				class="text-blue-500 dark:text-blue-400 cursor-pointer hover:underline"
				@click=${() => this.copyPath(path)}
				title=${i18n("Click to copy path")}
				>${value}</span
			>`;
		}

		if (typeof value === "string") {
			return html`<span
				class="text-green-600 dark:text-green-400 cursor-pointer hover:underline"
				@click=${() => this.copyPath(path)}
				title=${i18n("Click to copy path")}
				>"${value}"</span
			>`;
		}

		if (Array.isArray(value)) {
			return this.renderArray(value, path, indent);
		}

		if (typeof value === "object") {
			return this.renderObject(value, path, indent);
		}

		return html`<span>${String(value)}</span>`;
	}

	private renderArray(arr: JsonValue[], path: string, indent: number): TemplateResult {
		const isCollapsed = this.collapsedPaths.has(path);
		const count = arr.length;
		const indentStr = "  ".repeat(indent);
		const childIndent = "  ".repeat(indent + 1);

		if (count === 0) {
			return html`<span
				class="cursor-pointer hover:underline"
				@click=${() => this.copyPath(path)}
				title=${i18n("Click to copy path")}
				>[]</span
			>`;
		}

		if (isCollapsed) {
			return html`<span class="inline-flex items-baseline gap-1">
				<button
					class="text-muted-foreground hover:text-foreground cursor-pointer border-none bg-transparent p-0 font-mono text-xs leading-none"
					@click=${() => this.toggleNode(path)}
					title=${i18n("Expand")}
				>
					▶
				</button>
				<span
					class="text-muted-foreground cursor-pointer hover:underline"
					@click=${() => this.copyPath(path)}
					title=${i18n("Click to copy path")}
					>[ ${count} ${count === 1 ? i18n("item") : i18n("items")} ]</span
				>
			</span>`;
		}

		return html`<span class="inline-flex items-baseline gap-1">
				<button
					class="text-muted-foreground hover:text-foreground cursor-pointer border-none bg-transparent p-0 font-mono text-xs leading-none"
					@click=${() => this.toggleNode(path)}
					title=${i18n("Collapse")}
				>
					▼
				</button>
				<span>[</span> </span
			>${arr.map((item, index) => {
				const childPath = `${path}[${index}]`;
				return html`<div>${childIndent}${this.renderValue(item, childPath, indent + 1)}${index < arr.length - 1 ? "," : ""}</div>`;
			})}
			<div>${indentStr}]</div>`;
	}

	private renderObject(obj: { [key: string]: JsonValue }, path: string, indent: number): TemplateResult {
		const isCollapsed = this.collapsedPaths.has(path);
		const keys = Object.keys(obj);
		const count = keys.length;
		const indentStr = "  ".repeat(indent);
		const childIndent = "  ".repeat(indent + 1);

		if (count === 0) {
			return html`<span
				class="cursor-pointer hover:underline"
				@click=${() => this.copyPath(path)}
				title=${i18n("Click to copy path")}
				>{}</span
			>`;
		}

		if (isCollapsed) {
			return html`<span class="inline-flex items-baseline gap-1">
				<button
					class="text-muted-foreground hover:text-foreground cursor-pointer border-none bg-transparent p-0 font-mono text-xs leading-none"
					@click=${() => this.toggleNode(path)}
					title=${i18n("Expand")}
				>
					▶
				</button>
				<span
					class="text-muted-foreground cursor-pointer hover:underline"
					@click=${() => this.copyPath(path)}
					title=${i18n("Click to copy path")}
					>{ ${count} ${count === 1 ? i18n("item") : i18n("items")} }</span
				>
			</span>`;
		}

		return html`<span class="inline-flex items-baseline gap-1">
				<button
					class="text-muted-foreground hover:text-foreground cursor-pointer border-none bg-transparent p-0 font-mono text-xs leading-none"
					@click=${() => this.toggleNode(path)}
					title=${i18n("Collapse")}
				>
					▼
				</button>
				<span>{</span> </span
			>${keys.map((key, index) => {
				const childPath = path ? `${path}.${key}` : key;
				const value = obj[key];
				return html`<div>
					${childIndent}<span class="text-foreground">"${key}"</span>: ${this.renderValue(value, childPath, indent + 1)}${index < keys.length - 1 ? "," : ""}
				</div>`;
			})}
			<div>${indentStr}}</div>`;
	}

	override render(): TemplateResult {
		if (this.parseError) {
			// Fallback to plain text display if JSON is invalid
			return html`
				<div class="h-full flex flex-col">
					<div class="p-2 bg-destructive/10 text-destructive text-xs border-b border-border">
						${i18n("Invalid JSON")}: ${this.parseError}
					</div>
					<div class="flex-1 overflow-auto">
						<pre class="m-0 p-4 text-xs font-mono">${this._content}</pre>
					</div>
				</div>
			`;
		}

		return html`
			<div class="h-full flex flex-col">
				<div class="flex-1 overflow-auto">
					<pre class="m-0 p-4 text-xs font-mono leading-relaxed">${this.renderValue(this.parsedJson as JsonValue, "", 0)}</pre>
				</div>
			</div>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"json-viewer": JsonViewer;
	}
}
