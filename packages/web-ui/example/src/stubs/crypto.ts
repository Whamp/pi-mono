// Browser stub for node:crypto
// These providers (google-gemini-cli, openai-codex) won't work in browser,
// but this stub allows the app to load without errors.

export function createHash(_algorithm: string) {
	return {
		update(_data: string) {
			return this;
		},
		digest(_encoding: string) {
			// Return a dummy hash - these providers won't work in browser anyway
			return "0000000000000000000000000000000000000000000000000000000000000000";
		},
	};
}

export function randomBytes(size: number): Uint8Array {
	const bytes = new Uint8Array(size);
	crypto.getRandomValues(bytes);
	return bytes;
}
