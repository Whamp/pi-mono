/**
 * Keyboard shortcuts utility for global and contextual shortcuts.
 * Platform-aware: uses Cmd on macOS, Ctrl on Windows/Linux.
 */

export interface KeyboardShortcut {
	key: string; // The key (b, n, k, Escape, etc.)
	ctrl?: boolean; // Require Ctrl (Windows/Linux)
	meta?: boolean; // Require Cmd (Mac)
	shift?: boolean; // Require Shift
	alt?: boolean; // Require Alt/Option
	handler: () => void;
	description?: string;
}

export interface ShortcutManager {
	register(shortcut: KeyboardShortcut): void;
	unregister(key: string): void;
	attach(): void;
	detach(): void;
}

/**
 * Creates a keyboard shortcut manager that handles global keyboard shortcuts.
 * Shortcuts are platform-aware, treating Cmd (meta) and Ctrl as a unified "mod" key.
 */
export function createShortcutManager(): ShortcutManager {
	const shortcuts: Map<string, KeyboardShortcut> = new Map();

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
	};
}
