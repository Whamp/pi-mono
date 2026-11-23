// Run the entire pi-env filesystem and shell protocol inside one filesystem and network boundary.
import { posix } from "node:path";
import {
	Connection,
	deployDaemon,
	detectPlatform,
	localDaemon,
	RemoteExecutionEnv,
	type SshConnectOptions,
	sshArguments,
} from "@earendil-works/pi-env";
import type { Location, Machine } from "@p2/app/v1/worker";

/** Open a Bubblewrap environment on this host or the selected SSH host. Fail before use if isolation cannot start. */
export async function openBubblewrapLocation(
	location: Location,
	ssh: SshConnectOptions | undefined,
	signal: AbortSignal,
): Promise<Machine> {
	const args = (daemon: string) => [
		"/usr/bin/bwrap",
		"--unshare-all",
		// The SSH host runs Bubblewrap's normal namespace set without the extra nesting this option requires.
		...(ssh ? [] : ["--unshare-user", "--disable-userns"]),
		"--die-with-parent",
		"--new-session",
		"--clearenv",
		"--ro-bind",
		"/usr",
		"/usr",
		"--ro-bind",
		"/bin",
		"/bin",
		"--ro-bind",
		"/lib",
		"/lib",
		"--ro-bind-try",
		"/lib64",
		"/lib64",
		"--dev",
		"/dev",
		"--tmpfs",
		"/tmp",
		"--dir",
		"/home/agent",
		"--setenv",
		"HOME",
		"/home/agent",
		"--setenv",
		"PATH",
		"/usr/bin:/bin",
		"--setenv",
		"AW_ACTOR",
		"p2",
		...(location.cwd === "/" ? [] : ["--bind", location.cwd, location.cwd]),
		"--chdir",
		location.cwd,
		"--ro-bind",
		daemon,
		"/pi-env",
		"--",
		"/pi-env",
	];
	const connection = new Connection({
		command: async () => {
			if (!ssh) return args(localDaemon());
			const remote = await detectPlatform(ssh);
			if (remote.platform !== "linux") throw new Error("Bubblewrap confinement requires Linux.");
			// Keep the bootstrap binary out of both the writable mount and the host's Pi configuration.
			const home = posix.join(posix.dirname(location.cwd), ".p2-confined");
			const daemon = await deployDaemon(ssh, { ...remote, home });
			const command = args(daemon)
				.map((word) => `'${word.replaceAll("'", "'\\''")}'`)
				.join(" ");
			return [ssh.ssh ?? "ssh", ...sshArguments(ssh), `exec ${command}`];
		},
	});
	try {
		await connection.info(signal);
	} catch (error) {
		connection.close();
		throw error;
	}
	return {
		at: (cwd) =>
			new RemoteExecutionEnv({
				connection,
				cwd,
				id: `bubblewrap:${JSON.stringify(location)}`,
				shellPath: "/bin/bash",
			}),
		close: () => connection.close(),
	};
}
