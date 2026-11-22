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

type ScriptStep = {
	tool: string;
	args: Record<string, JsonValue>;
	after?: { contains: string } | { exact: string };
};

const messageText = (message: Message) =>
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
						const step = script[results.length];
						const previous = results.at(-1);
						if (step) {
							const value = previous ? messageText(previous) : "";
							const expected = step.after;
							const matches =
								!expected ||
								("exact" in expected ? value === expected.exact : value.includes(expected.contains));
							if (previous?.isError || !matches)
								response = fauxAssistantMessage(`Stopped after unexpected tool result: ${value}`);
							else
								response = fauxAssistantMessage(fauxToolCall(step.tool, step.args), { stopReason: "toolUse" });
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
