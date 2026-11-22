// Optional fake-only model script. Its next tool depends on the actual prior tool result.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { JsonValue } from "@earendil-works/chord/json";
import type { Message } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { defineExtension, GenerationTask, hook } from "@earendil-works/pi-durable";
import type { Self } from "@p2/app/v1";
import { HarnessConfig, workerOf } from "@p2/app/v1/worker";
import { DoneSessionDoc } from "./done-tools.ts";

/** One tool step in the fake model, optionally gated on the preceding result. */
type ScriptStep = {
	tool: string;
	args: Record<string, JsonValue>;
	after?: { contains: string } | { exact: string };
};

/** Read text from the user and tool messages given to the fake model. */
export const messageText = (message: Message) =>
	typeof message.content === "string"
		? message.content
		: message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");

/** Script only the model, leaving the transcript, tools, question, and environment on the real path. */
export function createDoneScript(self: Self) {
	const worker = workerOf(self);
	const config = self.registry(HarnessConfig);
	return defineExtension({
		name: "p2-done-script",
		hooks: [
			hook(GenerationTask, {
				async beforeRequest({ messages }, api, context) {
					if (!worker().init.fake) return undefined;
					const link = (await api.snapshot(DoneSessionDoc, context))?.link;
					if (!link?.script) return undefined;
					const models = config.value.get("default")?.models();
					if (!models || !("setProvider" in models) || typeof models.setProvider !== "function")
						throw new Error("The done script requires P2's mutable fake model registry.");
					const provider = fauxProvider({ api: "p2-faux", tokensPerSecond: 2_000 });
					const userIndex = messages.findLastIndex((message) => message.role === "user");
					const user = messages[userIndex];
					const turn = user ? messageText(user) : "";
					let response = fauxAssistantMessage(`Received: ${turn}`);
					if (turn.startsWith(`Done card ${link.card}\n`)) {
						const scripts: Record<string, ScriptStep[]> = JSON.parse(
							await readFile(join(worker().init.dataDir, "done-scripts.json"), "utf8"),
						);
						const script = scripts[link.script];
						if (!script) throw new Error(`No done fake script named ${link.script}`);
						const results = messages.slice(userIndex + 1).filter((message) => message.role === "toolResult");
						if (script[results.length]) {
							response = doneScriptResponse(script, results);
						}
					}
					provider.setResponses([response]);
					models.setProvider(provider.provider);
					return undefined;
				},
			}),
		],
	});
}

/** Execute one scripted response only when the real preceding tool result agrees. */
function doneScriptResponse(
	script: ScriptStep[],
	results: Extract<Message, { role: "toolResult" }>[],
	bind: (args: ScriptStep["args"]) => ScriptStep["args"] = (args) => args,
) {
	const step = script[results.length];
	const previous = results.at(-1);
	if (!step) {
		return fauxAssistantMessage("Recorded.");
	}
	const value = previous ? messageText(previous) : "";
	const expected = step.after;
	const matches = !expected || ("exact" in expected ? value === expected.exact : value.includes(expected.contains));
	if (previous?.isError || !matches) {
		return fauxAssistantMessage(`Stopped after unexpected tool result: ${value}`);
	}
	return fauxAssistantMessage(fauxToolCall(step.tool, bind(step.args)), { stopReason: "toolUse" });
}

interface LocationScriptInput {
	turn: string;
	scripts: Record<string, string>;
	dataDir: string;
	results: Extract<Message, { role: "toolResult" }>[];
}

/** Script a location's reaction to a bare card ID or a direct owner message in the judge. */
export async function doneLocationScriptResponse({ turn, scripts, dataDir, results }: LocationScriptInput) {
	const script = scripts[turn];
	if (script) {
		const file = join(dataDir, "done-scripts.json");
		const fixtures: Record<string, ScriptStep[]> = JSON.parse(await readFile(file, "utf8"));
		const read = results[0] ? messageText(results[0]) : "";
		const event = read.match(/"ownerAction":\{[^}]*?"type":"([^"]+)"/)?.[1];
		const phase = event && event !== "item.added" ? `${script}-${event}` : script;
		const steps = [{ tool: "done_read", args: { card: turn } }, ...(fixtures[phase] ?? [])];
		return doneScriptResponse(steps, results, (args) => (args.card === "$card" ? { ...args, card: turn } : args));
	}
	if (Object.keys(scripts).length === 0 || /^[a-z0-9]{10}$/.test(turn)) {
		return fauxAssistantMessage("Recorded.");
	}
	try {
		const source = await readFile(join(dataDir, "done-live-script.json"), "utf8");
		const live: { input: string; reply: string; script: string } = JSON.parse(source);
		const card = Object.keys(scripts).find((id) => scripts[id] === live.script);
		if (card && turn === live.input) {
			return results.length === 0
				? fauxAssistantMessage(fauxToolCall("done_update", { card, comment: live.reply }), {
						stopReason: "toolUse",
					})
				: fauxAssistantMessage(live.reply);
		}
	} catch (error) {
		if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
			throw error;
		}
	}
	return fauxAssistantMessage("Recorded.");
}
