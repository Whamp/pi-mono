// Home owns routing and publication state. Done owns the owner's words and the visible card.
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { obj, str } from "@earendil-works/pi-schema";
import { type Ctx, expectVariant, type FacetHost, forbidden, isWorker, local, method, sleep } from "@p2/app/v1";
import { Server, serverOf, WorkerInitValues } from "@p2/app/v1/server";
import { FamiliarStore } from "../familiar/contract.ts";
import { SessionOperations } from "../sessions/contract.ts";
import type { DoneLocation } from "./contract.ts";
import { DoneApi, type DoneBlock, type DoneEvent, putDoneQuestion } from "./done-api.ts";
import {
	DoneHomeCard,
	DoneHomeIngress,
	HOME_ROLE,
	type HomeAssignment,
	type HomeNotice,
	HomeOperation,
} from "./done-home-contract.ts";
import { publishHomeUpdate } from "./done-home-publication.ts";
import { enqueueDispatch, HomeState } from "./done-home-state.ts";
import { isDoneLocation, RoutingQuestion, routeDoneCard } from "./done-routing.ts";
import { loadDoneSettings } from "./done-settings.ts";

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
		const natives = serverOf(self);
		const familiar = self.get(FamiliarStore, {});
		const sessions = self.get(SessionOperations, {});
		const state = self.state(HomeState);
		const settings = self.open(
			() => loadDoneSettings(server.info.value.dataDir),
			() => {},
		);
		self.contribute(WorkerInitValues, {
			[HOME_ROLE]: (session) => {
				if (!settings.value || settings.value.pattern === "b") {
					return null;
				}
				if (familiar.session.value === session) {
					return "home";
				}
				return Object.values(state.value.locations).includes(session) ? "location" : null;
			},
		});
		const configuration = () => {
			const config = settings.value;
			if (!config || config.pattern === "b") {
				throw forbidden("Done Home is not configured.");
			}
			return config;
		};
		const api = (from?: "Home" | DoneLocation) => {
			const config = configuration();
			return new DoneApi(config.url, config.tokenFile, from ? `P2 ${from}` : undefined);
		};

		const trace = async (card: string | undefined, step: string, extra: object = {}) => {
			const location = card ? state.value.cards[card]?.location : undefined;
			await appendFile(
				join(server.info.value.dataDir, "done-trace.jsonl"),
				`${JSON.stringify({
					at: new Date().toISOString(),
					card,
					location,
					session: location ? state.value.locations[location] : undefined,
					step,
					...extra,
				})}\n`,
				{ mode: 0o600 },
			);
		};
		const submit = (session: string, body: HomeAssignment, ctx: Ctx) =>
			natives().root(async (inner) => {
				const ingress = expectVariant(await inner.get(DoneHomeIngress, { session }), "server");
				await ingress.submit(body, inner);
			}, ctx);

		const accept = async (event: DoneEvent, ctx: Ctx) => {
			if (event.actor !== "owner" || !event.item_id) {
				return;
			}
			const id = event.item_id;
			const card = Object.entries(state.value.cards).find(([, link]) => link.target === id)?.[0] ?? id;
			const link = state.value.cards[card];
			const words = ownerWords(event);
			await trace(card, "Home received owner action", { eventAt: event.at, event: event.type });
			const returning =
				event.type === "comment.added" && /^\s*(?:back to home|i(?:'|’)m back)[.!]?\s*$/i.test(words);
			if (link?.direct && !returning) {
				await trace(card, "Home stayed aside");
				return;
			}
			const direct =
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
			const script = configuration().scripts?.[origin] ?? link?.script;
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
				if (script) {
					current.script = script;
				}
				enqueueDispatch(draft, pending, route.kind === "location" ? (change ?? route.rule) : words || origin);
				draft.seen = event.seq;
			}, ctx);
		};

		const schedule = async (ctx: Ctx) => {
			const plan = configuration().schedule;
			if (!plan || state.value.schedule || plan.at > Date.now()) {
				return;
			}
			const card = await api().add(plan.title);
			await state.change((draft) => {
				draft.schedule = card.id;
				draft.cards[card.id] = plan.script ? { script: plan.script } : {};
				enqueueDispatch(draft, { card: card.id, location: plan.location }, "Scheduled work");
			}, ctx);
			await trace(card.id, "timer due", { until: plan.at });
		};

		const flush = async (ctx: Ctx) => {
			for (const [key, notice] of Object.entries(state.value.outbox)) {
				const { id } = await familiar.open(ctx);
				await submit(id, { kind: "home", notice, requestId: `done-home:${key}` }, ctx);
				await trace(notice.card, "Home notice", { session: id, location: "Home", notice });
				await state.change((draft) => {
					delete draft.outbox[key];
				}, ctx);
			}
		};

		const requireHome = (session: string) => {
			configuration();
			if (session !== familiar.session.value) {
				throw forbidden("Only the Familiar can dispatch and publish for Home.");
			}
		};
		const requireLocation = (session: string, card: string) => {
			configuration();
			const link = state.value.cards[card];
			if (!link?.location || state.value.locations[link.location] !== session) {
				throw forbidden("This location does not hold the done card.");
			}
			return { ...link, location: link.location };
		};

		const directLink = async (card: string, session: string, change: "direct" | "return", ctx: Ctx) => {
			const target = state.value.cards[card]?.target ?? card;
			const item = await api().item(target);
			const blocks = item.blocks.filter((block) => block.id !== DIRECT_LINK);
			if (change === "direct") {
				const base = configuration().p2Url ?? `http://127.0.0.1:${server.info.value.port}`;
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
					value: new URL(`/?item=${encodeURIComponent(card)}`, configuration().url).href,
				},
			];
			const author = configuration().pattern === "d-b" ? location : "Home";
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
				await trace(card, "location asked");
				return "Asked the owner for the location.";
			}
			const session = state.value.locations[location] ?? crypto.randomUUID();
			await state.change((draft) => {
				draft.locations[location] ??= session;
			}, ctx);
			const { env, folder } = configuration().locations[location];
			await sessions.create({ id: session, title: `Done · ${location}`, env, cwd: folder }, ctx);
			if (pending.change) {
				await directLink(card, session, pending.change, ctx);
			} else {
				const target =
					pending.transfer && !link.target && (await api().item(card)).status === "done"
						? await followUp(card, location)
						: link.target;
				await state.change((draft) => {
					const current = draft.cards[card];
					current.location = location;
					current.state = "working";
					current.asking = false;
					if (target) {
						current.target = target;
					}
				}, ctx);
				if (link.asking) {
					const id = link.eventCard ?? card;
					const item = await api().item(id);
					if (item.status === "open" && item.turn === "owner") {
						await api().patch(id, { turn: "agent", did: "Used the location you chose." });
					}
				}
				const script = pending.transfer && link.script ? `${link.script}-transfer` : link.script;
				await trace(card, "hand-over", { from: "Home", to: location, payload: "id", words: card, retellings: 0 });
				await submit(
					session,
					{ kind: "location", card, requestId: `done-work:${notice}`, ...(script ? { script } : {}) },
					ctx,
				);
			}
			await state.change((draft) => {
				delete draft.dispatches[notice];
			}, ctx);
			return "Handled the card.";
		};

		self.onLive(async (ctx) => {
			if (!settings.value || settings.value.pattern === "b") {
				return;
			}
			for (;;) {
				await schedule(ctx);
				for (const event of await api().inbox()) {
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
				await flush(ctx);
				await sleep(500, ctx);
			}
		});

		return {
			run: async ({ session, body }, ctx) => {
				switch (body.kind) {
					case "dispatch":
						requireHome(session);
						return dispatch(body, ctx);
					case "read": {
						const { card } = body;
						const link = requireLocation(session, card);
						const { item, thread } = await api().detail(card);
						const event =
							link.event && link.eventCard ? await api().event(link.event, link.eventCard) : undefined;
						const plan = state.value.schedule === card ? configuration().schedule : undefined;
						await trace(card, "location read card", {
							event: event?.type,
							eventAt: event?.at,
							words: event ? ownerWords(event) : item.origin_text,
						});
						return JSON.stringify({
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
					}
					case "update": {
						const { card } = body;
						const link = requireLocation(session, card);
						if (
							Object.values(state.value.dispatches).some((pending) => pending.card === card && pending.transfer)
						) {
							throw forbidden("This card is in hand-over.");
						}
						const result = body.complete
							? "settled"
							: body.question
								? "waiting"
								: body.draft
									? "with owner"
									: (link.state ?? "working");
						const direct = configuration().pattern === "d-b";
						await trace(card, "location update requested");
						const version = state.value.serial + 1;
						if (direct) {
							await publishHomeUpdate(api(link.location), link.target ?? card, body, version);
						}
						await state.change((draft) => {
							const notice = ++draft.serial;
							const message: HomeNotice = direct
								? { kind: "state", card, state: result }
								: { kind: "publish", card, notice };
							draft.cards[card].state = result;
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
						await trace(card, direct ? "location published" : "report ready", {
							target: link.target ?? card,
							state: result,
						});
						return direct ? "Updated the card." : "The report is ready for Home.";
					}
					case "transfer": {
						const { card, location, reason } = body;
						const link = requireLocation(session, card);
						if (link.location === location || link.transferred) {
							throw forbidden("This card cannot be handed over again. Ask the owner where it belongs.");
						}
						const detail = `Hand-over from ${link.location} to ${location}. ${reason}`;
						await api("Home").comment(card, detail);
						await state.change((draft) => {
							draft.cards[card].transferred = true;
							enqueueDispatch(draft, { card, location, transfer: true }, detail);
						}, ctx);
						await trace(card, "hand-over", {
							from: link.location,
							to: "Home",
							payload: "id",
							words: card,
							reason,
							retellings: 0,
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
						await publishHomeUpdate(api("Home"), target, update, notice, summary);
						await state.change((draft) => {
							delete draft.reports[notice];
						}, ctx);
						await trace(card, "Home published", { session, location: "Home", target });
						return "Updated the card.";
					}
					case "trace": {
						const { card, step, words, pid } = body;
						const location = Object.keys(state.value.locations).find(
							(key) => state.value.locations[key] === session,
						);
						if (!location && session !== familiar.session.value) {
							throw forbidden("This worker has no Home role.");
						}
						await trace(card, step, { session, location: location ?? "Home", words, pid });
						return "";
					}
				}
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
