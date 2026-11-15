// When a routine runs: once a day at its time in its time zone, on the same day only. A day whose time passed while the
// server was down runs when it comes back; an earlier missed day does not. A routine added after its time today
// waits for tomorrow.
import type { Routine } from "./config.ts";

/** What the server remembers of a routine: when it first saw it (ms) and the date it last ran (absent: never). */
export type RoutineRecord = { addedAt: number; lastRun?: string };

/** A moment as a wall clock in a time zone: its date (YYYY-MM-DD) and its minutes after midnight. */
export type Clock = { date: string; minutes: number };

/** `at` (ms) as a wall clock in `timeZone` (the server's own when undefined). */
export function clockAt(at: number, timeZone: string | undefined): Clock {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(at);
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((each) => each.type === type)?.value ?? "";
	return {
		date: `${part("year")}-${part("month")}-${part("day")}`,
		minutes: Number(part("hour")) * 60 + Number(part("minute")),
	};
}

/** The date (in the routine's time zone) whose run is due at `now`, or undefined when nothing is due. */
export function dueDate(
	routine: Pick<Routine, "minutes" | "timeZone">,
	record: RoutineRecord,
	now: number,
): string | undefined {
	const today = clockAt(now, routine.timeZone);
	if (today.minutes < routine.minutes || record.lastRun === today.date) return undefined;
	const added = clockAt(record.addedAt, routine.timeZone);
	const addedBeforeTime = added.date < today.date || added.minutes < routine.minutes;
	return addedBeforeTime ? today.date : undefined;
}

/** The request ID of routine `name`'s scheduled send on `date`: the same all day, so a repeated send is dropped. */
export function requestIdOf(name: string, date: string): string {
	return `routine:${name}:${date}`;
}
