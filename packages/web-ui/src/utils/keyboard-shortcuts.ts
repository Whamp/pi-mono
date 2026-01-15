/**
 * Keyboard shortcuts utility for global and contextual shortcuts.
 * Platform-aware: uses Cmd on macOS, Ctrl on Windows/Linux.
 */

export type ShortcutContext = "global" | "sidebar" | "artifacts" | "input" | "chat" | "dialog";

export interface KeyboardShortcut {
	key: string; // The key (b, n, k, Escape, etc.)
	ctrl?: boolean; // Require Ctrl (Windows/Linux)
	meta?: boolean; // Require Cmd (Mac)
	shift?: boolean; // Require Shift
	alt?: boolean; // Require Alt/Option
	handler: () => void;
	description?: string;
	context?: ShortcutContext; // Optional context - if set, shortcut only fires in that context
}

export interface ShortcutManager {
	register(shortcut: KeyboardShortcut): void;
	unregister(key: string): void;
	attach(): void;
	detach(): void;
	setContext(context: ShortcutContext): void;
	getContext(): ShortcutContext;
}

/**
 * Creates a keyboard shortcut manager that handles global keyboard shortcuts.
 * Shortcuts are platform-aware, treating Cmd (meta) and Ctrl as a unified "mod" key.
 */
export function createShortcutManager(): ShortcutManager {
	const shortcuts: Map<string, KeyboardShortcut> = new Map();
	let currentContext: ShortcutContext = "global";

	const getKey = (e: KeyboardEvent): string => {
		const parts: string[] = [];
		if (e.ctrlKey || e.metaKey) parts.push("mod");
		if (e.shiftKey) parts.push("shift");
		if (e.altKey) parts.push("alt");
		parts.push(e.key.toLowerCase());
		return parts.join("+");
	};

	const handleKeydown = (e: KeyboardEvent) => {
		// Don't trigger in input fields (except Escape)
		const target = e.target as HTMLElement;
		const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

		const key = getKey(e);
		const shortcut = shortcuts.get(key);

		if (shortcut) {
			// Check context - if shortcut has a context, it must match current context
			if (shortcut.context && shortcut.context !== currentContext && shortcut.context !== "global") {
				return;
			}

			if (isInput && e.key !== "Escape") return;

			e.preventDefault();
			shortcut.handler();
		}
	};

	return {
		register(shortcut: KeyboardShortcut) {
			const parts: string[] = [];
			if (shortcut.ctrl || shortcut.meta) parts.push("mod");
			if (shortcut.shift) parts.push("shift");
			if (shortcut.alt) parts.push("alt");
			parts.push(shortcut.key.toLowerCase());
			shortcuts.set(parts.join("+"), shortcut);
		},
		unregister(key: string) {
			shortcuts.delete(key);
		},
		attach() {
			document.addEventListener("keydown", handleKeydown);
		},
		detach() {
			document.removeEventListener("keydown", handleKeydown);
		},
		setContext(context: ShortcutContext) {
			currentContext = context;
		},
		getContext() {
			return currentContext;
		},
	};
}

/**
 * Creates a context-aware shortcut handler for a specific element.
 * Shortcuts registered here only fire when the element (or its children) has focus.
 */
export interface ContextualShortcutHandler {
	register(shortcut: Omit<KeyboardShortcut, "context">): void;
	unregister(key: string): void;
	attach(element: HTMLElement): void;
	detach(): void;
}

export function createContextualShortcutHandler(): ContextualShortcutHandler {
	const shortcuts: Map<string, KeyboardShortcut> = new Map();
	let boundElement: HTMLElement | null = null;

	const getKey = (e: KeyboardEvent): string => {
		const parts: string[] = [];
		if (e.ctrlKey || e.metaKey) parts.push("mod");
		if (e.shiftKey) parts.push("shift");
		if (e.altKey) parts.push("alt");
		parts.push(e.key.toLowerCase());
		return parts.join("+");
	};

	const handleKeydown = (e: KeyboardEvent) => {
		const key = getKey(e);
		const shortcut = shortcuts.get(key);

		if (shortcut) {
			e.preventDefault();
			e.stopPropagation();
			shortcut.handler();
		}
	};

	return {
		register(shortcut: Omit<KeyboardShortcut, "context">) {
			const parts: string[] = [];
			if (shortcut.ctrl || shortcut.meta) parts.push("mod");
			if (shortcut.shift) parts.push("shift");
			if (shortcut.alt) parts.push("alt");
			parts.push(shortcut.key.toLowerCase());
			shortcuts.set(parts.join("+"), shortcut as KeyboardShortcut);
		},
		unregister(key: string) {
			shortcuts.delete(key);
		},
		attach(element: HTMLElement) {
			boundElement = element;
			element.addEventListener("keydown", handleKeydown);
		},
		detach() {
			if (boundElement) {
				boundElement.removeEventListener("keydown", handleKeydown);
				boundElement = null;
			}
		},
	};
}
