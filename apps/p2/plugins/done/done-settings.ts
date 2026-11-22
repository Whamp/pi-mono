// Local configuration for the prototype. An optional scheduled run arms one Durable sleep.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { compile, nul, num, obj, opt, str, union } from "@earendil-works/pi-schema";
import { literal, record } from "@p2/app/v1";
import { LocationSchema } from "./contract.ts";

const Location = obj({ env: union([str(), nul()]), folder: str() });

const Settings = compile(
	obj({
		url: str(),
		tokenFile: str(),
		pattern: opt(union([literal("b"), literal("d-a"), literal("d-b")])),
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
	const { locations, ...settings } = parsed;
	return {
		...settings,
		pattern: settings.pattern ?? "b",
		locations: {
			fleet: locations?.fleet ?? { env: "fleet", folder: "~/agents-world/fleet" },
			household: locations?.household ?? { env: null, folder: join(homedir(), "agents-world/household") },
			shop: locations?.shop ?? { env: null, folder: join(homedir(), "agents-world/shop") },
		},
	};
}
