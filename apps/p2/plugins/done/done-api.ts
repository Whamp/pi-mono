// Calls done's existing JSON API. The credential never leaves the server facet.
import { readFile } from "node:fs/promises";

export type DoneBlock = {
	id: string;
	type: string;
	[key: string]: unknown;
};

export type DoneItem = {
	id: string;
	title: string;
	origin_text: string | null;
	created_at: string;
	created_by: string;
	status: string;
	turn: string;
	blocks: DoneBlock[];
};

/** A line kept on the card by done. */
export interface DoneThreadEntry {
	actor: string;
	at: string;
	kind: string;
	text: string;
}

export type DoneEvent = {
	seq: number;
	at: string;
	actor: string;
	type: string;
	item_id: string | null;
	data: Record<string, unknown>;
};

export class DoneApi {
	readonly #url: URL;
	readonly #tokenFile: string;
	readonly #from: string | undefined;

	constructor(url: string, tokenFile: string, from?: string) {
		this.#url = new URL(url);
		if (this.#url.protocol !== "http:" || this.#url.hostname !== "127.0.0.1")
			throw new Error("The prototype's done API must be on loopback");
		this.#tokenFile = tokenFile;
		this.#from = from;
	}

	/** Uses inbox, whose cursor waits for the owner's undo hold. */
	async inbox() {
		return (await this.#request<{ events: DoneEvent[] }>("/api/inbox")).events;
	}

	async ack(seq: number) {
		await this.#request("/api/inbox/ack", "POST", { seq });
	}

	async add(title: string, blocks?: DoneBlock[]) {
		return (
			await this.#request<{ item: DoneItem }>("/api/items", "POST", {
				title,
				turn: "agent",
				...(blocks ? { blocks } : {}),
			})
		).item;
	}

	async item(card: string) {
		return (await this.detail(card)).item;
	}

	/** Read the current card and its exact thread from done. */
	async detail(card: string) {
		return this.#request<{ item: DoneItem; thread: DoneThreadEntry[] }>(`/api/items/${card}`);
	}

	/** Read a single event already released by the inbox, even after it was acknowledged. */
	async event(seq: number, card: string) {
		const { events } = await this.#request<{ events: DoneEvent[] }>(`/api/events?after=${seq - 1}&limit=1`);
		const event = events[0];
		if (event?.seq !== seq || event.item_id !== card) {
			throw new Error(`Done event ${seq} for card ${card} was not found.`);
		}
		return event;
	}

	async patch(card: string, body: object) {
		await this.#request(`/api/items/${card}`, "PATCH", body);
	}

	async comment(card: string, text: string) {
		await this.#request(`/api/items/${card}/comments`, "POST", { text });
	}

	async complete(card: string, body: { did: string; verified: string }) {
		await this.#request(`/api/items/${card}/done`, "POST", body);
	}

	async #request<T>(path: string, method = "GET", body?: object): Promise<T> {
		const token = (await readFile(this.#tokenFile, "utf8")).trim();
		const response = await fetch(new URL(path, this.#url), {
			method,
			redirect: "error",
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json",
				...(this.#from ? { "Done-From": this.#from } : {}),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: AbortSignal.timeout(5_000),
		});
		if (!response.ok) {
			const error: { error?: { code?: string; message?: string } } = await response.json();
			throw new Error(`done ${method} ${path} returned ${response.status}: ${error.error?.message ?? "API error"}`);
		}
		return response.json();
	}
}

/** Keep every block when adding a question, and reuse its ID on tool replay. */
export async function putDoneQuestion(
	api: DoneApi,
	card: string,
	question: { id: string; prompt: string; options?: string[] },
) {
	const item = await api.item(card);
	if (item.blocks.some((block) => block.id === question.id)) return;
	const block = {
		...question,
		type: "question",
		kind: question.options ? "choice" : "text",
	};
	await api.patch(card, { blocks: [...item.blocks, block], turn: "owner", did: question.prompt });
}
