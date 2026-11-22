import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadDoneSettings } from "./done-settings.ts";

test("Done location settings preserve defaults and honor environment and folder overrides", async () => {
	const dir = await mkdtemp(join(tmpdir(), "p2-done-settings-"));
	try {
		assert.deepEqual(await loadDoneSettings(dir), []);
		const base = { url: "http://127.0.0.1:4910", tokenFile: "/tmp/example-token" };
		const path = join(dir, "done.json");
		await writeFile(path, JSON.stringify(base));
		assert.equal((await loadDoneSettings(dir))[0]?.pattern, "b");
		assert.deepEqual((await loadDoneSettings(dir))[0]?.locations, {
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
		assert.deepEqual((await loadDoneSettings(dir))[0]?.locations, locations);
		for (const pattern of ["b", "c", "d-a", "d-b"]) {
			await writeFile(path, JSON.stringify({ ...base, pattern }));
			assert.equal((await loadDoneSettings(dir))[0]?.pattern, pattern);
		}
		await writeFile(path, JSON.stringify({ ...base, pattern: "unknown" }));
		await assert.rejects(loadDoneSettings(dir), /Invalid done.json settings/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("Done copies keep their own credentials, pattern and locations", async () => {
	const dir = await mkdtemp(join(tmpdir(), "p2-done-settings-"));
	try {
		const path = join(dir, "done.json");
		const first = { id: "camera", url: "http://127.0.0.1:4911", tokenFile: "/tmp/camera-token", pattern: "b" };
		const second = {
			url: "http://127.0.0.1:4912",
			tokenFile: "/tmp/shop-token",
			pattern: "d-b",
			locations: { shop: { env: null, folder: "/tmp/other-shop" } },
		};
		await writeFile(path, JSON.stringify([first, second]));
		const copies = await loadDoneSettings(dir);
		assert.deepEqual(
			copies.map(({ id, tokenFile, pattern }) => ({ id, tokenFile, pattern })),
			[
				{ id: first.id, tokenFile: first.tokenFile, pattern: "b" },
				{ id: second.url, tokenFile: second.tokenFile, pattern: "d-b" },
			],
		);
		assert.equal(copies[1]?.locations.shop.folder, "/tmp/other-shop");
		assert.notEqual(copies[0]?.locations.shop.folder, copies[1]?.locations.shop.folder);
		await writeFile(path, JSON.stringify([first, { ...second, id: first.id }]));
		await assert.rejects(loadDoneSettings(dir), /IDs and URLs must be unique/);
		await writeFile(path, JSON.stringify([first, { ...second, url: `${first.url}/` }]));
		await assert.rejects(loadDoneSettings(dir), /IDs and URLs must be unique/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
