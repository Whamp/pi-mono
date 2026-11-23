// The card tools carry the calling worker's identity, never a caller-supplied card ID.
import {
	defineDoc,
	defineExtension,
	defineSignal,
	defineTool,
	GenerationTask,
	hook,
	section,
} from "@earendil-works/pi-durable";
import { num, obj, str } from "@earendil-works/pi-schema";
import type { Context, Ctx, Ref } from "@p2/app/v1";
import { defineP2Tool, isTopLevel, type P2Tool } from "@p2/app/v1/worker";
import { AskOwner, CompleteCard, type DoneCard, WriteCard } from "./contract.ts";

export const DoneSessionDoc = defineDoc<{ link: { card: string; script?: string } | null }>({
	kind: "p2.done-session",
	version: 1,
	scope: "session",
	initial: () => ({ link: null }),
	checkpointWhen: () => true,
});

export const DoneAnswer = defineSignal({ name: "done.owner-answer", version: 1, schema: obj({ text: str() }) });

type CallCard = <T>(
	run: (card: Extract<Ref<typeof DoneCard>, { variant: "worker" }>, ctx: Ctx) => Promise<T>,
	context: Context,
) => Promise<T>;

function toolText(text: string) {
	return { output: [{ type: "text" as const, text }] };
}

/** Card tools and tracing for the conversation associated with the card. */
export function createDoneTools(callCard: CallCard) {
	const ask = defineTool<typeof AskOwner, null, { block: string }>({
		name: "ask_owner",
		description: "Ask the owner on this session's done card and wait for the answer.",
		parameters: AskOwner,
		replay: "safe",
		executionMode: "sequential",
		async execute(body, api, context) {
			if (api.checkpoint) {
				const { block } = api.checkpoint;
				const answer = await api.readSignal(DoneAnswer, block, context);
				if (answer?.kind !== "value") throw new Error("The parked done question woke without an answer.");
				await callCard((card, ctx) => card.resumed({ block, text: answer.value.text }, ctx), context);
				return toolText(answer.value.text);
			}
			const block = await callCard(
				(card, ctx) => card.park({ kind: "question", task: api.taskId, ...body }, ctx),
				context,
			);
			return { kind: "sleep", checkpoint: { block }, signals: [DoneAnswer.key(block)] };
		},
	});
	const timer = defineTool({
		name: "done_sleep_until",
		description: "Park scheduled work until its provided epoch millisecond deadline.",
		parameters: obj({ until: num() }),
		replay: "safe",
		async execute({ until }, api, context) {
			if (api.now() >= until) return toolText("The scheduled time has arrived.");
			await callCard((card, ctx) => card.park({ kind: "timer", task: api.taskId, until }, ctx), context);
			return { kind: "sleep", until };
		},
	});
	return defineExtension<P2Tool>({
		name: "p2-done",
		sections: [
			section("done-card", async (input, ctx) => {
				const link = (await input.read.snapshot(DoneSessionDoc, ctx))?.link;
				if (!link || !(await isTopLevel(input.read, input.conversationId, ctx))) return undefined;
				return `This session holds done card ${link.card}. Use done_write and done_comment to update it. Ask only on the card with ask_owner. When work is finished, use done_complete with what you did and how you checked. Keep the owner's words intact. Work within this location's rules.`;
			}),
		],
		tools: [
			{ ...ask, scope: "main" },
			{ ...timer, scope: "main" },
			defineP2Tool({
				name: "done_write",
				description: "Write a title and facts on this session's done card.",
				parameters: WriteCard,
				scope: "main",
				async execute(body, _api, context) {
					await callCard((card, ctx) => card.write(body, ctx), context);
					return toolText("Wrote the card.");
				},
			}),
			defineP2Tool({
				name: "done_comment",
				description: "Add a comment to this session's done card.",
				parameters: obj({ text: str() }),
				scope: "main",
				async execute(body, _api, context) {
					await callCard((card, ctx) => card.comment(body, ctx), context);
					return toolText("Added the comment.");
				},
			}),
			defineP2Tool({
				name: "done_complete",
				description: "Complete this session's done card with what you did and how you checked.",
				parameters: CompleteCard,
				scope: "main",
				async execute(body, _api, context) {
					await callCard((card, ctx) => card.complete(body, ctx), context);
					return toolText("Completed the card.");
				},
			}),
		],
		hooks: [
			hook(GenerationTask, {
				async beforeRequest({ messages }, api, context) {
					if (!(await api.snapshot(DoneSessionDoc, context))?.link) return;
					await callCard(
						(card, ctx) => card.trace({ step: "model called", words: "", pid: process.pid }, ctx),
						context,
					);
					if (process.env.AW_JUDGE_TRACE === "1") {
						const words = JSON.stringify(messages.filter(({ role }) => role === "user" || role === "toolResult"));
						await callCard((card, ctx) => card.trace({ step: "model inputs", words }, ctx), context);
					}
					return undefined;
				},
				async afterResponse(message, api, context) {
					if (!(await api.snapshot(DoneSessionDoc, context))?.link) return;
					await callCard(
						(card, ctx) =>
							card.trace(
								{
									step: "model responded",
									words: JSON.stringify(message.content),
								},
								ctx,
							),
						context,
					);
				},
			}),
		],
		wraps: ["bash", "read", "edit", "write"].map((name) => ({
			kind: "tool",
			tool: name,
			wrap: (tool) => ({
				...tool,
				async execute(args, api, context) {
					const link = (await api.snapshot(DoneSessionDoc, context))?.link;
					const observe = link && (name === "bash" || process.env.AW_JUDGE_TRACE === "1");
					if (observe)
						await callCard(
							(card, ctx) =>
								card.trace(
									{
										step: name === "bash" ? "tool called" : "location tool called",
										tool: name,
										pid: process.pid,
										words: JSON.stringify(args),
									},
									ctx,
								),
							context,
						);
					const result = await tool.execute(args, api, context);
					if (observe && result.kind === undefined)
						await callCard(
							(card, ctx) =>
								card.trace(
									{
										step: "tool ran",
										tool: name,
										words: JSON.stringify({
											tool: name,
											args,
											output: result.output ?? api.retainedOutput().text,
										}),
									},
									ctx,
								),
							context,
						);
					return result;
				},
			}),
		})),
	});
}
