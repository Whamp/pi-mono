// Routines (server): the owner's daily messages from `routines.json`, listed and run now by the owner or by the agent of
// a session that is neither shared nor locked (the `routines` code-mode tools).
import { arr, obj, opt, type Static, str } from "@earendil-works/pi-schema";
import { method, remote, serverHost } from "@p2/app/v1";

/** A routine as the list shows it: its schedule, its target, the date it last ran and its last failure. */
export const RoutineStatusSchema = obj({
	name: str(),
	time: str(),
	timeZone: opt(str()),
	session: str(),
	lastRun: opt(str()),
	error: opt(str()),
});
export type RoutineStatus = Static<typeof RoutineStatusSchema>;

/** The methods of `Routines` (both variants) and of the server's own routine service. */
export const ROUTINE_METHODS = {
	/** Every routine of `routines.json`; throws when the file is invalid. */
	list: method(undefined, arr(RoutineStatusSchema)),
	/** Sends routine `name`'s message now; today counts as run. */
	run: method(obj({ name: str({ minLength: 1, maxLength: 64 }) }), obj({ to: str(), date: str() })),
};

export const Routines = remote("p2.routines", {
	version: 1,
	params: {},
	hostAddress: serverHost,
	variants: { owner: { methods: ROUTINE_METHODS }, agent: { methods: ROUTINE_METHODS } },
});
