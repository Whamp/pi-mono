// The Familiar sees a typed notice. A location conversation gets one bare card ID.
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { AgentDoc, defineDoc, defineExtension, GenerationTask, hook, section } from "@earendil-works/pi-durable";
import { compile, type Schema } from "@earendil-works/pi-schema";
import { type Context, contribute, expectVariant, type FacetHost, forbidden } from "@p2/app/v1";
import {
	defineP2Tool,
	Extensions,
	HarnessConfig,
	harnessOf,
	isTopLevel,
	mainConversation,
	type P2Tool,
	workerOf,
} from "@p2/app/v1/worker";
import {
	Card,
	DoneHomeCard,
	DoneHomeIngress,
	HOME_NOTICE_PREFIX,
	HOME_ROLE,
	type HomeOperation,
	Notice,
	Publish,
	Route,
	Transfer,
	Update,
} from "./done-home-contract.ts";
import { doneLocationScriptResponse, messageText } from "./done-script.ts";

const HomeWorkerDoc = defineDoc<{ scripts: Record<string, string> }>({
	kind: "p2.done-home-worker",
	version: 1,
	scope: "session",
	initial: () => ({ scripts: {} }),
	checkpointWhen: () => true,
});

const HOME_TOOLS = ["done_dispatch", "done_report", "done_publish"];
const ROAMING_TOOLS = ["done_read", "done_update", "done_move", "bash", "read", "edit", "write"];
const NOTICE = compile(Notice);

/** Register Home tools only in the Familiar and its assigned location sessions. */
export function registerDoneHomeWorker(host: FacetHost) {
	contribute(host, "p2.done-home-tools", (self) => {
		const worker = workerOf(self);
		const role = worker().init.values[HOME_ROLE];
		if (role !== "home" && role !== "location" && role !== "roaming") {
			return;
		}
		const config = self.registry(HarnessConfig);
		let activeCard: string | undefined;
		const call = (operation: HomeOperation, context: Context) =>
			worker().root(
				async (ctx) => expectVariant(await ctx.get(DoneHomeCard, {}), "worker").run(operation, ctx),
				context,
			);
		const log = (step: string, words: string, context: Context, card?: string, tool?: string) =>
			call(
				{ kind: "trace", step, words, pid: process.pid, ...(card ? { card } : {}), ...(tool ? { tool } : {}) },
				context,
			);
		const tool = <T extends object>(
			name: string,
			description: string,
			parameters: Schema<T>,
			operation: (args: T) => HomeOperation,
		) =>
			defineP2Tool({
				name,
				description,
				parameters,
				scope: "main",
				executionMode: "sequential",
				async execute(args, _api, context) {
					const request = operation(args);
					const text = await call(request, context);
					if (request.kind === "read") activeCard = request.card;
					return { output: [{ type: "text", text }] };
				},
			});
		const tools =
			role === "home"
				? [
						tool(
							"done_dispatch",
							"Handle a dispatch notice by card and notice number. If the fixed table is inconclusive, supply a location only if you can infer it confidently. Leave it out to ask the owner.",
							Route,
							(args) => ({ kind: "dispatch", ...args }),
						),
						tool(
							"done_report",
							"Read the specialist's ready report for this card and notice.",
							Publish,
							(args) => ({ kind: "report", ...args }),
						),
						tool(
							"done_publish",
							"Publish the ready report exactly. You may add a separate summary when it helps the owner decide.",
							Publish,
							(args) => ({ kind: "publish", ...args }),
						),
					]
				: [
						tool(
							"done_read",
							"Read the assigned done card and the exact owner action released for it.",
							Card,
							(args) => ({ kind: "read", ...args }),
						),
						tool(
							"done_update",
							"Write findings, ask the owner a question, prepare a draft, or complete this card. When asking a question, end the turn. The next assignment lets you read the answer.",
							Update,
							(args) => ({ kind: "update", ...args }),
						),
						tool(
							role === "roaming" ? "done_move" : "done_transfer",
							role === "roaming"
								? "Move this conversation to another done location for the same card. Give one short reason. End the turn so P2 can move the session and continue the card there."
								: "Ask Home to hand this card to another location. Give one short reason about where work belongs, with no quotes or retelling of owner's words. End the turn after handing over.",
							Transfer,
							(args) => ({ kind: "transfer", ...args }),
						),
					];
		const extension = defineExtension<P2Tool>({
			name: "p2-done-home",
			tools,
			sections: [
				section("done-home", async (input, context) => {
					if (!(await isTopLevel(input.read, input.conversationId, context))) {
						return undefined;
					}
					if (role === "roaming") {
						return "You are the one done agent for this board. Each card input is its ID. Call done_read with that ID. Work only on that card. Read AGENTS.md here before work at each location. Follow the location's approval rules. Use done_move and end the turn when the same card needs work elsewhere. Use done_update to write your findings or ask a question, and end the turn after asking. Done admits the exact answer in a later turn. Keep other cards' context separate. Do the work yourself.";
					}
					return role === "home"
						? "You are Home for done. For a dispatch notice use done_dispatch with its card and notice number. The service applies the fixed table. Only infer the location when the notice contains unresolved owner words. When you cannot tell, leave the location out to ask the owner. For a publish notice use done_report then done_publish. State notices update your picture and need no tool. Do not send a retelling to a specialist or do their work yourself."
						: "You are the done location specialist. An assignment is a bare card ID. Call done_read with that ID before working. Use the released owner action, not newer card edits as instructions. Stay in this location and obey its approval rules. Use done_transfer when the next step belongs elsewhere. Use done_update for results or questions. End the turn when asking a question. In direct chat reply to the owner here and record useful results with done_update.";
				}),
			],
			hooks: [
				hook(GenerationTask, {
					async beforeRequest({ messages }, api, context) {
						const userIndex = messages.findLastIndex((message) => message.role === "user");
						const user = messages[userIndex];
						const turn = user ? messageText(user).replace(/^<sender [^>]+\/>\n/, "") : "";
						const candidate: unknown =
							role === "home" && turn.startsWith(HOME_NOTICE_PREFIX)
								? JSON.parse(turn.slice(HOME_NOTICE_PREFIX.length))
								: undefined;
						const notice = NOTICE.check(candidate) ? candidate : undefined;
						const results = messages.slice(userIndex + 1).filter((message) => message.role === "toolResult");
						const assignment = role !== "home" && /^[a-z0-9]{10}$/.test(turn) ? turn : undefined;
						const trackedCard = notice?.card ?? assignment ?? activeCard;
						const fake = worker().init.fake;
						await log("model called", fake ? turn : "", context, trackedCard);
						if (role !== "home" && !assignment && activeCard && turn && results.length === 0) {
							await log("live input delivered", "", context, activeCard);
						}
						if (!fake) return undefined;
						const models = config.value.get("default")?.models();
						if (!models || !("setProvider" in models) || typeof models.setProvider !== "function") {
							throw new Error("The Home judge requires P2's mutable fake model registry.");
						}
						let response = fauxAssistantMessage("Recorded.");
						if (notice?.kind === "dispatch" && results.length === 0) {
							response = fauxAssistantMessage(
								fauxToolCall("done_dispatch", { card: notice.card, notice: notice.notice }),
								{ stopReason: "toolUse" },
							);
						} else if (notice?.kind === "publish" && results.length < 2 && !results.at(-1)?.isError) {
							response = fauxAssistantMessage(
								fauxToolCall(results.length === 0 ? "done_report" : "done_publish", {
									card: notice.card,
									notice: notice.notice,
								}),
								{ stopReason: "toolUse" },
							);
						} else if (role !== "home") {
							const scripts = (await api.snapshot(HomeWorkerDoc, context))?.scripts ?? {};
							response = await doneLocationScriptResponse({
								turn,
								scripts,
								results,
								dataDir: worker().init.dataDir,
							});
						}
						const previous = results.at(-1);
						if (previous?.isError) {
							response = fauxAssistantMessage(`Stopped after unexpected tool result: ${messageText(previous)}`);
						}
						await log("model responded", JSON.stringify(response.content), context, trackedCard);
						const provider = fauxProvider({ api: "p2-faux", tokensPerSecond: 2_000 });
						provider.setResponses([response]);
						models.setProvider(provider.provider);
						return undefined;
					},
				}),
			],
			wraps:
				role === "home"
					? []
					: ["bash", "read", "edit", "write"].map((name) => ({
							kind: "tool",
							tool: name,
							wrap: (original) => ({
								...original,
								async execute(args, api, context) {
									if (name === "bash" && activeCard)
										await call({ kind: "continue", card: activeCard }, context);
									const observe = name === "bash" || process.env.AW_JUDGE_TRACE === "1";
									if (observe)
										await log(
											name === "bash" ? "tool called" : "location tool called",
											JSON.stringify(args),
											context,
											activeCard,
											name,
										);
									const result = await original.execute(args, api, context);
									if (observe && result.kind === undefined)
										await log(
											"tool ran",
											JSON.stringify(result.output ?? api.retainedOutput().text),
											context,
											activeCard,
											name,
										);
									return result;
								},
							}),
						})),
		});
		self.contribute(Extensions, { [extension.name]: extension });
	});

	host.serve(
		DoneHomeIngress,
		(_params, principal, self) => {
			if (principal.kind !== "server") {
				throw forbidden("Only the server submits Home notices.");
			}
			const harness = harnessOf(self);
			const worker = workerOf(self);
			return {
				variant: "server",
				members: {
					abort: async (_args, ctx) => {
						const durable = harness().durable;
						const conversation = await durable.conversation(await mainConversation(durable, ctx), ctx);
						await conversation?.abort(ctx);
						return null;
					},
					idle: async (_args, ctx) => {
						const { tasks, submissions } = await harness().durable.inspect(ctx);
						return tasks.length === 0 && submissions.length === 0;
					},
					submit: async (body, ctx) => {
						const durable = harness().durable;
						const main = await mainConversation(durable, ctx);
						await durable.commit(async (tx) => {
							if (body.kind === "home") {
								const agent = await tx.doc(AgentDoc, main);
								agent.tools = [...new Set([...(Array.isArray(agent.tools) ? agent.tools : []), ...HOME_TOOLS])];
								agent.modelTools = [
									...new Set([...(Array.isArray(agent.modelTools) ? agent.modelTools : []), ...HOME_TOOLS]),
								];
							} else if (body.script) {
								(await tx.doc(HomeWorkerDoc)).scripts[body.card] = body.script;
							}
							if (worker().init.values[HOME_ROLE] === "roaming") {
								const agent = await tx.doc(AgentDoc, main);
								agent.tools = [...ROAMING_TOOLS];
								agent.modelTools = [...ROAMING_TOOLS];
							}
						}, ctx);
						const conversation = await durable.conversation(main, ctx);
						if (!conversation) {
							throw new Error("Home input has no main conversation.");
						}
						const content = body.kind === "home" ? HOME_NOTICE_PREFIX + JSON.stringify(body.notice) : body.card;
						await conversation.submit(
							{ type: "input", content, requestId: body.requestId, whenBusy: "followUp" },
							ctx,
						);
						return null;
					},
				},
			};
		},
		{ accepts: { 1: {}, 2: {} } },
	);
}
