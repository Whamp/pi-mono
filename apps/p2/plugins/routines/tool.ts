// The agent's routines tools, for code mode only (namespace `routines`): list the owner's daily routines and run one
// now, through `Routines` on the server (its `agent` variant). Never in a locked session; the server also refuses them
// while the session is shared.
import { defineExtension, type ToolNamespace } from "@earendil-works/pi-durable";
import { obj, str } from "@earendil-works/pi-schema";
import type { Context } from "@p2/app/v1";
import { defineP2Tool, type P2Tool } from "@p2/app/v1/worker";
import type { RoutineStatus } from "./contract.ts";

/** What the tools reach: `Routines` on the server, as the session's worker. */
export type RoutinesBackend = {
	list(context: Context): Promise<RoutineStatus[]>;
	run(name: string, context: Context): Promise<{ to: string; date: string }>;
};

/** The namespace of the routines tools in code mode. */
const ROUTINES_NAMESPACE: ToolNamespace = {
	name: "routines",
	description:
		"The owner's daily routines (routines.json in p2's data directory: a message sent to a session at a set time each day): routines_list, routines_run.",
	instructions: [
		'routines.json is `{ "<name>": { "time": "HH:MM", "timeZone"?: "<IANA zone, default the server\'s>", "session": "<target session ID>", "message": "<text; {lastRun} becomes the previous run\'s date>", "from"?: "<sender session ID, default the Familiar>" } }`. Edits apply within a minute.',
		"routines_run sends a routine's message now and counts today as run.",
	].join("\n"),
};

/** The routines tools, reaching the server through `backend`. */
export function createRoutinesExtension(backend: RoutinesBackend) {
	return defineExtension<P2Tool>({
		name: "p2-routines",
		namespace: ROUTINES_NAMESPACE,
		tools: [
			defineP2Tool({
				name: "routines_list",
				description:
					"Every routine: name, time, time zone, target session, the date it last ran and its last failure.",
				parameters: obj({}),
				...ROUTINES_TOOL,
				execute: (_args, _api, context) =>
					textOf(async () => {
						const lines = (await backend.list(context)).map(
							(routine) =>
								`${routine.name}: ${routine.time}${routine.timeZone ? ` ${routine.timeZone}` : ""} to session ${routine.session}, last run ${routine.lastRun ?? "never"}${routine.error ? `; failed: ${routine.error}` : ""}`,
						);
						return lines.join("\n") || "No routines (routines.json is missing or empty).";
					}, context),
			}),
			defineP2Tool({
				name: "routines_run",
				description: "Sends routine `name`'s message to its session now; today counts as its run.",
				parameters: obj({ name: str({ minLength: 1, maxLength: 64 }) }),
				...ROUTINES_TOOL,
				execute: ({ name }, _api, context) =>
					textOf(async () => {
						const { to, date } = await backend.run(name, context);
						return `Sent routine ${name} to session ${to} (run of ${date}).`;
					}, context),
			}),
		],
	});
}

/** What both tools share: code mode only, deferred, never in a locked session. */
const ROUTINES_TOOL = {
	callers: ["tools"],
	// Listed by namespace only: rarely used, so it takes no room in the code-mode section.
	deferred: true,
	// A run sends a message: a replayed call would send it twice.
	replay: "unsafe",
	locked: "never",
} as const;

/** `run`'s text as the tool's result, or its error as a failed result. */
async function textOf(run: () => Promise<string>, context: Context) {
	try {
		return { output: [{ type: "text" as const, text: await run() }], details: {} };
	} catch (error) {
		if (context.abortSignal?.aborted) throw error;
		const text = error instanceof Error ? error.message : String(error);
		return { output: [{ type: "text" as const, text }], isError: true };
	}
}
