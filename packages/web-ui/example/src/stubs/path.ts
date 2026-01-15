// Browser stub for node:path
// Basic path operations for browser compatibility

export function join(...paths: string[]): string {
	return paths.join("/").replace(/\/+/g, "/");
}

export function resolve(...paths: string[]): string {
	return join(...paths);
}

export function dirname(p: string): string {
	const parts = p.split("/");
	parts.pop();
	return parts.join("/") || "/";
}

export function basename(p: string, ext?: string): string {
	const base = p.split("/").pop() || "";
	if (ext && base.endsWith(ext)) {
		return base.slice(0, -ext.length);
	}
	return base;
}

export function extname(p: string): string {
	const base = basename(p);
	const dot = base.lastIndexOf(".");
	return dot > 0 ? base.slice(dot) : "";
}

export const sep = "/";
export const delimiter = ":";

export default {
	join,
	resolve,
	dirname,
	basename,
	extname,
	sep,
	delimiter,
};
