// The dispatcher runs once per card, using its maker or the fixed R1 table and R2 question.
import type { DoneLocation } from "./contract.ts";

const ROUTES: Record<DoneLocation, RegExp> = {
	fleet: /\b(fleet|cameras?|services?|harbor|lantern|anvil|vaultkeep|mediabox|backups?|recorder|shop-web)\b/i,
	household: /\b(household|calendars?|contacts?|messages?)\b/i,
	shop: /\b(shop|prices?|code|tests?|discounts?|rounding)\b/i,
};

/** The single question asked when the table cannot pick one location. */
export const RoutingQuestion = {
	id: "done-location",
	prompt: "Where does this card belong?",
	options: ["fleet", "household", "shop"],
};

export type DoneRoute =
	| { kind: "location"; location: DoneLocation; rule: "R0" | "R1/R2" }
	| { kind: "question"; rule: "R2"; matches: DoneLocation[] };

/** Route by known maker, or by one distinct location in the owner's words. */
export function routeDoneCard(words: string, maker?: DoneLocation): DoneRoute {
	if (maker !== undefined) return { kind: "location", location: maker, rule: "R0" };
	// The compound service name belongs to fleet, even though one of its words is a location.
	const address = words.replace(/\bshop-web\b/gi, "recorder");
	const matches = (["fleet", "household", "shop"] as const).filter((location) => ROUTES[location].test(address));
	const [location] = matches;
	return location !== undefined && matches.length === 1
		? { kind: "location", rule: "R1/R2", location }
		: { kind: "question", rule: "R2", matches };
}

/** Recognize a location choice from done without coercing its text. */
export function isDoneLocation(text: string): text is DoneLocation {
	return Object.hasOwn(ROUTES, text);
}
