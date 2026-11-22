// The Home state store holds routing and pending notices. Done remains the source of owner words.
import { bool, int, obj, opt, type Static, str, union } from "@earendil-works/pi-schema";
import { defineState, literal, record } from "@p2/app/v1";
import { LocationSchema } from "./contract.ts";
import { Notice, Update } from "./done-home-contract.ts";

const CardRoute = obj({
	location: opt(LocationSchema),
	target: opt(str()),
	event: opt(int()),
	eventCard: opt(str()),
	transferred: opt(bool()),
	direct: opt(bool()),
	asking: opt(bool()),
	state: opt(str()),
	script: opt(str()),
});

const Dispatch = obj({
	card: str(),
	location: opt(LocationSchema),
	change: opt(union([literal("direct"), literal("return")])),
	transfer: opt(bool()),
});

const HomeStateSchema = obj({
	locations: record(str()),
	cards: record(CardRoute),
	outbox: record(Notice),
	dispatches: record(Dispatch),
	reports: record(Update),
	serial: int(),
	seen: int(),
	schedule: opt(str()),
});

/** Durable routing, session assignments, and undelivered notices owned by Home. */
export const HomeState = defineState("p2.done-home", {
	schema: HomeStateSchema,
	version: 1,
	initial: () => ({ locations: {}, cards: {}, outbox: {}, dispatches: {}, reports: {}, serial: 0, seen: 0 }),
	persist: true,
	checkpointWhen: () => true,
});

/** Record a dispatch and its outgoing notice as part of the caller's state change. */
export function enqueueDispatch(
	draft: Static<typeof HomeStateSchema>,
	pending: Static<typeof Dispatch>,
	detail: string,
) {
	const notice = ++draft.serial;
	draft.dispatches[notice] = pending;
	draft.outbox[notice] = { kind: "dispatch", card: pending.card, notice, detail };
}
