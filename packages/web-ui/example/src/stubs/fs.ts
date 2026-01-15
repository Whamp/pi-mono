// Browser stub for node:fs
// File system operations aren't available in browsers, so return safe defaults.

export function existsSync(_path: string): boolean {
	return false;
}

export function readFileSync(_path: string, _encoding?: string): string {
	throw new Error("readFileSync is not available in browser");
}

export function writeFileSync(_path: string, _data: string): void {
	throw new Error("writeFileSync is not available in browser");
}

export function mkdirSync(_path: string, _options?: unknown): void {
	throw new Error("mkdirSync is not available in browser");
}

export default {
	existsSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
};
