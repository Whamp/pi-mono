// Prompt resources (Pi Mobile's context files): the global AGENTS.md of the data directory is always local; a remote
// environment's file at the same path is another file and is read too, a local session's (also below the data
// directory, or through a link to it) is not read twice.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as nodePath from "node:path";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node";
import { loadPromptResources, localFiles, type PromptFiles } from "../../plugins/prompt/context-files.ts";
import { envFiles } from "../../plugins/prompt/environment.ts";

test("a remote file at the local global AGENTS.md path is its own file", async (t) => {
	const directory = mkdtempSync(join(tmpdir(), "p2-context-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	writeFileSync(join(directory, "AGENTS.md"), "LOCAL GLOBAL");
	// Local session working in the data directory: the global file once.
	const local = await loadPromptResources(directory, directory);
	assert.equal(local.agents.match(/LOCAL GLOBAL/g)?.length, 1);
	// Remote session whose cwd has the same path: the remote AGENTS.md there is read as well.
	const remote: PromptFiles = {
		paths: { join, dirname, resolve, basename },
		local: false,
		readText: async (path) => (path === join(directory, "AGENTS.md") ? "REMOTE PROJECT" : undefined),
		entries: async () => undefined,
	};
	const resources = await loadPromptResources(directory, directory, remote);
	assert.match(resources.agents, /LOCAL GLOBAL/);
	assert.match(resources.agents, /REMOTE PROJECT/);
});

test("a local session working below the data directory gets the global AGENTS.md once, by its canonical path", async (t) => {
	const directory = mkdtempSync(join(tmpdir(), "p2-context-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	writeFileSync(join(directory, "AGENTS.md"), "LOCAL GLOBAL");
	mkdirSync(join(directory, "plugins", "counter"), { recursive: true });
	writeFileSync(join(directory, "plugins", "AGENTS.md"), "PLUGINS PROJECT");
	// Through the session's environment (as the worker reads them) and through the local files alike.
	const env = new NodeExecutionEnv({ cwd: join(directory, "plugins", "counter") });
	for (const files of [envFiles(env, nodePath), localFiles]) {
		const loaded = await loadPromptResources(directory, join(directory, "plugins", "counter"), files);
		assert.equal(loaded.agents.match(/LOCAL GLOBAL/g)?.length, 1, loaded.agents);
		assert.match(loaded.agents, /PLUGINS PROJECT/);
	}
	// The data directory reached through a symbolic link: the same file, still once.
	const link = `${directory}-link`;
	symlinkSync(directory, link);
	t.after(() => rmSync(link, { force: true }));
	const linked = await loadPromptResources(
		directory,
		join(link, "plugins"),
		envFiles(new NodeExecutionEnv({ cwd: join(link, "plugins") }), nodePath),
	);
	assert.equal(linked.agents.match(/LOCAL GLOBAL/g)?.length, 1, linked.agents);
});

test("skills follow pi's discovery: root .md files, SKILL.md directories, invalid files skipped", async (t) => {
	const directory = mkdtempSync(join(tmpdir(), "p2-skills-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const skills = join(directory, "skills");
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(skills, path)), { recursive: true });
		writeFileSync(join(skills, path), content);
	};
	write("release.md", "---\nname: release\ndescription: Root file skill.\n---\nBody");
	write("README.md", "# Not a skill: no frontmatter");
	write("broken.md", "---\nname: [unclosed\n---\n");
	write("deploy/SKILL.md", "---\ndescription: Directory skill, named after its directory.\n---\n");
	write("deploy/notes.md", "---\nname: notes\ndescription: Inside a skill directory: not a skill.\n---\n");
	write("group/nested.md", "---\nname: nested\ndescription: Below the root without SKILL.md: not a skill.\n---\n");
	write("group/odd/SKILL.md", "---\nname: Odd Name\ndescription: pi only warns about the name.\n---\n");
	write("node_modules/dep/SKILL.md", "---\nname: dep\ndescription: Skipped.\n---\n");
	write(".hidden/SKILL.md", "---\nname: hidden\ndescription: Skipped.\n---\n");
	const loaded = await loadPromptResources(directory, directory);
	assert.deepEqual(
		loaded.skillFiles.map(({ name, path }) => [name, path]),
		[
			["deploy", join(skills, "deploy", "SKILL.md")],
			["Odd Name", join(skills, "group", "odd", "SKILL.md")],
			["release", join(skills, "release.md")],
		],
	);
});

test("each entry of a skillDirs folder is a skills root, links followed, once beside a plugin's root", async (t) => {
	const directory = mkdtempSync(join(tmpdir(), "p2-skill-dirs-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(directory, path)), { recursive: true });
		writeFileSync(join(directory, path), content);
	};
	// Fleet's layout: `~/.agents/skills/<name>`, each a link to a skill folder kept elsewhere.
	write("fleet/review/SKILL.md", "---\nname: review\ndescription: Linked skill.\n---\n");
	write("fleet/deploy/SKILL.md", "---\nname: deploy\ndescription: Loses to the project's deploy.\n---\n");
	write("fleet/notes.md", "---\nname: notes\ndescription: A file entry: not a root.\n---\n");
	write("agents/real/SKILL.md", "---\nname: real\ndescription: A plain folder entry.\n---\n");
	write("agents/.hidden/SKILL.md", "---\nname: hidden\ndescription: Skipped.\n---\n");
	write("workspace/.pi/skills/deploy/SKILL.md", "---\nname: deploy\ndescription: The project's.\n---\n");
	const agents = join(directory, "agents");
	symlinkSync(join(directory, "fleet", "review"), join(agents, "review"));
	symlinkSync(join(directory, "fleet", "deploy"), join(agents, "deploy"));
	symlinkSync(join(directory, "fleet", "notes.md"), join(agents, "notes"));
	symlinkSync(join(directory, "fleet", "gone"), join(agents, "broken"));
	const workspace = join(directory, "workspace");
	const env = new NodeExecutionEnv({ cwd: workspace });
	for (const files of [envFiles(env, nodePath), localFiles]) {
		// The fleet-skills plugin registers the same entry as a root of its own: its skill is listed once.
		const loaded = await loadPromptResources(
			directory,
			workspace,
			files,
			join(directory, "skills"),
			join(directory, "prompts"),
			[join(agents, "review")],
			[agents, join(directory, "missing")],
		);
		assert.deepEqual(
			loaded.skillFiles.map(({ name, path }) => [name, path]),
			[
				["deploy", join(workspace, ".pi", "skills", "deploy", "SKILL.md")],
				["real", join(agents, "real", "SKILL.md")],
				["review", join(agents, "review", "SKILL.md")],
			],
		);
		// They are global skills: a locked session without the global instructions has only the project's.
		assert.deepEqual(
			loaded.project?.skillFiles.map(({ name }) => name),
			["deploy"],
		);
	}
});
