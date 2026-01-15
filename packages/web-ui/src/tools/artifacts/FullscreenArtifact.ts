import { icon } from "@mariozechner/mini-lit";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { CopyButton } from "@mariozechner/mini-lit/dist/CopyButton.js";
import { DownloadButton } from "@mariozechner/mini-lit/dist/DownloadButton.js";
import { html, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, type Ref, ref } from "lit/directives/ref.js";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide";
import { i18n } from "../../utils/i18n.js";
import type { ArtifactElement } from "./ArtifactElement.js";
import type { Artifact } from "./artifacts.js";

@customElement("fullscreen-artifact")
export class FullscreenArtifact extends LitElement {
	@property({ attribute: false }) artifact: Artifact | null = null;
	@property({ attribute: false }) allArtifacts: Artifact[] = [];
	@property({ attribute: false }) onClose?: () => void;
	@property({ attribute: false }) getArtifactElement?: (filename: string) => ArtifactElement | undefined;

	@state() private currentArtifactElement: ArtifactElement | null = null;
	private contentRef: Ref<HTMLDivElement> = createRef();
	private originalParent: HTMLElement | null = null;
	private originalNextSibling: Node | null = null;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this; // light DOM for shared styles
	}

	override connectedCallback(): void {
		super.connectedCallback();
		// Add escape key listener
		document.addEventListener("keydown", this.handleKeyDown);
		// Move artifact element into fullscreen on next frame
		requestAnimationFrame(() => this.attachArtifactElement());
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("keydown", this.handleKeyDown);
		// Restore artifact element to original position
		this.restoreArtifactElement();
	}

	private attachArtifactElement() {
		if (!this.artifact || !this.getArtifactElement) return;

		const element = this.getArtifactElement(this.artifact.filename);
		if (!element || !this.contentRef.value) return;

		// Store original position for restoration
		this.originalParent = element.parentElement;
		this.originalNextSibling = element.nextSibling;

		// Move element to fullscreen content area
		this.contentRef.value.appendChild(element);
		element.style.display = "block";
		element.style.height = "100%";
		this.currentArtifactElement = element;
	}

	private restoreArtifactElement() {
		if (!this.currentArtifactElement || !this.originalParent) return;

		// Restore element to original position
		if (this.originalNextSibling) {
			this.originalParent.insertBefore(this.currentArtifactElement, this.originalNextSibling);
		} else {
			this.originalParent.appendChild(this.currentArtifactElement);
		}

		this.currentArtifactElement = null;
		this.originalParent = null;
		this.originalNextSibling = null;
	}

	private handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault();
			this.onClose?.();
		}
	};

	private getCurrentIndex(): number {
		if (!this.artifact) return -1;
		return this.allArtifacts.findIndex((a) => a.filename === this.artifact?.filename);
	}

	private handlePrevious() {
		const index = this.getCurrentIndex();
		if (index > 0) {
			// First restore current element
			this.restoreArtifactElement();
			// Then dispatch navigate event
			this.dispatchEvent(
				new CustomEvent("navigate", {
					detail: { filename: this.allArtifacts[index - 1].filename },
					bubbles: true,
					composed: true,
				}),
			);
			// Attach new element on next frame after artifact property updates
			requestAnimationFrame(() => this.attachArtifactElement());
		}
	}

	private handleNext() {
		const index = this.getCurrentIndex();
		if (index >= 0 && index < this.allArtifacts.length - 1) {
			// First restore current element
			this.restoreArtifactElement();
			// Then dispatch navigate event
			this.dispatchEvent(
				new CustomEvent("navigate", {
					detail: { filename: this.allArtifacts[index + 1].filename },
					bubbles: true,
					composed: true,
				}),
			);
			// Attach new element on next frame after artifact property updates
			requestAnimationFrame(() => this.attachArtifactElement());
		}
	}

	private getDownloadMimeType(filename: string): string {
		const ext = filename.split(".").pop()?.toLowerCase();
		switch (ext) {
			case "html":
				return "text/html";
			case "svg":
				return "image/svg+xml";
			case "md":
			case "markdown":
				return "text/markdown";
			case "json":
				return "application/json";
			case "css":
				return "text/css";
			case "js":
				return "application/javascript";
			case "ts":
				return "application/typescript";
			default:
				return "text/plain";
		}
	}

	override render(): TemplateResult {
		if (!this.artifact) {
			return html``;
		}

		const currentIndex = this.getCurrentIndex();
		const hasPrevious = currentIndex > 0;
		const hasNext = currentIndex < this.allArtifacts.length - 1;

		return html`
			<div class="fixed inset-0 z-50 flex flex-col bg-background">
				<!-- Header -->
				<div class="flex items-center justify-between border-b border-border bg-background px-4 py-3">
					<div class="flex items-center gap-3">
						${Button({
							variant: "ghost",
							size: "sm",
							onClick: () => this.onClose?.(),
							title: i18n("Back"),
							children: html`${icon(ArrowLeft, "sm")} <span class="ml-1">${i18n("Back")}</span>`,
						})}
						<span class="font-mono text-sm font-medium">${this.artifact.filename}</span>
					</div>
					<div class="flex items-center gap-2">
						${(() => {
							const copyButton = new CopyButton();
							copyButton.text = this.artifact?.content ?? "";
							copyButton.title = i18n("Copy");
							copyButton.showText = false;
							return copyButton;
						})()}
						${DownloadButton({
							content: this.artifact.content,
							filename: this.artifact.filename,
							mimeType: this.getDownloadMimeType(this.artifact.filename),
							title: i18n("Download"),
						})}
						${Button({
							variant: "ghost",
							size: "sm",
							onClick: () => this.onClose?.(),
							title: i18n("Close"),
							children: icon(X, "sm"),
						})}
					</div>
				</div>

				<!-- Content area - artifact element will be moved here programmatically -->
				<div class="flex-1 overflow-hidden" ${ref(this.contentRef)}></div>

				<!-- Footer with navigation -->
				<div class="flex items-center justify-between border-t border-border bg-background px-4 py-3">
					<div>
						${
							hasPrevious
								? Button({
										variant: "outline",
										size: "sm",
										onClick: () => this.handlePrevious(),
										children: html`${icon(ChevronLeft, "sm")} <span class="ml-1">${i18n("Previous")}</span>`,
									})
								: html`<div></div>`
						}
					</div>
					<div>
						${
							hasNext
								? Button({
										variant: "outline",
										size: "sm",
										onClick: () => this.handleNext(),
										children: html`<span class="mr-1">${i18n("Next")}</span> ${icon(ChevronRight, "sm")}`,
									})
								: html`<div></div>`
						}
					</div>
				</div>
			</div>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"fullscreen-artifact": FullscreenArtifact;
	}
}
