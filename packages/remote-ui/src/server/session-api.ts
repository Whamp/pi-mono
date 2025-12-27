import { SessionManager } from '@mariozechner/pi-coding-agent';

export async function listSessions() {
    const cwd = process.cwd();
    const sessions = SessionManager.list(cwd);

    // Sort by modified timestamp descending
    return sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}
