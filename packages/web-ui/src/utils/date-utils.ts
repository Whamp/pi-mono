/**
 * Date grouping utilities for session lists
 */

export type DateGroup = "Today" | "Yesterday" | "Last 7 Days" | "Last 30 Days" | "Older";

export interface GroupedSessions<T> {
	group: DateGroup;
	sessions: T[];
}

/**
 * Get the start of a day (midnight) for a given date
 */
function startOfDay(date: Date): Date {
	const result = new Date(date);
	result.setHours(0, 0, 0, 0);
	return result;
}

/**
 * Get the number of days between two dates (calendar days, not 24h periods)
 */
function daysBetween(date1: Date, date2: Date): number {
	const start1 = startOfDay(date1);
	const start2 = startOfDay(date2);
	const diffMs = start2.getTime() - start1.getTime();
	return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine which date group a date belongs to
 */
function getDateGroup(dateString: string, now: Date): DateGroup {
	const date = new Date(dateString);
	const daysAgo = daysBetween(date, now);

	if (daysAgo === 0) {
		return "Today";
	} else if (daysAgo === 1) {
		return "Yesterday";
	} else if (daysAgo >= 2 && daysAgo <= 7) {
		return "Last 7 Days";
	} else if (daysAgo > 7 && daysAgo <= 30) {
		return "Last 30 Days";
	} else {
		return "Older";
	}
}

/**
 * Group sessions by relative date
 * @param sessions Array of objects with a lastModified field
 * @returns Array of grouped sessions in order (Today, Yesterday, Last 7 Days, Last 30 Days, Older)
 *          Only non-empty groups are returned
 */
export function groupSessionsByDate<T extends { lastModified: string }>(sessions: T[]): GroupedSessions<T>[] {
	const now = new Date();

	// Initialize groups in order
	const groupOrder: DateGroup[] = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Older"];
	const groups: Map<DateGroup, T[]> = new Map(groupOrder.map((g) => [g, []]));

	// Group sessions (maintaining original order within each group)
	for (const session of sessions) {
		const group = getDateGroup(session.lastModified, now);
		groups.get(group)!.push(session);
	}

	// Return only non-empty groups in order
	const result: GroupedSessions<T>[] = [];
	for (const group of groupOrder) {
		const groupSessions = groups.get(group)!;
		if (groupSessions.length > 0) {
			result.push({ group, sessions: groupSessions });
		}
	}

	return result;
}
