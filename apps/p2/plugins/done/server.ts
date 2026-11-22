// The inbox follower, card/session links and worker wakeups live on the server, apart from the conversation store.
import { appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { bool, int, obj, str } from "@earendil-works/pi-schema";
import {
	type Ctx,
	defineFacet,
	defineState,
	expectVariant,
	forbidden,
	isWorker,
	local,
	method,
	type Ref,
	record,
	sleep,
} from "@p2/app/v1";
import { Hosts, Server, serverOf } from "@p2/app/v1/server";
import { SessionOperations } from "../sessions/contract.ts";
import {
	CardLink,
	CommentCard,
	CompleteCard,
	DoneCard,
	DoneIngress,
	type DoneLink,
	type DoneLocation,
	Park,
	ResumeCard,
	TraceTool,
	WriteCard,
} from "./contract.ts";
import { DoneApi, type DoneEvent, putDoneQuestion } from "./done-api.ts";
import { isDoneLocation, RoutingQuestion, routeDoneCard } from "./done-routing.ts";
import { loadDoneSettings } from "./done-settings.ts";

const STATE = defineState("p2.done-links", {
	schema: obj({
		cards: record(CardLink),
		ambiguous: record(str()),
		scheduled: record(obj({ card: str(), armed: bool() })),
		seen: int(),
	}),
	version: 1,
	initial: () => ({ cards: {}, ambiguous: {}, scheduled: {}, seen: 0 }),
	persist: true,
	checkpointWhen: () => true,
});

const DoneFollower = local("p2.done-follower", {
	version: 1,
	params: {},
	members: {
		write: method(obj({ session: str(), body: WriteCard })),
		comment: method(obj({ session: str(), body: CommentCard })),
		complete: method(obj({ session: str(), body: CompleteCard })),
		park: method(obj({ session: str(), body: Park }), str()),
		resumed: method(obj({ session: str(), body: ResumeCard })),
		trace: method(obj({ session: str(), body: TraceTool })),
	},
});

export default defineFacet((host) => {
	host.serve(DoneFollower, (_params, self) => {
		const server = self.get(Server, {});
		const hosts = self.get(Hosts, {});
		const natives = serverOf(self);
		const sessions = self.get(SessionOperations, {});
		const state = self.state(STATE);
		const settings = self.open(
			() => loadDoneSettings(server.info.value.dataDir),
			() => {},
		);
		const api = () => {
			const config = settings.value;
			if (!config) throw forbidden("Done is not configured.");
			return new DoneApi(config.url, config.tokenFile);
		};
		const trace = async (
			card: string,
			link: DoneLink | undefined,
			step: string,
			words: string,
			extra: object = {},
		) => {
			await appendFile(
				join(server.info.value.dataDir, "done-trace.jsonl"),
				`${JSON.stringify({
					at: new Date().toISOString(),
					card,
					session: link?.session ?? null,
					location: link?.location ?? null,
					step,
					words,
					...extra,
				})}\n`,
				{ mode: 0o600 },
			);
		};
		const forSession = (session: string): [string, DoneLink] => {
			const linked = Object.entries(state.value.cards).find(([, link]) => link.session === session);
			if (!linked) throw forbidden("This worker has no done card.");
			return linked;
		};
		const ingress = <T>(
			session: string,
			run: (ref: Extract<Ref<typeof DoneIngress>, { variant: "server" }>, ctx: Ctx) => Promise<T>,
			ctx: Ctx,
		) =>
			natives().root(
				async (inner) => run(expectVariant(await inner.get(DoneIngress, { session }), "server"), inner),
				ctx,
			);

		const start = async (
			card: string,
			location: DoneLocation,
			title: string,
			input: { text: string; requestId: string; script?: string; until?: number },
			ctx: Ctx,
		) => {
			let link = state.value.cards[card];
			if (!link) {
				link = { session: crypto.randomUUID(), location };
				const saved = link;
				await state.change((draft) => {
					draft.cards[card] = saved;
				}, ctx);
			}
			await sessions.create(
				{
					id: link.session,
					title,
					env: location === "fleet" ? "fleet" : null,
					cwd: location === "fleet" ? "~/agents-world/fleet" : join(homedir(), "agents-world", location),
				},
				ctx,
			);
			await trace(card, link, "session started", input.text);
			await ingress(link.session, (worker, inner) => worker.input({ card, first: true, ...input }, inner), ctx);
		};

		const accept = async (event: DoneEvent, ctx: Ctx) => {
			const { item_id: card, type, data, seq } = event;
			if (!card) return;
			const link = state.value.cards[card];
			const requestId = `done:${seq}`;
			if (event.actor !== "owner") return;
			if (type === "item.added") {
				const item = await api().item(card);
				const words = item.origin_text ?? item.title;
				// The chosen session ID is persisted before the input. A retry keeps that location.
				const route = routeDoneCard(words, link?.location);
				if (!link) await trace(card, undefined, "card seen", words, { eventAt: event.at });
				if (route.kind === "question") {
					await state.change((draft) => {
						draft.ambiguous[card] = words;
					}, ctx);
					await putDoneQuestion(api(), card, RoutingQuestion);
					await trace(card, undefined, "location asked", RoutingQuestion.prompt, {
						rule: route.rule,
						matches: route.matches,
					});
				} else {
					if (!link)
						await trace(card, undefined, "location decided", words, {
							rule: route.rule,
							location: route.location,
						});
					const script = settings.value?.scripts?.[words];
					await start(
						card,
						route.location,
						item.title,
						{ text: words, requestId, ...(script ? { script } : {}) },
						ctx,
					);
				}
				return;
			}
			const answer = type === "question.answered" && typeof data.answer === "string" ? data.answer : undefined;
			const waiting = state.value.ambiguous[card];
			if (
				waiting !== undefined &&
				data.block_id === RoutingQuestion.id &&
				answer !== undefined &&
				isDoneLocation(answer)
			) {
				const item = await api().item(card);
				if (item.status === "open" && item.turn === "owner")
					await api().patch(card, { turn: "agent", did: "Used the location you chose." });
				await trace(card, undefined, "location decided", answer, { rule: "R2 owner choice", location: answer });
				const script = settings.value?.scripts?.[waiting];
				await start(card, answer, item.title, { text: waiting, requestId, ...(script ? { script } : {}) }, ctx);
				await state.change((draft) => {
					delete draft.ambiguous[card];
				}, ctx);
				return;
			}
			if (!link) return;
			const park = link.park;
			if (park?.kind === "question" && answer !== undefined && data.block_id === park.block) {
				const result = await ingress(
					link.session,
					(worker, inner) =>
						worker.answer(
							{
								task: park.task,
								block: park.block,
								text: answer,
							},
							inner,
						),
					ctx,
				);
				if (result !== "delivered" && result !== "duplicate" && result !== "closed")
					throw new Error(`done answer for ${card}/${park.block}: ${result}`);
				if (result === "delivered")
					await trace(card, link, "answer delivered", answer, { eventAt: event.at, task: park.task });
				await state.change((draft) => {
					if (draft.cards[card]?.park?.task === park.task) delete draft.cards[card].park;
				}, ctx);
				return;
			}
			const text =
				answer ??
				(typeof data.note === "string"
					? data.note
					: typeof data.text === "string"
						? data.text
						: typeof data.title === "string"
							? data.title
							: JSON.stringify({ type, data }));
			await ingress(link.session, (worker, inner) => worker.input({ card, text, requestId }, inner), ctx);
			await trace(card, link, "owner input delivered", text, { eventAt: event.at, type });
		};

		const arm = async (ctx: Ctx) => {
			const schedule = settings.value?.schedule;
			if (!schedule) return;
			let run = state.value.scheduled[schedule.id];
			if (run?.armed) return;
			if (!run) {
				const card = await api().add(schedule.title);
				const pending = { card: card.id, armed: false };
				await state.change((draft) => {
					draft.scheduled[schedule.id] = pending;
				}, ctx);
				run = pending;
				await trace(card.id, undefined, "card seen", schedule.words, { eventAt: card.created_at });
				await trace(card.id, undefined, "location decided", schedule.words, {
					rule: "R0 scheduled maker",
					location: schedule.location,
				});
			}
			await start(
				run.card,
				schedule.location,
				schedule.title,
				{
					text: schedule.words,
					requestId: `done:schedule:${schedule.id}`,
					until: schedule.at,
					...(schedule.script ? { script: schedule.script } : {}),
				},
				ctx,
			);
			await state.change((draft) => {
				draft.scheduled[schedule.id].armed = true;
			}, ctx);
		};

		const parkedWorkers = async (ctx: Ctx) => {
			for (const [card, link] of Object.entries(state.value.cards)) {
				const park = link.park;
				if (!park) continue;
				if (park.kind === "timer" && park.until <= Date.now()) {
					await trace(card, link, "timer due", "", { until: park.until });
					await ingress(link.session, (worker, inner) => worker.wake(inner), ctx);
					await state.change((draft) => {
						if (draft.cards[card]?.park?.task === park.task) delete draft.cards[card].park;
					}, ctx);
				} else if (hosts.workers.value[link.session]?.running) {
					const pid = await ingress(
						link.session,
						(worker, inner) => worker.parkedPid({ task: park.task }, inner),
						ctx,
					);
					if (pid === null) continue;
					await natives().workers.stop(link.session);
					await trace(card, link, "parked worker stopped", "", { pid, task: park.task, kind: park.kind });
				}
			}
		};

		self.onLive(async (ctx) => {
			if (!settings.value) return;
			for (;;) {
				await arm(ctx);
				await parkedWorkers(ctx);
				for (const event of await api().inbox()) {
					if (event.seq > state.value.seen) {
						await accept(event, ctx);
						await state.change((draft) => {
							draft.seen = event.seq;
						}, ctx);
					}
					await api().ack(event.seq);
				}
				await sleep(500, ctx);
			}
		});

		return {
			write: async ({ session, body }) => {
				const [card, link] = forSession(session);
				const item = await api().item(card);
				const facts = { id: "done-facts", type: "facts", rows: body.facts };
				await api().patch(card, {
					title: body.title,
					did: body.did,
					blocks: [...item.blocks.filter((block) => block.id !== facts.id), facts],
				});
				await trace(card, link, "tool ran", JSON.stringify(body), { tool: "done_write" });
				return null;
			},
			comment: async ({ session, body }) => {
				const [card, link] = forSession(session);
				await api().comment(card, body.text);
				await trace(card, link, "tool ran", body.text, { tool: "done_comment" });
				return null;
			},
			complete: async ({ session, body }) => {
				const [card, link] = forSession(session);
				await api().complete(card, body);
				await trace(card, link, "tool ran", JSON.stringify(body), { tool: "done_complete" });
				return null;
			},
			park: async ({ session, body }, ctx) => {
				const [card, link] = forSession(session);
				if (body.kind === "timer") {
					await state.change((draft) => {
						draft.cards[card].park = body;
					}, ctx);
					await trace(card, link, "timer parked", "", { until: body.until, task: body.task });
					return "";
				}
				const block = `done-question-${body.task}`;
				await putDoneQuestion(api(), card, {
					id: block,
					prompt: body.prompt,
					...(body.options ? { options: body.options } : {}),
				});
				await state.change((draft) => {
					draft.cards[card].park = { kind: "question", task: body.task, block };
				}, ctx);
				await trace(card, link, "question parked", body.prompt, { task: body.task, block });
				return block;
			},
			resumed: async ({ session, body }) => {
				const [card, link] = forSession(session);
				const item = await api().item(card);
				if (item.status === "open" && item.turn === "owner" && item.blocks.some((block) => block.id === body.block))
					await api().patch(card, { turn: "agent", did: "Read your answer and resumed the work." });
				await trace(card, link, "tool ran", body.text, { tool: "ask_owner", block: body.block });
				return null;
			},
			trace: async ({ session, body }) => {
				const [card, link] = forSession(session);
				await trace(card, link, body.step, body.words);
				return null;
			},
		};
	});

	host.serve(DoneCard, (_params, principal, self) => {
		if (!isWorker(principal)) throw forbidden("Only a done card's session can use these tools.");
		const { session } = principal;
		const follower = self.get(DoneFollower, {});
		return {
			variant: "worker",
			members: {
				write: (body, ctx) => follower.write({ session, body }, ctx),
				comment: (body, ctx) => follower.comment({ session, body }, ctx),
				complete: (body, ctx) => follower.complete({ session, body }, ctx),
				park: (body, ctx) => follower.park({ session, body }, ctx),
				resumed: (body, ctx) => follower.resumed({ session, body }, ctx),
				trace: (body, ctx) => follower.trace({ session, body }, ctx),
			},
		};
	});
});
