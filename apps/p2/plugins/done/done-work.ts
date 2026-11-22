// A persisted attempt gives the next server enough information to return an interrupted card.
import { int, num, obj, opt, type Static, str } from "@earendil-works/pi-schema";
import type { WorkerState } from "@p2/app/v1/server";
import type { DoneApi, DoneEvent } from "./done-api.ts";

export const DoneAnswerReceipt = obj({ block: str(), text: str() });
export type DoneAnswerReceipt = Static<typeof DoneAnswerReceipt>;

export const DoneAttempt = obj({
	id: str(),
	deadline: num(),
	session: opt(str()),
	attempted: opt(str()),
	pid: opt(int()),
});
export type DoneAttempt = Static<typeof DoneAttempt>;

export const doneFailure = {
	silent: "The session ended before it finished or asked a question. Check the card and tell me what to try next.",
	timeout: "The work took too long and I stopped the session. Check what changed before asking me to retry.",
	interrupted:
		"The session stopped during work. I could not confirm the outcome. Check what changed before asking me to retry.",
	changed: "Your answer changed, so I stopped. Check what already happened and tell me when to continue.",
	unavailable: (location: string) =>
		`I could not reach the ${location} location. Check that it is online before asking me to retry.`,
};

export function doneAnswerReceipt(event: DoneEvent): DoneAnswerReceipt | undefined {
	const { block_id: block, answer: text } = event.data;
	return event.type === "question.answered" && typeof block === "string" && typeof text === "string"
		? { block, text }
		: undefined;
}

/** Inspect the current answer only as a veto. The newer words still arrive through the held inbox. */
export async function doneAnswerChanged(api: DoneApi, card: string, used: DoneAnswerReceipt | undefined) {
	if (!used) return false;
	const block = (await api.item(card)).blocks.find(({ id }) => id === used.block);
	return block?.answer !== used.text;
}

/** Reopen work the agent marked Done if the approval it used was superseded. */
export async function returnDoneCard(api: DoneApi, card: string, line: string, changed = false) {
	let { item, thread } = await api.detail(card);
	if (changed && item.status === "done" && item.done_by?.startsWith("agent:")) {
		await api.reopen(card);
		item = await api.item(card);
	}
	if (item.status !== "open") return;
	// The marker is on the card so a lost HTTP response or a restart does not duplicate the line.
	if (thread.some((entry) => entry.actor.startsWith("agent:") && entry.text === line) && item.turn === "owner") return;
	await api.patch(card, { turn: "owner", did: line });
}

export function interruptedDoneLine(attempt: DoneAttempt) {
	return attempt.attempted
		? `The session stopped during ${attempt.attempted}. I could not confirm the outcome. Check what changed before asking me to retry.`
		: doneFailure.interrupted;
}

/** A new worker can show the old transcript. It cannot be assumed to have continued a running command. */
export function stoppedDoneAttempt(
	attempt: DoneAttempt,
	epoch: string,
	worker: WorkerState | undefined,
	startedGeneration: number | undefined,
) {
	if (!attempt.id.startsWith(epoch)) return true;
	if (startedGeneration !== undefined && (worker?.error !== undefined || worker?.generation !== startedGeneration)) {
		return true;
	}
	if (attempt.pid === undefined) return false;
	try {
		process.kill(attempt.pid, 0);
		return false;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ESRCH") return true;
		throw error;
	}
}
