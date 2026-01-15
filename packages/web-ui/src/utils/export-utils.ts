export interface ExportableSession {
	id: string;
	title: string;
	messages: unknown[]; // The actual message data
	metadata?: {
		createdAt?: string;
		lastModified?: string;
		model?: string;
		[key: string]: unknown;
	};
}

/**
 * Export a session as a JSON file download
 * @param session The session data to export
 * @param filename Optional filename (defaults to session title or id)
 */
export function exportSessionAsJson(session: ExportableSession, filename?: string): void {
	const data = JSON.stringify(session, null, 2);
	const blob = new Blob([data], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const sanitizedTitle = (filename || session.title || session.id).replace(/[^a-z0-9]/gi, "_").substring(0, 50);

	const a = document.createElement("a");
	a.href = url;
	a.download = `${sanitizedTitle}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(timestamp?: string): string {
	if (!timestamp) return "";
	try {
		const date = new Date(timestamp);
		return date.toLocaleString();
	} catch {
		return timestamp;
	}
}

/**
 * Apply basic syntax highlighting to code
 * Note: language parameter is available for future language-specific highlighting
 */
function highlightCode(code: string, _language: string): string {
	const escaped = escapeHtml(code);

	// Basic keyword highlighting for common languages
	const keywords = [
		"function",
		"const",
		"let",
		"var",
		"return",
		"if",
		"else",
		"for",
		"while",
		"class",
		"import",
		"export",
		"from",
		"async",
		"await",
		"try",
		"catch",
		"throw",
		"new",
		"this",
		"true",
		"false",
		"null",
		"undefined",
		"typeof",
		"instanceof",
		"def",
		"elif",
		"except",
		"finally",
		"lambda",
		"pass",
		"raise",
		"with",
		"yield",
		"None",
		"True",
		"False",
		"and",
		"or",
		"not",
		"in",
		"is",
		"fn",
		"pub",
		"mod",
		"use",
		"struct",
		"enum",
		"impl",
		"trait",
		"match",
		"mut",
		"ref",
		"self",
		"Self",
		"where",
	];

	let highlighted = escaped;

	// Highlight strings (single and double quotes)
	highlighted = highlighted.replace(
		/(&quot;[^&]*&quot;|&#039;[^&]*&#039;|"[^"]*"|'[^']*')/g,
		'<span class="string">$1</span>',
	);

	// Highlight comments (single line)
	highlighted = highlighted.replace(/(\/\/.*$|#.*$)/gm, '<span class="comment">$1</span>');

	// Highlight numbers
	highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>');

	// Highlight keywords
	for (const keyword of keywords) {
		const regex = new RegExp(`\\b(${keyword})\\b`, "g");
		highlighted = highlighted.replace(regex, '<span class="keyword">$1</span>');
	}

	return highlighted;
}

/**
 * Extract text content from message content blocks
 */
function extractTextFromContent(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}
	if (Array.isArray(content)) {
		return content
			.map((block) => {
				if (typeof block === "string") return block;
				if (block && typeof block === "object" && "type" in block) {
					const typedBlock = block as { type: string; text?: string };
					if (typedBlock.type === "text" && typedBlock.text) {
						return typedBlock.text;
					}
				}
				return "";
			})
			.join("\n");
	}
	return "";
}

/**
 * Parse markdown-style code blocks and format content
 */
function formatMessageContent(content: string): string {
	const lines = content.split("\n");
	const result: string[] = [];
	let inCodeBlock = false;
	let codeBlockLang = "";
	let codeLines: string[] = [];

	for (const line of lines) {
		if (line.startsWith("```")) {
			if (!inCodeBlock) {
				// Starting a code block
				inCodeBlock = true;
				codeBlockLang = line.slice(3).trim() || "text";
				codeLines = [];
			} else {
				// Ending a code block
				const code = codeLines.join("\n");
				const highlighted = highlightCode(code, codeBlockLang);
				result.push(
					`<div class="code-block"><div class="code-header">${escapeHtml(codeBlockLang)}</div><pre><code>${highlighted}</code></pre></div>`,
				);
				inCodeBlock = false;
				codeBlockLang = "";
			}
		} else if (inCodeBlock) {
			codeLines.push(line);
		} else {
			// Regular text - escape and add line breaks
			result.push(escapeHtml(line));
		}
	}

	// Handle unclosed code block
	if (inCodeBlock && codeLines.length > 0) {
		const code = codeLines.join("\n");
		const highlighted = highlightCode(code, codeBlockLang);
		result.push(
			`<div class="code-block"><div class="code-header">${escapeHtml(codeBlockLang)}</div><pre><code>${highlighted}</code></pre></div>`,
		);
	}

	return result.join("<br>");
}

/**
 * Render tool call information
 */
function renderToolCall(toolCall: { id?: string; name?: string; arguments?: unknown }): string {
	const name = toolCall.name || "unknown";
	const args = toolCall.arguments;
	let argsStr = "";
	try {
		argsStr = typeof args === "string" ? args : JSON.stringify(args, null, 2);
	} catch {
		argsStr = String(args);
	}

	return `
		<div class="tool-call">
			<div class="tool-header">Tool: ${escapeHtml(name)}</div>
			<pre class="tool-args"><code>${escapeHtml(argsStr)}</code></pre>
		</div>
	`;
}

/**
 * Render a single message as HTML
 */
function renderMessage(message: unknown): string {
	if (!message || typeof message !== "object") return "";

	const msg = message as {
		role?: string;
		content?: unknown;
		timestamp?: string;
		tool_calls?: Array<{ id?: string; name?: string; arguments?: unknown }>;
		tool_call_id?: string;
	};

	const role = msg.role || "unknown";
	const timestamp = formatTimestamp(msg.timestamp);
	const textContent = extractTextFromContent(msg.content);

	let roleClass = "message-unknown";
	let roleLabel = "Unknown";

	switch (role) {
		case "user":
			roleClass = "message-user";
			roleLabel = "You";
			break;
		case "assistant":
			roleClass = "message-assistant";
			roleLabel = "Assistant";
			break;
		case "tool_result":
			roleClass = "message-tool-result";
			roleLabel = "Tool Result";
			break;
		default:
			roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
	}

	let html = `<div class="message ${roleClass}">`;
	html += `<div class="message-header">`;
	html += `<span class="message-role">${escapeHtml(roleLabel)}</span>`;
	if (timestamp) {
		html += `<span class="message-time">${escapeHtml(timestamp)}</span>`;
	}
	html += `</div>`;

	// Render content
	if (textContent) {
		html += `<div class="message-content">${formatMessageContent(textContent)}</div>`;
	}

	// Render tool calls if present
	if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
		for (const tc of msg.tool_calls) {
			html += renderToolCall(tc);
		}
	}

	// For tool results, show the tool call id
	if (role === "tool_result" && msg.tool_call_id) {
		html += `<div class="tool-call-id">Tool Call ID: ${escapeHtml(msg.tool_call_id)}</div>`;
	}

	html += `</div>`;
	return html;
}

/**
 * Generate the CSS styles for the HTML export
 */
function getExportStyles(): string {
	return `
		:root {
			--bg-color: #ffffff;
			--text-color: #1a1a1a;
			--text-muted: #666666;
			--border-color: #e5e5e5;
			--user-bg: #e3f2fd;
			--user-border: #90caf9;
			--assistant-bg: #f5f5f5;
			--assistant-border: #e0e0e0;
			--tool-bg: #fff3e0;
			--tool-border: #ffcc80;
			--code-bg: #f8f8f8;
			--code-border: #ddd;
			--keyword-color: #0077aa;
			--string-color: #669900;
			--number-color: #990055;
			--comment-color: #708090;
		}

		* {
			box-sizing: border-box;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			line-height: 1.6;
			color: var(--text-color);
			background: var(--bg-color);
			max-width: 900px;
			margin: 0 auto;
			padding: 2rem;
		}

		.header {
			border-bottom: 2px solid var(--border-color);
			padding-bottom: 1.5rem;
			margin-bottom: 2rem;
		}

		.header h1 {
			margin: 0 0 0.5rem 0;
			font-size: 1.75rem;
			font-weight: 600;
		}

		.metadata {
			color: var(--text-muted);
			font-size: 0.875rem;
		}

		.metadata span {
			display: inline-block;
			margin-right: 1.5rem;
		}

		.messages {
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}

		.message {
			padding: 1rem;
			border-radius: 8px;
			border-left: 4px solid;
		}

		.message-user {
			background: var(--user-bg);
			border-color: var(--user-border);
		}

		.message-assistant {
			background: var(--assistant-bg);
			border-color: var(--assistant-border);
		}

		.message-tool-result {
			background: var(--tool-bg);
			border-color: var(--tool-border);
		}

		.message-unknown {
			background: var(--assistant-bg);
			border-color: var(--border-color);
		}

		.message-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 0.5rem;
		}

		.message-role {
			font-weight: 600;
			font-size: 0.875rem;
		}

		.message-time {
			color: var(--text-muted);
			font-size: 0.75rem;
		}

		.message-content {
			white-space: pre-wrap;
			word-wrap: break-word;
		}

		.code-block {
			margin: 1rem 0;
			border-radius: 6px;
			overflow: hidden;
			border: 1px solid var(--code-border);
		}

		.code-header {
			background: var(--border-color);
			padding: 0.25rem 0.75rem;
			font-size: 0.75rem;
			color: var(--text-muted);
			font-family: monospace;
		}

		.code-block pre {
			margin: 0;
			padding: 1rem;
			background: var(--code-bg);
			overflow-x: auto;
		}

		.code-block code {
			font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
			font-size: 0.875rem;
			line-height: 1.5;
		}

		.keyword { color: var(--keyword-color); font-weight: 500; }
		.string { color: var(--string-color); }
		.number { color: var(--number-color); }
		.comment { color: var(--comment-color); font-style: italic; }

		.tool-call {
			margin-top: 0.75rem;
			padding: 0.75rem;
			background: rgba(0,0,0,0.03);
			border-radius: 4px;
		}

		.tool-header {
			font-weight: 600;
			font-size: 0.875rem;
			margin-bottom: 0.5rem;
			color: var(--text-muted);
		}

		.tool-args {
			margin: 0;
			padding: 0.5rem;
			background: var(--code-bg);
			border-radius: 4px;
			font-size: 0.8rem;
			overflow-x: auto;
		}

		.tool-args code {
			font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
		}

		.tool-call-id {
			margin-top: 0.5rem;
			font-size: 0.75rem;
			color: var(--text-muted);
		}

		@media print {
			body {
				padding: 0;
				max-width: none;
			}
			.message {
				break-inside: avoid;
			}
		}
	`;
}

/**
 * Export a session as a formatted HTML file download
 * @param session The session data to export
 * @param filename Optional filename (defaults to session title or id)
 */
export function exportSessionAsHtml(session: ExportableSession, filename?: string): void {
	const sanitizedTitle = (filename || session.title || session.id).replace(/[^a-z0-9]/gi, "_").substring(0, 50);
	const displayTitle = session.title || session.id;

	// Build metadata section
	const metadata: string[] = [];
	if (session.metadata?.createdAt) {
		metadata.push(
			`<span><strong>Created:</strong> ${escapeHtml(formatTimestamp(session.metadata.createdAt))}</span>`,
		);
	}
	if (session.metadata?.lastModified) {
		metadata.push(
			`<span><strong>Modified:</strong> ${escapeHtml(formatTimestamp(session.metadata.lastModified))}</span>`,
		);
	}
	if (session.metadata?.model) {
		metadata.push(`<span><strong>Model:</strong> ${escapeHtml(String(session.metadata.model))}</span>`);
	}
	metadata.push(`<span><strong>Messages:</strong> ${session.messages.length}</span>`);

	// Render all messages
	const messagesHtml = session.messages.map((msg) => renderMessage(msg)).join("\n");

	// Build the full HTML document
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(displayTitle)} - Chat Export</title>
	<style>${getExportStyles()}</style>
</head>
<body>
	<div class="header">
		<h1>${escapeHtml(displayTitle)}</h1>
		<div class="metadata">${metadata.join("\n")}</div>
	</div>
	<div class="messages">
		${messagesHtml}
	</div>
</body>
</html>`;

	// Trigger download
	const blob = new Blob([html], { type: "text/html;charset=utf-8" });
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = `${sanitizedTitle}.html`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
