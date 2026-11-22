// Local configuration for the prototype. An optional scheduled run arms one Durable sleep.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { compile, num, obj, opt, str } from "@earendil-works/pi-schema";
import { record } from "@p2/app/v1";
import { LocationSchema } from "./contract.ts";

const Settings = compile(
	obj({
		url: str(),
		tokenFile: str(),
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
	}),
);

/** Read the local URL and credential path, or leave the plugin inactive with no configuration. */
export async function loadDoneSettings(dataDir: string) {
	let source: string;
	try {
		source = await readFile(join(dataDir, "done.json"), "utf8");
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined;
		throw error;
	}
	const parsed: unknown = JSON.parse(source);
	if (!Settings.check(parsed)) throw new Error("Invalid done.json settings");
	return parsed;
}
