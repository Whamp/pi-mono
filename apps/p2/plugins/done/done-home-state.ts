// The Home state store holds routing and pending notices. Done remains the source of owner words.
import { bool, compile, int, obj, opt, type Static, str, union } from "@earendil-works/pi-schema";
import { defineState, literal, record } from "@p2/app/v1";
import { LocationSchema } from "./contract.ts";
import { Notice, Update } from "./done-home-contract.ts";
import { doneCopyKey, LEGACY_DONE_COPY } from "./done-settings.ts";

const CardRoute = obj({
	location: opt(LocationSchema),
	target: opt(str()),
	event: opt(int()),
	eventCard: opt(str()),
	transferred: opt(bool()),
	direct: opt(bool()),
	asking: opt(bool()),
	waitingBlock: opt(str()),
	state: opt(str()),
	script: opt(str()),
});

const Dispatch = obj({
	card: str(),
	location: opt(LocationSchema),
	change: opt(union([literal("direct"), literal("return")])),
	transfer: opt(bool()),
});

const HomeCopyFields = {
	locations: record(str()),
	cards: record(CardRoute),
	outbox: record(Notice),
	dispatches: record(Dispatch),
	reports: record(Update),
	serial: int(),
	seen: int(),
	schedule: opt(str()),
};
const legacyHome = compile(obj(HomeCopyFields));
const HomeCopySchema = obj({
	...HomeCopyFields,
	mainSession: opt(str()),
	legacyFamiliar: opt(bool()),
	activeCard: opt(str()),
	sessionLocation: opt(LocationSchema),
});

/** Routing, session IDs and pending work for a single copy. */
export type DoneHomeCopy = Static<typeof HomeCopySchema>;

/** Initial values for a copy with no Home work yet. */
export const initialDoneHomeCopy = (): DoneHomeCopy => ({
	locations: {},
	cards: {},
	outbox: {},
	dispatches: {},
	reports: {},
	serial: 0,
	seen: 0,
});

/** Durable routing, session assignments, and undelivered notices owned by Home. */
export const HomeState = defineState("p2.done-home", {
	schema: obj({ copies: record(HomeCopySchema) }),
	version: 2,
	initial: () => ({ copies: {} }),
	migrate: (old) => {
		if (!legacyHome.check(old)) throw new Error("Invalid saved done Home state.");
		return { copies: { [doneCopyKey(LEGACY_DONE_COPY)]: { ...old, legacyFamiliar: old.serial > 0 } } };
	},
	persist: true,
	checkpointWhen: () => true,
});

/** Record a dispatch and its outgoing notice as part of the caller's state change. */
export function enqueueDispatch(draft: DoneHomeCopy, pending: Static<typeof Dispatch>, detail?: string) {
	const notice = ++draft.serial;
	draft.dispatches[notice] = pending;
	if (detail !== undefined) draft.outbox[notice] = { kind: "dispatch", card: pending.card, notice, detail };
}
