/**
 * Prompt discovery and registration
 *
 * Autodiscovers prompt templates from the extension's prompts/ directory
 * and registers them as commands. Users can invoke them like /implement <task>
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface PromptConfig {
	name: string;
	description: string;
	template: string;
	filePath: string;
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
	const frontmatter: Record<string, string> = {};
	const normalized = content.replace(/\r\n/g, "\n");

	if (!normalized.startsWith("---")) {
		return { frontmatter, body: normalized };
	}

	const endIndex = normalized.indexOf("\n---", 3);
	if (endIndex === -1) {
		return { frontmatter, body: normalized };
	}

	const frontmatterBlock = normalized.slice(4, endIndex);
	const body = normalized.slice(endIndex + 4).trim();

	for (const line of frontmatterBlock.split("\n")) {
		const match = line.match(/^([\w-]+):\s*(.*)$/);
		if (match) {
			let value = match[2].trim();
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}
			frontmatter[match[1]] = value;
		}
	}

	return { frontmatter, body };
}

function loadPromptsFromDir(dir: string): PromptConfig[] {
	const prompts: PromptConfig[] = [];

	if (!fs.existsSync(dir)) {
		return prompts;
	}

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return prompts;
	}

	for (const entry of entries) {
		if (!entry.name.endsWith(".md")) continue;
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;

		const filePath = path.join(dir, entry.name);
		let content: string;
		try {
			content = fs.readFileSync(filePath, "utf-8");
		} catch {
			continue;
		}

		const { frontmatter, body } = parseFrontmatter(content);

		if (!frontmatter.description) {
			continue;
		}

		// Command name derived from filename (e.g., implement.md -> implement)
		const name = entry.name.replace(/\.md$/, "");

		prompts.push({
			name,
			description: frontmatter.description,
			template: body,
			filePath,
		});
	}

	return prompts;
}

export function discoverPrompts(): PromptConfig[] {
	const bundledPromptsDir = path.join(__dirname, "prompts");
	return loadPromptsFromDir(bundledPromptsDir);
}

/**
 * Register all discovered prompts as commands.
 * Each prompt becomes a /command that sends the expanded template as a user message.
 */
export function registerPromptCommands(pi: ExtensionAPI): void {
	const prompts = discoverPrompts();

	for (const prompt of prompts) {
		pi.registerCommand(prompt.name, {
			description: prompt.description,
			handler: async (args, ctx) => {
				if (!args.trim()) {
					ctx.ui.notify(`Usage: /${prompt.name} <task>`, "warning");
					return;
				}

				// Replace $@ placeholder with user arguments
				const expandedPrompt = prompt.template.replace(/\$@/g, args.trim());

				// Wait for idle if needed
				if (!ctx.isIdle()) {
					ctx.ui.notify("Agent is busy. Please wait.", "warning");
					return;
				}

				// Send as user message to trigger the workflow
				pi.sendUserMessage(expandedPrompt);
			},
		});
	}
}
