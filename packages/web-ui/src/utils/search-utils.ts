/**
 * Search utility functions for highlighting matches in text
 */

export interface SearchOptions {
	caseSensitive: boolean;
	regex: boolean;
}

export interface HighlightResult {
	html: string;
	matchCount: number;
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlights all matches of a query in the given text.
 * Returns HTML with `<mark class="search-match">` for all matches,
 * and optionally `<mark class="search-match search-match-current">` for the current match.
 *
 * @param text - The text to search in
 * @param query - The search query
 * @param options - Search options (caseSensitive, regex)
 * @param currentMatchIndex - Optional index of the current match to highlight differently (0-based, within this text)
 * @returns Object with html string and matchCount
 */
export function highlightMatches(
	text: string,
	query: string,
	options: SearchOptions,
	currentMatchIndex?: number,
): HighlightResult {
	if (!query || !text) {
		return { html: escapeHtml(text), matchCount: 0 };
	}

	// Build regex from query
	let regex: RegExp;
	try {
		if (options.regex) {
			const flags = options.caseSensitive ? "g" : "gi";
			regex = new RegExp(query, flags);
		} else {
			const flags = options.caseSensitive ? "g" : "gi";
			regex = new RegExp(escapeRegex(query), flags);
		}
	} catch {
		// Invalid regex - return escaped text with no matches
		return { html: escapeHtml(text), matchCount: 0 };
	}

	// Find all matches first to get count
	const matches: Array<{ start: number; end: number; text: string }> = [];
	let match: RegExpExecArray | null = null;

	while (true) {
		match = regex.exec(text);
		if (match === null) break;

		matches.push({
			start: match.index,
			end: match.index + match[0].length,
			text: match[0],
		});

		// Prevent infinite loop for zero-length matches
		if (match[0].length === 0) {
			regex.lastIndex++;
		}
	}

	if (matches.length === 0) {
		return { html: escapeHtml(text), matchCount: 0 };
	}

	// Build HTML with highlighted matches
	let html = "";
	let lastIndex = 0;

	for (let i = 0; i < matches.length; i++) {
		const m = matches[i];

		// Add text before this match
		if (m.start > lastIndex) {
			html += escapeHtml(text.slice(lastIndex, m.start));
		}

		// Add the match with highlight
		const isCurrent = currentMatchIndex !== undefined && i === currentMatchIndex;
		const className = isCurrent ? "search-match search-match-current" : "search-match";
		html += `<mark class="${className}">${escapeHtml(m.text)}</mark>`;

		lastIndex = m.end;
	}

	// Add remaining text after last match
	if (lastIndex < text.length) {
		html += escapeHtml(text.slice(lastIndex));
	}

	return { html, matchCount: matches.length };
}

/**
 * Counts the number of matches in a text without generating HTML
 */
export function countMatches(text: string, query: string, options: SearchOptions): number {
	if (!query || !text) {
		return 0;
	}

	try {
		let regex: RegExp;
		if (options.regex) {
			const flags = options.caseSensitive ? "g" : "gi";
			regex = new RegExp(query, flags);
		} else {
			const flags = options.caseSensitive ? "g" : "gi";
			regex = new RegExp(escapeRegex(query), flags);
		}

		const matches = text.match(regex);
		return matches ? matches.length : 0;
	} catch {
		return 0;
	}
}
