import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadDoneSettings } from "./done-settings.ts";

test("Done location settings preserve defaults and honor environment and folder overrides", async () => {
	const dir = await mkdtemp(join(tmpdir(), "p2-done-settings-"));
	try {
		assert.equal(await loadDoneSettings(dir), undefined);
		const base = { url: "http://127.0.0.1:4910", tokenFile: "/tmp/example-token" };
		const path = join(dir, "done.json");
		await writeFile(path, JSON.stringify(base));
		assert.deepEqual((await loadDoneSettings(dir))?.locations, {
			fleet: { env: "fleet", folder: "~/agents-world/fleet" },
			household: { env: null, folder: join(homedir(), "agents-world/household") },
			shop: { env: null, folder: join(homedir(), "agents-world/shop") },
		});

		const locations = {
			fleet: { env: "test-fleet", folder: "~/fixture/fleet" },
			household: { env: null, folder: "/tmp/fixture/household" },
			shop: { env: "test-shop", folder: "/tmp/fixture/shop" },
		};
		await writeFile(path, JSON.stringify({ ...base, locations }));
		assert.deepEqual((await loadDoneSettings(dir))?.locations, locations);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
