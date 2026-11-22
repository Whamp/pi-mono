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
	status: string;
	turn: string;
	blocks: DoneBlock[];
};

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

	constructor(url: string, tokenFile: string) {
		this.#url = new URL(url);
		if (this.#url.protocol !== "http:" || this.#url.hostname !== "127.0.0.1")
			throw new Error("The prototype's done API must be on loopback");
		this.#tokenFile = tokenFile;
	}

	/** Uses inbox, whose cursor waits for the owner's undo hold. */
	async inbox() {
		return (await this.#request<{ events: DoneEvent[] }>("/api/inbox")).events;
	}

	async ack(seq: number) {
		await this.#request("/api/inbox/ack", "POST", { seq });
	}

	async add(title: string) {
		return (await this.#request<{ item: DoneItem }>("/api/items", "POST", { title, turn: "agent" })).item;
	}

	async item(card: string) {
		return (await this.#request<{ item: DoneItem }>(`/api/items/${card}`)).item;
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
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
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
