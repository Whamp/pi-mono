// The inbox follower, card/session links and worker wakeups live on the server, apart from the conversation store.
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { bool, compile, int, obj, type Static, str } from "@earendil-works/pi-schema";
import {
	type Context,
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
	withAbortSignal,
} from "@p2/app/v1";
import { Hosts, Server, serverOf } from "@p2/app/v1/server";
import { SessionLocks, SessionOperations } from "../sessions/contract.ts";
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
import { DoneApi, type DoneEvent, pollDoneCopies, putDoneQuestion } from "./done-api.ts";
import { registerDoneHome } from "./done-home.ts";
import { lockDoneSession } from "./done-reach.ts";
import { isDoneLocation, RoutingQuestion, routeDoneCard } from "./done-routing.ts";
import {
	type DoneCopySettings,
	doneCopyKey,
	donePatternMark,
	LEGACY_DONE_COPY,
	loadDoneSettings,
} from "./done-settings.ts";

import {
	doneAnswerChanged,
	doneAnswerReceipt,
	doneFailure,
	interruptedDoneLine,
	returnDoneCard,
	stoppedDoneAttempt,
} from "./done-work.ts";

const FollowerState = obj({
	cards: record(CardLink),
	ambiguous: record(str()),
	scheduled: record(obj({ card: str(), armed: bool() })),
	seen: int(),
});
const legacyFollower = compile(FollowerState);
const FollowerCopies = obj({ copies: record(FollowerState) });
const savedCopies = compile(FollowerCopies);
const initialFollower = () => ({ cards: {}, ambiguous: {}, scheduled: {}, seen: 0 });

const STATE = defineState("p2.done-links", {
	schema: FollowerCopies,
	version: 3,
	initial: () => ({ copies: {} }),
	migrate: (old, from) => {
		if (from === 2 && savedCopies.check(old)) return old;
		if (!legacyFollower.check(old)) throw new Error("Invalid saved done card links.");
		return { copies: { [doneCopyKey(LEGACY_DONE_COPY)]: old } };
	},
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
	registerDoneHome(host);
	host.serve(DoneFollower, (_params, self) => {
		const server = self.get(Server, {});
		const hosts = self.get(Hosts, {});
		const natives = serverOf(self);
		const sessions = self.get(SessionOperations, {});
		const locks = self.get(SessionLocks, {});
		const saved = self.state(STATE);
		const epoch = crypto.randomUUID();
		const generations = new Map<string, number>();
		const settings = self.open(
			() => loadDoneSettings(server.info.value.dataDir),
			() => {},
		);
		const ingress = <T>(
			session: string,
			run: (ref: Extract<Ref<typeof DoneIngress>, { variant: "server" }>, ctx: Ctx) => Promise<T>,
			ctx: Context,
		) =>
			natives().root(
				async (inner) => run(expectVariant(await inner.get(DoneIngress, { session }), "server"), inner),
				ctx,
			);

		const createFollower = (config: DoneCopySettings) => {
			const key = doneCopyKey(config.id);
			const initial = initialFollower();
			const state = {
				get value() {
					return saved.value.copies[key] ?? initial;
				},
				change: (fn: (draft: Static<typeof FollowerState>) => void, ctx: Ctx) =>
					saved.change((draft) => {
						draft.copies[key] ??= initialFollower();
						fn(draft.copies[key]);
					}, ctx),
			};
			const client = new DoneApi(config.url, config.tokenFile);
			const api = () => client;
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
						copy: config.id,
						pattern: config.pattern,
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
			const finishAttempt = async (card: string, ctx: Ctx) => {
				const attempt = state.value.cards[card]?.attempt;
				await state.change((draft) => {
					delete draft.cards[card].attempt;
				}, ctx);
				if (attempt) generations.delete(attempt.id);
			};
			const fail = async (card: string, line: string, ctx: Ctx, changed = false) => {
				const link = state.value.cards[card];
				await returnDoneCard(api(), card, line, changed);
				await state.change((draft) => {
					draft.cards[card].failed = true;
					delete draft.cards[card].park;
				}, ctx);
				await finishAttempt(card, ctx);
				await trace(card, link, "card returned", line);
			};
			const begin = async (card: string, ctx: Ctx, until?: number) => {
				const id = epoch + crypto.randomUUID();
				const session = state.value.cards[card].session;
				await state.change((draft) => {
					const link = draft.cards[card];
					delete link.failed;
					link.attempt = { id, session, deadline: Math.max(until ?? 0, Date.now()) + config.workTimeoutMs };
				}, ctx);
				return id;
			};
			const rememberWorker = (id: string, session: string) => {
				const generation = hosts.workers.value[session]?.generation;
				if (generation !== undefined) generations.set(id, generation);
			};
			const checkAnswer = async (card: string, ctx: Ctx) => {
				const link = state.value.cards[card];
				if (!link.failed && (await doneAnswerChanged(api(), card, link.answer))) {
					await fail(card, doneFailure.changed, ctx, true);
				}
				if (state.value.cards[card].failed) throw forbidden("This work was returned to the owner.");
			};
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
				const { env, folder } = config.locations[link.location];
				const id = await begin(card, ctx, input.until);
				const bounded = withAbortSignal(AbortSignal.timeout(config.workTimeoutMs), ctx);
				try {
					await lockDoneSession(locks, config, link.session, link.location, ctx);
					await sessions.create(
						{ id: link.session, title: `${donePatternMark(config.pattern)} · ${title}`, env, cwd: folder },
						bounded,
					);
					await trace(card, link, "session started", input.text);
					await ingress(
						link.session,
						(worker, inner) => worker.input({ card, first: true, ...input }, inner),
						bounded,
					);
					rememberWorker(id, link.session);
				} catch (error) {
					await trace(card, link, "session failed", String(error));
					await fail(card, env ? doneFailure.unavailable(link.location) : doneFailure.interrupted, ctx);
				}
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
						const script = config.scripts?.[words];
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
					const script = config.scripts?.[waiting];
					await start(card, answer, item.title, { text: waiting, requestId, ...(script ? { script } : {}) }, ctx);
					await state.change((draft) => {
						delete draft.ambiguous[card];
					}, ctx);
					return;
				}
				if (!link) return;
				const receipt = doneAnswerReceipt(event);
				const park = link.park;
				if (receipt && park?.kind === "question" && receipt.block === park.block) {
					if (await doneAnswerChanged(api(), card, receipt)) {
						await fail(card, doneFailure.changed, ctx, true);
						return;
					}
					const id = await begin(card, ctx);
					await state.change((draft) => {
						draft.cards[card].answer = receipt;
						delete draft.cards[card].park;
					}, ctx);
					try {
						const result = await ingress(
							link.session,
							(worker, inner) =>
								worker.answer({ task: park.task, block: park.block, text: receipt.text }, inner),
							withAbortSignal(AbortSignal.timeout(config.workTimeoutMs), ctx),
						);
						rememberWorker(id, link.session);
						if (result === "delivered" || result === "duplicate") {
							await trace(card, link, "answer delivered", receipt.text, { eventAt: event.at, task: park.task });
						} else {
							await fail(card, doneFailure.interrupted, ctx);
						}
					} catch (error) {
						await trace(card, link, "session failed", String(error));
						await fail(card, doneFailure.interrupted, ctx);
					}
					return;
				}
				if (receipt && link.answer?.block === receipt.block) {
					if (link.answer.text !== receipt.text) await fail(card, doneFailure.changed, ctx, true);
					return;
				}
				if (receipt && link.failed) return;
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
				const schedule = config.schedule;
				if (!schedule) return;
				if (schedule.armAt !== undefined && Date.now() < schedule.armAt) return;
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

			const watchWorkers = async (ctx: Ctx) => {
				for (const [card, link] of Object.entries(state.value.cards)) {
					const { park, attempt, session } = link;
					const worker = hosts.workers.value[session];
					if (attempt && stoppedDoneAttempt(attempt, epoch, worker, generations.get(attempt.id))) {
						// A parked tool is safe to reopen and inspect. Only its own Durable receipt proves it can wait.
						if (park) {
							try {
								const pid = await ingress(
									session,
									(worker, inner) => worker.parkedPid({ task: park.task }, inner),
									withAbortSignal(AbortSignal.timeout(5_000), ctx),
								);
								if (pid !== null) {
									await finishAttempt(card, ctx);
									await natives().workers.stop(session);
									await trace(card, link, "parked worker stopped", "", {
										pid,
										task: park.task,
										kind: park.kind,
									});
									continue;
								}
							} catch (error) {
								await trace(card, link, "could not restore parked work", String(error));
							}
						}
						const line =
							park?.kind === "question"
								? "The session stopped while posting its question. I could not resume it. Check the card before asking me to retry."
								: interruptedDoneLine(attempt);
						await fail(card, line, ctx);
						continue;
					}
					if (park?.kind === "timer" && park.until <= Date.now()) {
						const id = await begin(card, ctx);
						await trace(card, link, "timer due", "", { until: park.until });
						await ingress(session, (worker, inner) => worker.wake(inner), ctx);
						rememberWorker(id, session);
						await state.change((draft) => {
							if (draft.cards[card]?.park?.task === park.task) delete draft.cards[card].park;
						}, ctx);
					} else if (park && worker?.running) {
						const pid = await ingress(
							session,
							(worker, inner) => worker.parkedPid({ task: park.task }, inner),
							ctx,
						);
						if (pid !== null) {
							if (attempt) await finishAttempt(card, ctx);
							await natives().workers.stop(session);
							await trace(card, link, "parked worker stopped", "", { pid, task: park.task, kind: park.kind });
							continue;
						}
					}
					if (!attempt) continue;
					const item = await api().item(card);
					if (item.status !== "open") {
						await finishAttempt(card, ctx);
					} else if (attempt.deadline <= Date.now()) {
						const line = doneFailure.timeout;
						await fail(card, line, ctx);
						if (worker?.running) {
							await ingress(
								session,
								(worker, inner) => worker.abort({}, inner),
								withAbortSignal(AbortSignal.timeout(5_000), ctx),
							);
						}
					} else if (
						!park &&
						worker?.running &&
						(await ingress(session, (worker, inner) => worker.idle({}, inner), ctx))
					) {
						await fail(card, doneFailure.silent, ctx);
					}
				}
			};

			const pollInbox = async (ctx: Ctx) => {
				await arm(ctx);
				await watchWorkers(ctx);
				for (const event of await api().inbox()) {
					if (event.seq > state.value.seen) {
						await accept(event, ctx);
						await state.change((draft) => {
							draft.seen = event.seq;
						}, ctx);
					}
					await api().ack(event.seq);
				}
			};

			return {
				pollInbox,
				write: async ({ session, body }: { session: string; body: Static<typeof WriteCard> }, ctx: Ctx) => {
					const [card, link] = forSession(session);
					await checkAnswer(card, ctx);
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
				comment: async ({ session, body }: { session: string; body: Static<typeof CommentCard> }, ctx: Ctx) => {
					const [card, link] = forSession(session);
					await checkAnswer(card, ctx);
					await api().comment(card, body.text);
					await trace(card, link, "tool ran", body.text, { tool: "done_comment" });
					return null;
				},
				complete: async ({ session, body }: { session: string; body: Static<typeof CompleteCard> }, ctx: Ctx) => {
					const [card, link] = forSession(session);
					await checkAnswer(card, ctx);
					await api().complete(card, body);
					await checkAnswer(card, ctx);
					await finishAttempt(card, ctx);
					await trace(card, link, "tool ran", JSON.stringify(body), { tool: "done_complete" });
					return null;
				},
				park: async ({ session, body }: { session: string; body: Static<typeof Park> }, ctx: Ctx) => {
					const [card, link] = forSession(session);
					await checkAnswer(card, ctx);
					if (body.kind === "timer") {
						await state.change((draft) => {
							draft.cards[card].park = body;
						}, ctx);
						await trace(card, link, "timer parked", "", { until: body.until, task: body.task });
						return "";
					}
					const block = `done-question-${body.task}`;
					await state.change((draft) => {
						draft.cards[card].park = { kind: "question", task: body.task, block };
						delete draft.cards[card].answer;
					}, ctx);
					await putDoneQuestion(api(), card, {
						id: block,
						prompt: body.prompt,
						...(body.options ? { options: body.options } : {}),
					});
					await trace(card, link, "question parked", body.prompt, { task: body.task, block });
					return block;
				},
				resumed: async ({ session, body }: { session: string; body: Static<typeof ResumeCard> }, ctx: Ctx) => {
					const [card, link] = forSession(session);
					await checkAnswer(card, ctx);
					const item = await api().item(card);
					if (
						item.status === "open" &&
						item.turn === "owner" &&
						item.blocks.some((block) => block.id === body.block)
					)
						await api().patch(card, { turn: "agent", did: "Read your answer and resumed the work." });
					await trace(card, link, "tool ran", body.text, { tool: "ask_owner", block: body.block });
					return null;
				},
				trace: async ({ session, body }: { session: string; body: Static<typeof TraceTool> }, ctx: Ctx) => {
					const [card, link] = forSession(session);
					if (body.step === "tool called") {
						await checkAnswer(card, ctx);
						await state.change((draft) => {
							const attempt = draft.cards[card].attempt;
							if (attempt) {
								attempt.attempted = `a command in the ${link.location} location`;
								if (body.pid !== undefined) attempt.pid = body.pid;
							}
						}, ctx);
					}
					await trace(card, link, body.step, body.words, { pid: body.pid, tool: body.tool });
					return null;
				},
			};
		};

		const followers = () => settings.value.filter((config) => config.pattern === "b");
		const forSession = (session: string) => {
			const config = followers().find(({ id }) =>
				Object.values(saved.value.copies[doneCopyKey(id)]?.cards ?? {}).some((link) => link.session === session),
			);
			if (!config) throw forbidden("This worker has no done card.");
			return createFollower(config);
		};

		self.onLive(async (ctx) => {
			const copies = followers().map(createFollower);
			while (copies.length) {
				await pollDoneCopies(copies.map((copy) => copy.pollInbox(ctx)));
				await sleep(500, ctx);
			}
		});

		return {
			write: (args, ctx) => forSession(args.session).write(args, ctx),
			comment: (args, ctx) => forSession(args.session).comment(args, ctx),
			complete: (args, ctx) => forSession(args.session).complete(args, ctx),
			park: (args, ctx) => forSession(args.session).park(args, ctx),
			resumed: (args, ctx) => forSession(args.session).resumed(args, ctx),
			trace: (args, ctx) => forSession(args.session).trace(args, ctx),
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
