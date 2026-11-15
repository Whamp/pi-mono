// The routines plugin's server facet: once a minute it reads `routines.json` (config.ts) and sends each routine that is
// due (schedule.ts) its message through the conversations broker, which starts the target's worker when it is stopped.
// The last run date of each routine is persisted, so a restart neither sends twice nor skips the day. `Routines` lists
// the routines and runs one now, for the owner and for the agent of a session that is neither shared nor locked.
import { num, obj, opt, str } from "@earendil-works/pi-schema";
import {
	type Ctx,
	defineFacet,
	defineState,
	forbidden,
	isOwner,
	isWorker,
	local,
	record,
	signalOf,
	sleep,
} from "@p2/app/v1";
import { processLogs } from "@p2/app/v1/node";
import { Server, serverOf } from "@p2/app/v1/server";
import { ConversationBroker } from "../conversations/contract.ts";
import { FamiliarStore } from "../familiar/contract.ts";
import { SessionLocks } from "../sessions/contract.ts";
import { Shares } from "../sharing/contract.ts";
import { loadRoutines, type Routine } from "./config.ts";
import { ROUTINE_METHODS, type RoutineStatus, Routines } from "./contract.ts";
import { clockAt, dueDate, requestIdOf } from "./schedule.ts";

/** What the server remembers per routine name (schedule.ts); a name no longer in the file is forgotten. */
const Records = defineState("p2.routine-records", {
	schema: obj({ routines: record(obj({ addedAt: num(), lastRun: opt(str()) })) }),
	version: 1,
	initial: () => ({ routines: {} }),
	persist: true,
	checkpointWhen: () => true,
});

/** The server's routines (host-lifetime: its loop runs from startup). */
const RoutineService = local("p2.routine-service", {
	version: 1,
	params: {},
	members: ROUTINE_METHODS,
});

/** How often the file is read and the routines checked. */
const TICK_MS = 60_000;
/** The source of the owner notices this plugin raises. */
const NOTICE = "routines";

export default defineFacet((host) => {
	host.serve(RoutineService, (_params, self) => {
		const server = self.get(Server, {});
		const natives = serverOf(self);
		const broker = self.get(ConversationBroker, {});
		const familiar = self.get(FamiliarStore, {});
		const records = self.state(Records);
		/** Each routine's last failure, until it runs again. */
		const errors = new Map<string, string>();
		let fileError: string | undefined;

		const load = () => loadRoutines(server.info.value.dataDir);

		/** Sends `routine`'s message now under `requestId` and records `date` as its last run. */
		const send = async (routine: Routine, requestId: string, date: string, ctx: Ctx) => {
			const source = routine.from ?? familiar.session.value;
			if (source === null) throw new Error(`Routine ${routine.name}: no "from" session and no Familiar yet`);
			const message = routine.message.replaceAll(
				"{lastRun}",
				records.value.routines[routine.name]?.lastRun ?? "never",
			);
			// A root of the server's own: the hold on the target's worker ends with the send, not with the loop.
			await natives().root(
				(inner) =>
					broker.query({ source, requestId, query: { action: "send", to: routine.session, message } }, inner),
				ctx,
			);
			await records.change((draft) => {
				draft.routines[routine.name] = {
					addedAt: draft.routines[routine.name]?.addedAt ?? Date.now(),
					lastRun: date,
				};
			}, ctx);
			errors.delete(routine.name);
		};

		/** One check: forget removed routines, remember new ones, send the due ones. */
		const tick = async (ctx: Ctx) => {
			let routines: Routine[];
			try {
				routines = await load();
				fileError = undefined;
			} catch (error) {
				const text = errorText(error);
				// Once per problem: the file is read every minute.
				if (text !== fileError) processLogs.notice(NOTICE, text);
				fileError = text;
				return;
			}
			const now = Date.now();
			const names = new Set(routines.map((routine) => routine.name));
			const known = records.value.routines;
			if (Object.keys(known).some((name) => !names.has(name)) || routines.some((each) => !known[each.name]))
				await records.change((draft) => {
					for (const name of Object.keys(draft.routines)) if (!names.has(name)) delete draft.routines[name];
					for (const name of names) draft.routines[name] ??= { addedAt: now };
				}, ctx);
			for (const routine of routines) {
				const record = records.value.routines[routine.name];
				const date = record && dueDate(routine, record, now);
				if (date === undefined) continue;
				try {
					await send(routine, requestIdOf(routine.name, date), date, ctx);
				} catch (error) {
					if (signalOf(ctx).aborted) throw error;
					// Tried again next minute, the same day only; the owner hears of each new failure once.
					const text = `Routine ${routine.name}: ${errorText(error)}`;
					if (errors.get(routine.name) !== text) processLogs.notice(NOTICE, text);
					errors.set(routine.name, text);
				}
			}
		};

		self.onLive(async (ctx) => {
			for (;;) {
				await tick(ctx);
				await sleep(TICK_MS, ctx);
			}
		});

		return {
			list: async () =>
				(await load()).map((routine): RoutineStatus => {
					const lastRun = records.value.routines[routine.name]?.lastRun;
					const error = errors.get(routine.name);
					return {
						name: routine.name,
						time: routine.time,
						...(routine.timeZone === undefined ? {} : { timeZone: routine.timeZone }),
						session: routine.session,
						...(lastRun === undefined ? {} : { lastRun }),
						...(error === undefined ? {} : { error }),
					};
				}),
			run: async ({ name }, ctx) => {
				const routine = (await load()).find((each) => each.name === name);
				if (!routine) throw new Error(`No routine "${name}" in routines.json`);
				const date = clockAt(Date.now(), routine.timeZone).date;
				// Its own request ID: a run now is never dropped as a repeat of today's scheduled send.
				await send(routine, `${requestIdOf(name, date)}:now:${Date.now()}`, date, ctx);
				return { to: routine.session, date };
			},
		};
	});

	host.serve(Routines, (_params, principal, self) => {
		const service = self.get(RoutineService, {});
		/** The service's methods, each after `check` (which throws to refuse). */
		const guarded = (check: () => void) => ({
			list: (ctx: Ctx) => {
				check();
				return service.list(ctx);
			},
			run: (args: { name: string }, ctx: Ctx) => {
				check();
				return service.run(args, ctx);
			},
		});
		if (isOwner(principal)) return { variant: "owner", members: guarded(() => {}) };
		if (!isWorker(principal)) throw forbidden("Routines are the owner's.");
		const { session } = principal;
		const shares = self.get(Shares, {});
		const locks = self.get(SessionLocks, {});
		// Whoever may write to a shared or locked session could have its agent send the owner's messages.
		const check = () => {
			if (locks.locks.value[session] !== undefined)
				throw forbidden("Routines are the owner's: this session is locked.");
			if (
				shares.links.value.some((link) => link.session === session) ||
				shares.people.value.some((person) => person.session === session)
			)
				throw forbidden("Routines are the owner's: this session is shared.");
		};
		return { variant: "agent", members: guarded(check) };
	});
});

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));
