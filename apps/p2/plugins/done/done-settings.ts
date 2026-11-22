// Local configuration for the prototype. An optional scheduled run arms one Durable sleep.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { arr, compile, nul, num, obj, opt, type Static, str, union } from "@earendil-works/pi-schema";
import { literal, record } from "@p2/app/v1";
import { LocationSchema } from "./contract.ts";

const Location = obj({ env: union([str(), nul()]), folder: str() });

const CopySettings = obj({
	id: opt(str({ pattern: "^[a-z0-9][a-z0-9-]*$" })),
	url: str(),
	tokenFile: str(),
	pattern: opt(union([literal("b"), literal("c"), literal("d-a"), literal("d-b")])),
	p2Url: opt(str()),
	locations: opt(obj({ fleet: opt(Location), household: opt(Location), shop: opt(Location) })),
	scripts: opt(record(str())),
	schedule: opt(
		obj({
			id: str(),
			title: str(),
			location: LocationSchema,
			words: str(),
			at: num(),
			script: opt(str()),
		}),
	),
});
const Settings = compile(union([CopySettings, arr(CopySettings)]));

function doneCopySettings({ id, locations, ...settings }: Static<typeof CopySettings>, key: string) {
	return {
		...settings,
		id: id ?? key,
		pattern: settings.pattern ?? "b",
		locations: {
			fleet: locations?.fleet ?? { env: "fleet", folder: "~/agents-world/fleet" },
			household: locations?.household ?? { env: null, folder: join(homedir(), "agents-world/household") },
			shop: locations?.shop ?? { env: null, folder: join(homedir(), "agents-world/shop") },
		},
	};
}

/** One done copy's credentials, pattern and named locations. */
export type DoneCopySettings = ReturnType<typeof doneCopySettings>;

/** The state key for a legacy single-copy configuration and its existing session links. */
export const LEGACY_DONE_COPY = "default";

/** Read each configured done copy, preserving the legacy single-copy configuration. */
export async function loadDoneSettings(dataDir: string): Promise<DoneCopySettings[]> {
	let source: string;
	try {
		source = await readFile(join(dataDir, "done.json"), "utf8");
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
		throw error;
	}
	const parsed: unknown = JSON.parse(source);
	if (!Settings.check(parsed)) throw new Error("Invalid done.json settings");
	if (!Array.isArray(parsed)) return [doneCopySettings({ ...parsed, id: LEGACY_DONE_COPY }, LEGACY_DONE_COPY)];
	const origins = parsed.map(({ url }) => new URL(url).origin);
	const copies = parsed.map((copy, index) => doneCopySettings(copy, origins[index]));
	if (new Set(copies.map(({ id }) => id)).size !== copies.length || new Set(origins).size !== copies.length) {
		throw new Error("Done copy IDs and URLs must be unique.");
	}
	return copies;
}

/** The title prefix that identifies a pattern in P2's session list. */
export function donePatternMark(pattern: DoneCopySettings["pattern"]) {
	return { b: "B", c: "C", "d-a": "D-a", "d-b": "D-b" }[pattern];
}

/** Scope a persisted record to a copy, including IDs that match JavaScript property names. */
export function doneCopyKey(id: string) {
	return `copy:${id}`;
}
