// Route cards to one moving session in C or through Home in D. Done owns the card and the owner's words.
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { obj, str } from "@earendil-works/pi-schema";
import {
	type Context,
	type Ctx,
	expectVariant,
	type FacetHost,
	forbidden,
	isWorker,
	local,
	method,
	sleep,
	withAbortSignal,
} from "@p2/app/v1";
import { Hosts, Server, serverOf, WorkerInitValues } from "@p2/app/v1/server";
import { FamiliarStore } from "../familiar/contract.ts";
import { SessionMoves, SessionOperations } from "../sessions/contract.ts";
import type { DoneLocation } from "./contract.ts";
import { DoneApi, type DoneBlock, type DoneEvent, pollDoneCopies, putDoneQuestion } from "./done-api.ts";
import {
	DoneHomeCard,
	DoneHomeIngress,
	HOME_ROLE,
	type HomeAssignment,
	type HomeNotice,
	HomeOperation,
} from "./done-home-contract.ts";
import { publishHomeUpdate } from "./done-home-publication.ts";
import { type DoneHomeCopy, enqueueDispatch, HomeState, initialDoneHomeCopy } from "./done-home-state.ts";
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

const HomeService = local("p2.done-home-service", {
	version: 1,
	params: {},
	members: { run: method(obj({ session: str(), body: HomeOperation }), str()) },
});
const DIRECT_LINK = "done-live-session";

function ownerWords(event: DoneEvent) {
	const { answer, note, text, title } = event.data;
	for (const value of [answer, note, text, title]) {
		if (typeof value === "string") {
			return value;
		}
	}
	return "";
}

/** Wire the Home inbox and its card tools into the done plugin's server facet. */
export function registerDoneHome(host: FacetHost) {
	host.serve(HomeService, (_params, self) => {
		const server = self.get(Server, {});
		const hosts = self.get(Hosts, {});
		const natives = serverOf(self);
		const familiar = self.get(FamiliarStore, {});
		const sessions = self.get(SessionOperations, {});
		const moves = self.get(SessionMoves, {});
		const saved = self.state(HomeState);
		const epoch = crypto.randomUUID();
		const generations = new Map<string, number>();
		const settings = self.open(
			() => loadDoneSettings(server.info.value.dataDir),
			() => {},
		);
		const configurations = () => settings.value.filter(({ pattern }) => pattern !== "b");

		const homeSession = (config: DoneCopySettings, state: DoneHomeCopy) =>
			state.mainSession ?? (config.id === LEGACY_DONE_COPY && state.legacyFamiliar ? familiar.session.value : null);

		const copyRole = (config: DoneCopySettings, session: string) => {
			const state = saved.value.copies[doneCopyKey(config.id)];
			if (!state) return null;
			if (config.pattern === "c") return state.mainSession === session ? "roaming" : null;
			if (homeSession(config, state) === session) return "home";
			return Object.values(state.locations).includes(session) ? "location" : null;
		};
		self.contribute(WorkerInitValues, {
			[HOME_ROLE]: (session) => {
				for (const config of configurations()) {
					const role = copyRole(config, session);
					if (role) return role;
				}
				return null;
			},
		});

		const createCopy = (config: DoneCopySettings) => {
			const roaming = config.pattern === "c";
			const key = doneCopyKey(config.id);
			const initial = initialDoneHomeCopy();
			const state = {
				get value() {
					return saved.value.copies[key] ?? initial;
				},
				change: (fn: (draft: DoneHomeCopy) => void, ctx: Ctx) =>
					saved.change((draft) => {
						draft.copies[key] ??= initialDoneHomeCopy();
						fn(draft.copies[key]);
					}, ctx),
			};
			const api = (from?: "Home" | DoneLocation) =>
				new DoneApi(config.url, config.tokenFile, from ? `P2 ${from}` : undefined);
			const openHome = async (ctx: Ctx) => {
				const previous = homeSession(config, state.value);
				const id = previous ?? crypto.randomUUID();
				if (!state.value.mainSession) {
					await state.change((draft) => {
						draft.mainSession = id;
					}, ctx);
				}
				const row = await sessions.create(
					{ id, title: `${donePatternMark(config.pattern)} · Home`, cwd: server.info.value.dataDir },
					ctx,
				);
				if (row.archivedAt !== null) await sessions.restore({ id }, ctx);
				return id;
			};

			const trace = async (card: string | undefined, step: string, extra: object = {}) => {
				const location = card ? state.value.cards[card]?.location : undefined;
				await appendFile(
					join(server.info.value.dataDir, "done-trace.jsonl"),
					`${JSON.stringify({
						copy: config.id,
						pattern: config.pattern,
						at: new Date().toISOString(),
						card,
						location,
						session: roaming ? state.value.mainSession : location ? state.value.locations[location] : undefined,
						step,
						...extra,
					})}\n`,
					{ mode: 0o600 },
				);
			};
			const begin = async (card: string, session: string | undefined, ctx: Ctx) => {
				const previous = state.value.cards[card].attempt;
				if (previous) generations.delete(previous.id);
				const id = epoch + crypto.randomUUID();
				await state.change((draft) => {
					draft.cards[card].attempt = {
						id,
						deadline: Date.now() + config.workTimeoutMs,
						...(session ? { session } : {}),
					};
				}, ctx);
				return id;
			};
			const finish = async (card: string, ctx: Ctx) => {
				const attempt = state.value.cards[card].attempt;
				if (!attempt) return;
				await state.change((draft) => {
					delete draft.cards[card].attempt;
				}, ctx);
				generations.delete(attempt.id);
			};
			const fail = async (card: string, line: string, ctx: Ctx, changed = false) => {
				const link = state.value.cards[card];
				await returnDoneCard(api("Home"), link.target ?? card, line, changed);
				await state.change((draft) => {
					draft.cards[card].state = "failed";
					for (const [id, pending] of Object.entries(draft.dispatches)) {
						if (pending.card === card) delete draft.dispatches[id];
					}
					for (const [id, pending] of Object.entries(draft.outbox)) {
						if (pending.card === card) delete draft.outbox[id];
					}
					for (const [id, pending] of Object.entries(draft.reports)) {
						if (pending.card === card) delete draft.reports[id];
					}
				}, ctx);
				await finish(card, ctx);
				await trace(card, "card returned", { words: line });
			};
			const checkAnswer = async (card: string, ctx: Ctx) => {
				const link = state.value.cards[card];
				if (link.state !== "failed" && (await doneAnswerChanged(api(), link.target ?? card, link.answer))) {
					await fail(card, doneFailure.changed, ctx, true);
				}
				if (state.value.cards[card].state === "failed") throw forbidden("This work was returned to the owner.");
			};
			const workerIngress = <T>(
				session: string,
				action: (ref: Awaited<ReturnType<typeof getIngress>>, ctx: Ctx) => Promise<T>,
				ctx: Context,
			) => natives().root(async (inner) => action(await getIngress(session, inner), inner), ctx);
			async function getIngress(session: string, ctx: Ctx) {
				return expectVariant(await ctx.get(DoneHomeIngress, { session }), "server");
			}
			const submit = async (session: string, body: HomeAssignment, ctx: Ctx) =>
				workerIngress(
					session,
					(worker, inner) => worker.submit(body, inner),
					withAbortSignal(AbortSignal.timeout(config.workTimeoutMs), ctx),
				);

			const watchAttempts = async (ctx: Ctx) => {
				for (const [card, link] of Object.entries(state.value.cards)) {
					const { attempt } = link;
					if (!attempt) continue;
					const { session } = attempt;
					const worker = session ? hosts.workers.value[session] : undefined;
					if (stoppedDoneAttempt(attempt, epoch, worker, generations.get(attempt.id))) {
						await fail(card, interruptedDoneLine(attempt), ctx);
					} else if (attempt.deadline <= Date.now()) {
						await fail(card, doneFailure.timeout, ctx);
						if (session && worker?.running) {
							await workerIngress(
								session,
								(ref, inner) => ref.abort({}, inner),
								withAbortSignal(AbortSignal.timeout(5_000), ctx),
							);
						}
					} else if (
						session &&
						worker?.running &&
						generations.has(attempt.id) &&
						(await workerIngress(session, (ref, inner) => ref.idle({}, inner), ctx)) &&
						state.value.cards[card].attempt?.id === attempt.id
					) {
						await fail(card, doneFailure.silent, ctx);
					}
				}
			};
			const rememberWorker = (id: string, session: string) => {
				const generation = hosts.workers.value[session]?.generation;
				if (generation !== undefined) generations.set(id, generation);
			};
			const roamingIdle = (ctx: Ctx) => {
				const session = state.value.mainSession;
				if (!session || !hosts.workers.value[session]?.running) return Promise.resolve(true);
				return natives().root(
					async (inner) => expectVariant(await inner.get(DoneHomeIngress, { session }), "server").idle({}, inner),
					ctx,
				);
			};

			const sessionAtLocation = async (location: DoneLocation, card: string, ctx: Ctx) => {
				const session =
					(roaming ? state.value.mainSession : state.value.locations[location]) ?? crypto.randomUUID();
				await state.change((draft) => {
					if (roaming) draft.mainSession = session;
					else draft.locations[location] = session;
				}, ctx);
				const { env, folder } = config.locations[location];
				const bounded = withAbortSignal(AbortSignal.timeout(config.workTimeoutMs), ctx);
				const label = roaming ? "Done" : location;
				await sessions.create(
					{ id: session, title: `${donePatternMark(config.pattern)} · ${label}`, env, cwd: folder },
					bounded,
				);
				if (roaming && state.value.sessionLocation !== location) {
					const from = state.value.sessionLocation;
					// The location tool uses this same P2 relocation. Its fence waits for the source turn to finish.
					if (from && (await moves.relocate({ id: session, env, cwd: folder }, bounded)).refused !== null)
						return null;
					await state.change((draft) => {
						draft.sessionLocation = location;
					}, ctx);
					await trace(card, from ? "session moved" : "session started", { from, to: location, location, session });
				}
				return session;
			};

			const accept = async (event: DoneEvent, ctx: Ctx) => {
				if (event.actor !== "owner" || !event.item_id) {
					return;
				}
				const id = event.item_id;
				const card = Object.entries(state.value.cards).find(([, link]) => link.target === id)?.[0] ?? id;
				const link = state.value.cards[card];
				const words = ownerWords(event);
				const receipt = doneAnswerReceipt(event);
				if (receipt && link?.answer?.block === receipt.block) {
					if (link.answer.text !== receipt.text) await fail(card, doneFailure.changed, ctx, true);
					return;
				}
				if (receipt && link?.state === "failed") return;
				if (receipt && (await doneAnswerChanged(api(), id, receipt))) {
					if (link) await fail(card, doneFailure.changed, ctx, true);
					return;
				}
				if (
					roaming &&
					link?.waitingBlock &&
					event.type !== "item.done" &&
					(event.type !== "question.answered" || event.data.block_id !== link.waitingBlock)
				)
					return;
				await trace(card, roaming ? "owner action released" : "Home received owner action", {
					eventAt: event.at,
					event: event.type,
				});
				const returning =
					!roaming &&
					event.type === "comment.added" &&
					/^\s*(?:back to home|i(?:'|’)m back)[.!]?\s*$/i.test(words);
				if (link?.direct && !returning) {
					await trace(card, "Home stayed aside");
					return;
				}
				const direct =
					!roaming &&
					link?.location &&
					event.type === "comment.added" &&
					/\b(talk (?:live|to|me through)|speak (?:live|to)|whoever holds the context|open (?:the )?transcript)\b/i.test(
						words,
					);
				const item = await api().item(id);
				const origin = item.origin_text ?? item.title;
				const maker = item.created_by.replace(/^agent:/, "").split("/")[0] ?? "";
				const answer =
					link?.asking && event.data.block_id === RoutingQuestion.id && isDoneLocation(words) ? words : undefined;
				if (link?.asking && !answer) {
					return;
				}
				const route = routeDoneCard(
					event.type === "item.added" ? origin : words || origin,
					answer ?? link?.location ?? (isDoneLocation(maker) ? maker : undefined),
				);
				const script = config.scripts?.[origin] ?? link?.script;
				const change: "direct" | "return" | undefined = returning ? "return" : direct ? "direct" : undefined;
				const pending = {
					card,
					...(route.kind === "location" ? { location: route.location } : {}),
					...(change ? { change } : {}),
				};
				await state.change((draft) => {
					draft.cards[card] ??= {};
					const current = draft.cards[card];
					current.event = event.seq;
					current.eventCard = id;
					if (receipt && link?.waitingBlock === receipt.block) current.answer = receipt;
					if (current.state === "failed") delete current.state;
					if (script) {
						current.script = script;
					}
					const detail = route.kind === "location" ? (change ?? route.rule) : words || origin;
					enqueueDispatch(draft, pending, roaming ? undefined : detail);
					draft.seen = event.seq;
				}, ctx);
			};

			const schedule = async (ctx: Ctx) => {
				const plan = config.schedule;
				if (!plan || state.value.schedule || plan.at > Date.now()) {
					return;
				}
				const card = await api().add(plan.title);
				await state.change((draft) => {
					draft.schedule = card.id;
					draft.cards[card.id] = plan.script ? { script: plan.script } : {};
					enqueueDispatch(
						draft,
						{ card: card.id, location: plan.location },
						roaming ? undefined : "Scheduled work",
					);
				}, ctx);
				await trace(card.id, "timer due", { until: plan.at });
			};

			const flush = async (ctx: Ctx) => {
				for (const [key, notice] of Object.entries(state.value.outbox)) {
					const id = await openHome(ctx);
					if (!state.value.outbox[key]) continue;
					const attempt = notice.kind === "state" ? undefined : await begin(notice.card, id, ctx);
					try {
						await submit(id, { kind: "home", notice, requestId: `done-home:${key}` }, ctx);
						if (attempt) rememberWorker(attempt, id);
					} catch (error) {
						if (!attempt) throw error;
						await trace(notice.card, "session failed", { words: String(error) });
						await fail(notice.card, doneFailure.interrupted, ctx);
						continue;
					}
					await trace(notice.card, "Home notice", { session: id, location: "Home", notice });
					await state.change((draft) => {
						delete draft.outbox[key];
					}, ctx);
				}
			};

			const requireHome = (session: string) => {
				if (roaming || session !== homeSession(config, state.value)) {
					throw forbidden("Only this copy’s Home session can dispatch and publish.");
				}
			};
			const requireLocation = (session: string, card: string) => {
				const link = state.value.cards[card];
				const holder = roaming
					? state.value.activeCard === card && state.value.mainSession === session
					: link?.location && state.value.locations[link.location] === session;
				if (!link?.location || !holder) {
					throw forbidden("This location does not hold the done card.");
				}
				return { ...link, location: link.location };
			};
			const movePending = (card: string) =>
				Object.values(state.value.dispatches).some((pending) => pending.card === card && pending.transfer);

			const directLink = async (card: string, session: string, change: "direct" | "return", ctx: Ctx) => {
				const target = state.value.cards[card]?.target ?? card;
				const item = await api().item(target);
				const blocks = item.blocks.filter((block) => block.id !== DIRECT_LINK);
				if (change === "direct") {
					const base = config.p2Url ?? `http://127.0.0.1:${server.info.value.port}`;
					blocks.push({
						id: DIRECT_LINK,
						type: "action",
						kind: "link",
						label: "Talk to this session",
						value: new URL(`/s/${session}`, base).href,
					});
				}
				await api("Home").patch(target, {
					blocks,
					did:
						change === "direct"
							? "Opened a direct line to the session. Comment Back to Home when you return."
							: "Resumed routing through Home.",
				});
				await state.change((draft) => {
					draft.cards[card].direct = change === "direct";
				}, ctx);
				await trace(card, change === "direct" ? "Home stepped aside" : "Home resumed");
			};

			const followUp = async (card: string, location: DoneLocation) => {
				const blocks: DoneBlock[] = [
					{
						id: "done-original",
						type: "action",
						kind: "link",
						label: "Open the original card",
						value: new URL(`/?item=${encodeURIComponent(card)}`, config.url).href,
					},
				];
				const author = config.pattern === "d-a" ? "Home" : location;
				return (await api(author).add("Follow-up", blocks)).id;
			};

			const dispatch = async (body: { card: string; notice: number; location?: DoneLocation }, ctx: Ctx) => {
				const { card, notice } = body;
				const pending = state.value.dispatches[notice];
				if (!pending || pending.card !== card) {
					return "This dispatch is closed.";
				}
				const link = state.value.cards[card];
				const location = pending.location ?? body.location;
				if (!location) {
					await putDoneQuestion(api(), link.eventCard ?? card, RoutingQuestion);
					await state.change((draft) => {
						draft.cards[card].asking = true;
						delete draft.dispatches[notice];
					}, ctx);
					await finish(card, ctx);
					await trace(card, "location asked");
					return "Asked the owner for the location.";
				}
				// Put the failure or result on the follow-up even if the destination never starts.
				const target =
					pending.transfer && !link.target && (await api().item(card)).status === "done"
						? await followUp(card, location)
						: link.target;
				if (target && target !== link.target) {
					await state.change((draft) => {
						draft.cards[card].target = target;
					}, ctx);
				}
				let session: string | null;
				try {
					session = await sessionAtLocation(location, card, ctx);
				} catch (error) {
					await trace(card, "session failed", { words: String(error) });
					await fail(
						card,
						config.locations[location].env ? doneFailure.unavailable(location) : doneFailure.interrupted,
						ctx,
					);
					return "Returned the card to the owner.";
				}
				if (!session) return "The session is still working.";
				if (pending.change) {
					await directLink(card, session, pending.change, ctx);
					await finish(card, ctx);
				} else {
					await state.change((draft) => {
						const current = draft.cards[card];
						current.location = location;
						current.state = "working";
						current.asking = false;
						delete current.waitingBlock;
						if (roaming) draft.activeCard = card;
					}, ctx);
					if (link.asking || (roaming && link.state === "waiting")) {
						const id = link.eventCard ?? card;
						const item = await api().item(id);
						if (item.status === "open" && item.turn === "owner") {
							await api().patch(id, {
								turn: "agent",
								did: link.asking ? "Used the location you chose." : "Read your answer and resumed the work.",
							});
						}
					}
					const script = pending.transfer && link.script ? `${link.script}-transfer` : link.script;
					const attempt = await begin(card, session, ctx);
					try {
						await submit(
							session,
							{ kind: "location", card, requestId: `done-work:${notice}`, ...(script ? { script } : {}) },
							ctx,
						);
						await trace(card, "location assigned", { location, session });
						if (!roaming)
							await trace(card, "hand-over", { from: "Home", to: location, payload: "id", words: card });
						rememberWorker(attempt, session);
					} catch (error) {
						await trace(card, "session failed", { words: String(error) });
						await fail(
							card,
							config.locations[location].env ? doneFailure.unavailable(location) : doneFailure.interrupted,
							ctx,
						);
						return "Returned the card to the owner.";
					}
				}
				await state.change((draft) => {
					delete draft.dispatches[notice];
				}, ctx);
				return "Handled the card.";
			};

			const pollInbox = async (ctx: Ctx) => {
				await watchAttempts(ctx);
				await schedule(ctx);
				const events = await api().inbox();
				const nextDispatch = () => Object.entries(state.value.dispatches)[0];
				if (roaming && (events.length || nextDispatch()) && !(await roamingIdle(ctx))) return;
				for (const event of events) {
					if (roaming && nextDispatch()) break;
					if (event.seq > state.value.seen) {
						await accept(event, ctx);
						if (event.seq > state.value.seen) {
							await state.change((draft) => {
								draft.seen = event.seq;
							}, ctx);
						}
					}
					await api().ack(event.seq);
				}
				if (roaming) {
					const next = nextDispatch();
					if (next) await dispatch({ card: next[1].card, notice: Number(next[0]) }, ctx);
				} else await flush(ctx);
			};

			return {
				pollInbox,
				run: async ({ session, body }: { session: string; body: HomeOperation }, ctx: Ctx) => {
					switch (body.kind) {
						case "dispatch":
							requireHome(session);
							return dispatch(body, ctx);
						case "continue":
							requireLocation(session, body.card);
							await checkAnswer(body.card, ctx);
							return "";
						case "read": {
							const { card } = body;
							await checkAnswer(card, ctx);
							const link = requireLocation(session, card);
							const { item, thread } = await api().detail(card);
							const event =
								link.event && link.eventCard ? await api().event(link.event, link.eventCard) : undefined;
							const plan = state.value.schedule === card ? config.schedule : undefined;
							await trace(card, "location read card", {
								event: event?.type,
								eventAt: event?.at,
								words: event ? ownerWords(event) : item.origin_text,
							});
							const output = JSON.stringify({
								item: {
									...item,
									blocks: item.blocks.map((block) => {
										if (typeof block.answered_at !== "string" || (event && block.answered_at <= event.at)) {
											return block;
										}
										return Object.fromEntries(
											Object.entries(block).filter(([key]) => key !== "answer" && key !== "answered_at"),
										);
									}),
								},
								thread: thread.filter((entry) => entry.actor !== "owner" || (event && entry.at <= event.at)),
								...(link.target ? { followUp: await api().item(link.target) } : {}),
								...(event ? { ownerAction: event, exactWords: ownerWords(event) } : {}),
								...(plan ? { scheduledWork: plan.words } : {}),
							});
							if (process.env.AW_JUDGE_TRACE === "1")
								await trace(card, "card read payload", { session, words: output });
							return output;
						}
						case "update": {
							const { card } = body;
							const link = requireLocation(session, card);
							await checkAnswer(card, ctx);
							if (movePending(card)) throw forbidden("This card is between locations.");
							const result = body.complete
								? "settled"
								: body.question
									? "waiting"
									: body.draft
										? "with owner"
										: (link.state ?? "working");
							const direct = config.pattern !== "d-a";
							await trace(card, "location update requested");
							const version = state.value.serial + 1;
							if (direct) {
								await publishHomeUpdate(api(link.location), link.target ?? card, body, version);
								if (body.complete) await checkAnswer(card, ctx);
							}
							if (roaming) {
								await state.change((draft) => {
									draft.serial = version;
									draft.cards[card].state = result;
									if (body.question) {
										draft.cards[card].waitingBlock = `done-question-${version}`;
										delete draft.cards[card].answer;
									}
								}, ctx);
							} else if (!direct || link.state !== result) {
								await state.change((draft) => {
									const notice = ++draft.serial;
									const message: HomeNotice = direct
										? { kind: "state", card, state: result }
										: { kind: "publish", card, notice };
									draft.cards[card].state = result;
									if (body.question) {
										draft.cards[card].waitingBlock = `done-question-${notice}`;
										delete draft.cards[card].answer;
									}
									draft.outbox[notice] = message;
									if (!direct) {
										draft.reports[notice] = {
											card,
											...(body.write ? { write: body.write } : {}),
											...(body.question ? { question: body.question } : {}),
											...(body.complete ? { complete: body.complete } : {}),
											...(body.draft ? { draft: body.draft } : {}),
											...(body.comment ? { comment: body.comment } : {}),
										};
									}
								}, ctx);
							}
							if (result !== "working") await finish(card, ctx);
							await trace(card, direct ? "location published" : "report ready", {
								target: link.target ?? card,
								state: result,
							});
							return direct ? "Updated the card." : "The report is ready for Home.";
						}
						case "transfer": {
							const { card, location, reason } = body;
							const link = requireLocation(session, card);
							if (roaming) {
								if (link.location === location || movePending(card))
									throw forbidden("This card is already there or has a move pending.");
								await state.change((draft) => {
									enqueueDispatch(draft, { card, location, transfer: true });
								}, ctx);
								await finish(card, ctx);
								await trace(card, "session move requested", { from: link.location, to: location, reason });
								return "End the turn. This conversation continues after the location changes.";
							}
							if (link.location === location || link.transferred) {
								throw forbidden("This card cannot be handed over again. Ask the owner where it belongs.");
							}
							const detail = `Hand-over from ${link.location} to ${location}. ${reason}`;
							await api("Home").comment(card, detail);
							await state.change((draft) => {
								draft.cards[card].transferred = true;
								enqueueDispatch(draft, { card, location, transfer: true }, detail);
							}, ctx);
							await finish(card, ctx);
							await trace(card, "hand-over", {
								from: link.location,
								to: "Home",
								payload: "id",
								words: card,
								reason,
							});
							return "Home will hand over the card.";
						}
						case "report": {
							const { card, notice } = body;
							requireHome(session);
							const update = state.value.reports[notice];
							if (update?.card !== card) {
								return "This report is closed.";
							}
							await trace(card, "Home read report", { session, location: "Home" });
							return JSON.stringify(update);
						}
						case "publish": {
							const { card, notice, summary } = body;
							requireHome(session);
							const update = state.value.reports[notice];
							if (update?.card !== card) {
								return "This report is closed.";
							}
							const target = state.value.cards[card]?.target ?? card;
							await checkAnswer(card, ctx);
							await publishHomeUpdate(api("Home"), target, update, notice, summary);
							if (update.complete) await checkAnswer(card, ctx);
							await finish(card, ctx);
							await state.change((draft) => {
								delete draft.reports[notice];
							}, ctx);
							await trace(card, "Home published", { session, location: "Home", target });
							return "Updated the card.";
						}
						case "trace": {
							const { card, step, words, pid, tool } = body;
							if (card && step === "tool called") {
								await state.change((draft) => {
									const route = draft.cards[card];
									if (route?.attempt) {
										route.attempt.attempted = `a command in the ${route.location} location`;
										route.attempt.pid = pid;
									}
								}, ctx);
							}
							if (roaming) {
								await trace(card ?? state.value.activeCard, step, { session, words, pid, tool });
								return "";
							}
							const location = Object.keys(state.value.locations).find(
								(key) => state.value.locations[key] === session,
							);
							if (!location && session !== homeSession(config, state.value)) {
								throw forbidden("This worker has no Home role.");
							}
							await trace(card, step, { session, location: location ?? "Home", words, pid, tool });
							return "";
						}
					}
				},
			};
		};

		self.onLive(async (ctx) => {
			const copies = configurations().map(createCopy);
			while (copies.length) {
				await pollDoneCopies(copies.map((copy) => copy.pollInbox(ctx)));
				await sleep(500, ctx);
			}
		});

		return {
			run: (args, ctx) => {
				const config = configurations().find((copy) => copyRole(copy, args.session));
				if (!config) throw forbidden("This worker has no Done Home role.");
				return createCopy(config).run(args, ctx);
			},
		};
	});

	host.serve(DoneHomeCard, (_params, principal, self) => {
		if (!isWorker(principal)) {
			throw forbidden("Only a Home or location worker can use these tools.");
		}
		const service = self.get(HomeService, {});
		return {
			variant: "worker",
			members: {
				run: (body, ctx) => service.run({ session: principal.session, body }, ctx),
			},
		};
	});
}
