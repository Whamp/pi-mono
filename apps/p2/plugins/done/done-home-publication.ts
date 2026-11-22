// Publish the same structured specialist update in either variant.
import { type DoneApi, type DoneBlock, putDoneQuestion } from "./done-api.ts";
import type { HomeUpdate } from "./done-home-contract.ts";

/** Apply the specialist's exact findings. An optional Home summary sits beside the source. */
export async function publishHomeUpdate(
	api: DoneApi,
	target: string,
	update: HomeUpdate,
	version: number,
	summary?: string,
) {
	if (update.write || update.draft || summary) {
		const item = await api.item(target);
		const blocks: DoneBlock[] = [];
		if (update.write) {
			blocks.push({ id: "done-facts", type: "facts", rows: update.write.facts });
		}
		if (summary) {
			blocks.push({ id: "done-home-summary", type: "text", md: `Home's summary: ${summary}` });
		}
		if (update.draft) {
			blocks.push({ id: "done-draft", type: "draft", ...update.draft });
		}
		await api.patch(target, {
			did: update.write?.did ?? (update.draft ? "Prepared a draft for you." : "Added Home's summary."),
			...(update.write ? { title: update.write.title } : {}),
			...(update.draft ? { turn: "owner" } : {}),
			blocks: [...item.blocks.filter((old) => !blocks.some((block) => old.id === block.id)), ...blocks],
		});
	}
	if (update.question) {
		await putDoneQuestion(api, target, { id: `done-question-${version}`, ...update.question });
	}
	if (update.comment) {
		await api.comment(target, update.comment);
	}
	if (update.complete) {
		await api.complete(target, update.complete);
	}
}
