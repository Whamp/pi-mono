// Routines (`routines.json`): parsing and validation, and when a routine is due: once a day at its time in its time
// zone, a day missed while the server was down caught up the same day only, and one request ID per routine and day;
// running one now through `Routines` (fake provider).
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { BACKGROUND_CONTEXT } from "@p2/app/v1";
import { Chat } from "../../plugins/chat/contract.ts";
import { parseRoutines } from "../../plugins/routines/config.ts";
import { Routines } from "../../plugins/routines/contract.ts";
import { clockAt, dueDate, requestIdOf } from "../../plugins/routines/schedule.ts";
import { Sessions } from "../../plugins/sessions/contract.ts";
import { PEER_MESSAGE_ENTRY } from "../../src/runtime/entries.ts";
import { holdIn, startFixture, until } from "./helpers.ts";

/** 08:00 in Los Angeles; its dates and times below are Los Angeles wall clocks. */
const ROUTINE = { minutes: 8 * 60, timeZone: "America/Los_Angeles" };
/** A Los Angeles wall clock in November (PST, UTC-8) as ms. */
const la = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour + 8, minute);
/** Added long before any day below. */
const OLD = la(1, 12);

test("routines.json: entries with their minutes, comments allowed, invalid files say why", () => {
	assert.deepEqual(
		parseRoutines(`// a comment
		{ "p3-watch": { "time": "08:30", "timeZone": "America/Los_Angeles", "session": "s1", "message": "Check p3", }, }`),
		[
			{
				name: "p3-watch",
				time: "08:30",
				minutes: 510,
				timeZone: "America/Los_Angeles",
				session: "s1",
				message: "Check p3",
			},
		],
	);
	assert.deepEqual(parseRoutines("{}"), []);
	for (const [content, error] of [
		["{", /syntax/],
		["[]", /must be an object/],
		['{ "P3": { "time": "08:00", "session": "s", "message": "m" } }', /Invalid routine name/],
		['{ "a": { "time": "8:00", "session": "s", "message": "m" } }', /Routine a: needs/],
		['{ "a": { "time": "24:00", "session": "s", "message": "m" } }', /Routine a: needs/],
		['{ "a": { "time": "08:00", "session": "s" } }', /Routine a: needs/],
		['{ "a": { "time": "08:00", "session": "s", "message": "m", "cron": "x" } }', /Routine a: needs/],
		['{ "a": { "time": "08:00", "timeZone": "Mars/Base", "session": "s", "message": "m" } }', /unknown time zone/],
	] as const)
		assert.throws(() => parseRoutines(content), error, content);
});

test("clockAt reads the wall clock of the routine's time zone, not the server's", () => {
	// 03:30 UTC on the 16th is still the 15th in Los Angeles.
	assert.deepEqual(clockAt(Date.UTC(2026, 10, 16, 3, 30), "America/Los_Angeles"), {
		date: "2026-11-15",
		minutes: 1170,
	});
	assert.deepEqual(clockAt(Date.UTC(2026, 10, 16, 3, 30), "UTC"), { date: "2026-11-16", minutes: 210 });
});

test("a routine runs once a day at its time", () => {
	// Before its time: not yet; at its time and later: today's run, until it ran today.
	assert.equal(dueDate(ROUTINE, { addedAt: OLD, lastRun: "2026-11-14" }, la(15, 7, 59)), undefined);
	assert.equal(dueDate(ROUTINE, { addedAt: OLD, lastRun: "2026-11-14" }, la(15, 8)), "2026-11-15");
	assert.equal(dueDate(ROUTINE, { addedAt: OLD, lastRun: "2026-11-14" }, la(15, 23, 59)), "2026-11-15");
	assert.equal(dueDate(ROUTINE, { addedAt: OLD, lastRun: "2026-11-15" }, la(15, 8)), undefined);
	assert.equal(dueDate(ROUTINE, { addedAt: OLD, lastRun: "2026-11-15" }, la(15, 23, 59)), undefined);
	// A routine that never ran is due at its time.
	assert.equal(dueDate(ROUTINE, { addedAt: OLD }, la(15, 8)), "2026-11-15");
});

test("a day missed while the server was down runs when it comes back, the same day only", () => {
	// Down over 08:00, back at 14:00: today's run, once.
	assert.equal(dueDate(ROUTINE, { addedAt: OLD, lastRun: "2026-11-14" }, la(15, 14)), "2026-11-15");
	// Down for days: only today's run, not one per missed day; before today's time, nothing.
	assert.equal(dueDate(ROUTINE, { addedAt: OLD, lastRun: "2026-11-10" }, la(15, 14)), "2026-11-15");
	assert.equal(dueDate(ROUTINE, { addedAt: OLD, lastRun: "2026-11-10" }, la(15, 7)), undefined);
});

test("a routine added after its time today waits for tomorrow", () => {
	assert.equal(dueDate(ROUTINE, { addedAt: la(15, 15) }, la(15, 15, 1)), undefined);
	assert.equal(dueDate(ROUTINE, { addedAt: la(15, 15) }, la(16, 7, 59)), undefined);
	assert.equal(dueDate(ROUTINE, { addedAt: la(15, 15) }, la(16, 8)), "2026-11-16");
	// Added before its time today: today's run.
	assert.equal(dueDate(ROUTINE, { addedAt: la(15, 7) }, la(15, 8)), "2026-11-15");
});

test("a scheduled send's request ID is the same all day and differs between days and routines", () => {
	const morning = clockAt(la(15, 8), ROUTINE.timeZone).date;
	const evening = clockAt(la(15, 23, 59), ROUTINE.timeZone).date;
	assert.equal(requestIdOf("p3-watch", morning), requestIdOf("p3-watch", evening));
	assert.notEqual(requestIdOf("p3-watch", "2026-11-15"), requestIdOf("p3-watch", "2026-11-16"));
	assert.notEqual(requestIdOf("p3-watch", "2026-11-15"), requestIdOf("other", "2026-11-15"));
});

test("running a routine now sends its message to its session, from its sender, every time", async () => {
	const fixture = await startFixture();
	try {
		const owner = fixture.browser();
		const sessions = await holdIn(owner, Sessions, {}, "owner");
		const from = (await sessions.create({ cwd: fixture.workspace, title: "Sender" }, BACKGROUND_CONTEXT)).id;
		const target = (await sessions.create({ cwd: fixture.workspace, title: "Target" }, BACKGROUND_CONTEXT)).id;
		await writeFile(
			join(fixture.dataDir, "routines.json"),
			JSON.stringify({
				watch: { time: "08:00", timeZone: "UTC", session: target, from, message: "Check since {lastRun}" },
				orphan: { time: "08:00", session: target, message: "No sender" },
			}),
		);
		const routines = await holdIn(owner, Routines, {}, "owner");
		const today = clockAt(Date.now(), "UTC").date;
		assert.deepEqual(await routines.run({ name: "watch" }, BACKGROUND_CONTEXT), { to: target, date: today });
		assert.deepEqual(await routines.run({ name: "watch" }, BACKGROUND_CONTEXT), { to: target, date: today });
		const chat = await holdIn(owner, Chat, { session: target, conversation: 1 }, "participant");
		const view = await until(
			chat.view,
			(value) => (value?.entries ?? []).filter((entry) => entry.kind === PEER_MESSAGE_ENTRY).length === 2,
		);
		const texts = (view?.entries ?? [])
			.filter((entry) => entry.kind === PEER_MESSAGE_ENTRY)
			.map((entry) => entry.data);
		// The second run is not dropped as a repeat, and it names the first run's date.
		assert.deepEqual(texts, [
			{ from: { id: from, title: "Sender" }, text: "Check since never" },
			{ from: { id: from, title: "Sender" }, text: `Check since ${today}` },
		]);
		const listed = await routines.list(BACKGROUND_CONTEXT);
		assert.deepEqual(
			listed.find((routine) => routine.name === "watch"),
			{ name: "watch", time: "08:00", timeZone: "UTC", session: target, lastRun: today },
		);
		// Without "from" the Familiar sends, and this server has none yet.
		await assert.rejects(routines.run({ name: "orphan" }, BACKGROUND_CONTEXT), /no "from" session and no Familiar/);
		await assert.rejects(routines.run({ name: "missing" }, BACKGROUND_CONTEXT), /No routine "missing"/);
	} finally {
		await fixture.close();
	}
});
