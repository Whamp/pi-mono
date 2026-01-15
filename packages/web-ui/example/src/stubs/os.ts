// Browser stub for node:os
// These providers won't work in browser, but this stub allows the app to load.

export function hostname(): string {
	return "browser";
}

export function platform(): string {
	return "browser";
}

export function arch(): string {
	return "unknown";
}

export function userInfo() {
	return { username: "browser-user" };
}

export function homedir(): string {
	return "/home/browser";
}

export default {
	hostname,
	platform,
	arch,
	userInfo,
	homedir,
};
