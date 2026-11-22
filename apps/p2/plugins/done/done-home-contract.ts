// Home admits typed notices. The location input carries only a card ID.
import { int, obj, opt, type Static, str, union } from "@earendil-works/pi-schema";
import { literal, method, param, propertiesOf, remote, serverHost, sessionHost } from "@p2/app/v1";
import { AskOwner, CompleteCard, LocationSchema, WriteCard } from "./contract.ts";

/** Read the card held by the calling location session. */
export const Card = obj({ card: str() });
/** Handle the matching Home notice, with a model choice only when the table has no answer. */
export const Route = obj({ card: str(), notice: int(), location: opt(LocationSchema) });
/** Report a destination and one short reason without copying the owner request. */
export const Transfer = obj({
	card: str(),
	location: LocationSchema,
	reason: str({ minLength: 1, maxLength: 200, pattern: "^[^\\r\\n]+$" }),
});
/** Stage the specialist’s card changes as one update. */
export const Update = obj({
	card: str(),
	write: opt(WriteCard),
	question: opt(AskOwner),
	complete: opt(CompleteCard),
	draft: opt(obj({ to: str(), body: str() })),
	comment: opt(str()),
});
/** Retrieve or publish the report named by the notice. */
export const Publish = obj({ card: str(), notice: int(), summary: opt(str()) });

/** A location's card update. A draft without a question is returned to the owner. */
export type HomeUpdate = Static<typeof Update>;

/** Home notice persisted on the server and sent to the Familiar. */
export const Notice = union([
	obj({ kind: literal("dispatch"), card: str(), notice: int(), detail: str() }),
	obj({ kind: literal("publish"), card: str(), notice: int() }),
	obj({ kind: literal("state"), card: str(), state: str() }),
]);

/** The P2 Familiar receives only routing information and notices of state or ready reports. */
export type HomeNotice = Static<typeof Notice>;

/** Worker start data for a registered location or the Familiar. */
export const HOME_ROLE = "done-home-role";

/** Transcript prefix distinguishing the inbox from ordinary Familiar chat. */
export const HOME_NOTICE_PREFIX = "Done Home notice ";

const Assignment = union([
	obj({ kind: literal("home"), notice: Notice, requestId: str() }),
	obj({ kind: literal("location"), card: str(), requestId: str(), script: opt(str()) }),
]);

/** The location submits a card ID. The script selector is fake-model metadata. */
export type HomeAssignment = Static<typeof Assignment>;

/** Only P2's server may send a Home notice or a card ID to a worker. */
export const DoneHomeIngress = remote("p2.done-home-ingress", {
	version: 1,
	params: { session: param.str() },
	hostAddress: sessionHost,
	variants: {
		server: {
			methods: { submit: method(Assignment) },
		},
	},
});

/** Card operations are checked against the caller's actual role and card assignment. */
export const HomeOperation = union([
	obj({ kind: literal("dispatch"), ...propertiesOf(Route) }),
	obj({ kind: literal("read"), ...propertiesOf(Card) }),
	obj({ kind: literal("update"), ...propertiesOf(Update) }),
	obj({ kind: literal("transfer"), ...propertiesOf(Transfer) }),
	obj({ kind: literal("report"), ...propertiesOf(Publish) }),
	obj({ kind: literal("publish"), ...propertiesOf(Publish) }),
	obj({ kind: literal("trace"), card: opt(str()), step: str(), words: str(), pid: int() }),
]);

/** A typed request from a Home or location worker. */
export type HomeOperation = Static<typeof HomeOperation>;

/** Card operations are scoped by the caller's actual session on P2's server. */
export const DoneHomeCard = remote("p2.done-home-card", {
	version: 1,
	params: {},
	hostAddress: serverHost,
	variants: { worker: { methods: { run: method(HomeOperation, str()) } } },
});
