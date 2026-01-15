export interface ExportableSession {
	id: string;
	title: string;
	messages: unknown[]; // The actual message data
	metadata?: {
		createdAt?: string;
		lastModified?: string;
		model?: string;
		[key: string]: unknown;
	};
}

/**
 * Export a session as a JSON file download
 * @param session The session data to export
 * @param filename Optional filename (defaults to session title or id)
 */
export function exportSessionAsJson(session: ExportableSession, filename?: string): void {
	const data = JSON.stringify(session, null, 2);
	const blob = new Blob([data], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const sanitizedTitle = (filename || session.title || session.id).replace(/[^a-z0-9]/gi, "_").substring(0, 50);

	const a = document.createElement("a");
	a.href = url;
	a.download = `${sanitizedTitle}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
