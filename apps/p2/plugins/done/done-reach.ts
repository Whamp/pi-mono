// A copy's settings decide the resources attached to its sessions before a worker can start.
import type { Ctx, Ref } from "@p2/app/v1";
import type { SessionLocks } from "../sessions/contract.ts";
import type { DoneLocation } from "./contract.ts";
import type { DoneCopySettings } from "./done-settings.ts";

const FILE_TOOLS = ["bash", "read", "edit", "write"];
const CARD_TOOLS = ["done_read", "done_update"];

/** Install the session lock before creating its catalog row. Legacy copies keep their existing setup. */
export async function lockDoneSession(
	locks: Ref<typeof SessionLocks>,
	config: DoneCopySettings,
	session: string,
	location: DoneLocation | "home",
	ctx: Ctx,
): Promise<void> {
	if (!config.confine || locks.locks.value[session]?.confinement) return;
	const names = location === "home" ? [] : config.pattern === "c" ? Object.keys(config.locations) : [location];
	const locations = Object.entries(config.locations)
		.filter(([name]) => names.includes(name))
		.map(([, { env, folder }]) => ({ env, cwd: folder }));
	const tools =
		location === "home"
			? ["done_dispatch", "done_report", "done_publish"]
			: config.pattern === "b"
				? [...FILE_TOOLS, "ask_owner", "done_sleep_until", "done_write", "done_comment", "done_complete"]
				: [...FILE_TOOLS, ...CARD_TOOLS, config.pattern === "c" ? "done_move" : "done_transfer"];
	await locks.set(
		{
			session,
			lock: { mcp: [], projectMcp: false, instructions: false, capabilities: [], confinement: { tools, locations } },
		},
		ctx,
	);
}
