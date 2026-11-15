// `routines.json` in the data directory: `{ "<name>": { "time": "08:00", "timeZone"?: "<IANA zone>", "session": "<id>",
// "message": "<text>", "from"?: "<id>" } }`. Each routine sends `message` to session `session` once a day at `time` in
// `timeZone` (the server's own without it), from session `from` (the Familiar without it).
import { join } from "node:path";
import { compile, obj, opt, str } from "@earendil-works/pi-schema";
import { optionalText, stripBom, stripJsonComments } from "@p2/app/v1/node";

/** One routine of the file, its time as minutes after midnight. */
export type Routine = {
	name: string;
	time: string;
	minutes: number;
	timeZone?: string;
	session: string;
	from?: string;
	message: string;
};

/** A routine's name: what `run` and the tool take. */
const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const isEntry = compile(
	obj({
		time: str({ pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" }),
		timeZone: opt(str({ minLength: 1, maxLength: 64 })),
		session: str({ minLength: 1, maxLength: 200 }),
		from: opt(str({ minLength: 1, maxLength: 200 })),
		// The conversations broker's limit.
		message: str({ minLength: 1, maxLength: 32768 }),
	}),
).check;

/** Reads `routines.json`'s text; throws with the first problem, naming the routine. */
export function parseRoutines(content: string): Routine[] {
	let value: unknown;
	try {
		value = JSON.parse(stripJsonComments(stripBom(content)));
	} catch (error) {
		throw new Error(`Invalid routines.json syntax: ${error instanceof Error ? error.message : String(error)}`, {
			cause: error,
		});
	}
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("routines.json must be an object of routines");
	return Object.entries(value).map(([name, entry]: [string, unknown]) => {
		if (!NAME.test(name)) throw new Error(`Invalid routine name "${name}" (lowercase letters, digits, - and _)`);
		if (!isEntry(entry))
			throw new Error(
				`Routine ${name}: needs "time" ("HH:MM"), "session" and "message"; "timeZone" and "from" are optional`,
			);
		if (entry.timeZone !== undefined && !isTimeZone(entry.timeZone))
			throw new Error(`Routine ${name}: unknown time zone ${entry.timeZone}`);
		const [hours, minutes] = entry.time.split(":").map(Number);
		return { name, ...entry, minutes: hours * 60 + minutes };
	});
}

/** Whether `name` is a time zone this runtime knows. */
function isTimeZone(name: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: name });
		return true;
	} catch (error) {
		// Intl's answer for a zone it does not know.
		if (error instanceof RangeError) return false;
		throw error;
	}
}

/** The routines of `directory`'s `routines.json` (none without one). */
export async function loadRoutines(directory: string): Promise<Routine[]> {
	return parseRoutines((await optionalText(join(directory, "routines.json"))) ?? "{}");
}
