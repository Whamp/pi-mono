// The worker places exact inputs and signals the task that asked the question. It owns the Durable store.
import { LiveDoc, type TaskId } from "@earendil-works/pi-durable";
import { contribute, defineFacet, expectVariant, forbidden } from "@p2/app/v1";
import { Extensions, harnessOf, mainConversation, workerOf } from "@p2/app/v1/worker";
import { DoneCard, DoneIngress } from "./contract.ts";
import { registerDoneHomeWorker } from "./done-home-worker.ts";
import { createDoneScript } from "./done-script.ts";
import { createDoneTools, DoneAnswer, DoneSessionDoc } from "./done-tools.ts";

export default defineFacet((host) => {
	registerDoneHomeWorker(host);
	contribute(host, "p2.done-tools", (self) => {
		const worker = workerOf(self);
		const tools = createDoneTools((run, context) =>
			worker().root(async (ctx) => run(expectVariant(await ctx.get(DoneCard, {}), "worker"), ctx), context),
		);
		const script = createDoneScript(self);
		self.contribute(Extensions, { [tools.name]: tools, [script.name]: script });
	});

	host.serve(DoneIngress, (_params, principal, self) => {
		if (principal.kind !== "server") throw forbidden("Only the server delivers done events.");
		const harness = harnessOf(self);
		const worker = workerOf(self);
		return {
			variant: "server",
			members: {
				input: async ({ card, text, requestId, first, script, until }, ctx) => {
					const durable = harness().durable;
					let content = text;
					if (first) {
						await durable.commit(async (tx) => {
							(await tx.doc(DoneSessionDoc)).link = { card, ...(script ? { script } : {}) };
						}, ctx);
						content = `Done card ${card}\n${until === undefined ? "" : `Scheduled for epoch millisecond ${until}. Call done_sleep_until first.\n`}\n${text}`;
					}
					const conversation = await durable.conversation(await mainConversation(durable, ctx), ctx);
					if (!conversation) throw new Error("Done session has no main conversation.");
					await conversation.submit({ type: "input", content, requestId, whenBusy: "followUp" }, ctx);
					return null;
				},
				answer: ({ task, block, text }, ctx) =>
					// SAFETY: this ID was recorded by ask_owner itself in this session's Durable store.
					harness().durable.signal(task as TaskId, DoneAnswer, block, { text }, ctx),
				wake: async () => {
					harness().durable.resume();
					return null;
				},
				parkedPid: async ({ task }, ctx) => {
					if ((worker().liveness.value.viewers ?? 0) > 0) return null;
					const durable = harness().durable;
					const main = await mainConversation(durable, ctx);
					const live = await durable.snapshot(LiveDoc, main, ctx);
					return live?.tools?.some((slot) => slot.taskId === task && slot.status === "sleeping") &&
						!durable.wake().active
						? process.pid
						: null;
				},
			},
		};
	});
});
