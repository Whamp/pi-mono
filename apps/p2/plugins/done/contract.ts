// Done's server owns card links and credentials. Only the session worker opens its Durable conversation.
import { arr, bool, int, nul, num, obj, opt, type Static, str, union } from "@earendil-works/pi-schema";
import { literal, method, param, remote, serverHost, sessionHost } from "@p2/app/v1";

export const LocationSchema = union([literal("fleet"), literal("household"), literal("shop")]);
export type DoneLocation = Static<typeof LocationSchema>;

const Facts = arr(obj({ label: str(), value: str() }));
export const WriteCard = obj({ title: str(), facts: Facts, did: str() });
export const AskOwner = obj({ prompt: str(), options: opt(arr(str())) });
export const CompleteCard = obj({ did: str(), verified: str() });
export const Park = union([
	obj({ kind: literal("question"), task: int(), prompt: str(), options: opt(arr(str())) }),
	obj({ kind: literal("timer"), task: int(), until: num() }),
]);
export const ParkReceipt = union([
	obj({ kind: literal("question"), task: int(), block: str() }),
	obj({ kind: literal("timer"), task: int(), until: num() }),
]);
export const CardLink = obj({
	session: str(),
	location: LocationSchema,
	park: opt(ParkReceipt),
});
export type DoneLink = Static<typeof CardLink>;

export const TraceTool = obj({ step: str(), words: str() });

export const CommentCard = obj({ text: str() });
export const ResumeCard = obj({ block: str(), text: str() });

/** Card operations are scoped by the calling worker's principal, which supplies the session ID. */
export const DoneCard = remote("p2.done-card", {
	version: 1,
	params: {},
	hostAddress: serverHost,
	variants: {
		worker: {
			methods: {
				write: method(WriteCard),
				comment: method(CommentCard),
				complete: method(CompleteCard),
				park: method(Park, str()),
				resumed: method(ResumeCard),
				trace: method(TraceTool),
			},
		},
	},
});

/** One call holds the target worker long enough to commit an input, deliver a signal, or inspect its park. */
export const DoneIngress = remote("p2.done-ingress", {
	version: 1,
	params: { session: param.str() },
	hostAddress: sessionHost,
	variants: {
		server: {
			methods: {
				input: method(
					obj({
						card: str(),
						text: str(),
						requestId: str(),
						first: opt(bool()),
						script: opt(str()),
						until: opt(num()),
					}),
				),
				answer: method(obj({ task: int(), block: str(), text: str() }), str()),
				wake: method(),
				parkedPid: method(obj({ task: int() }), union([int(), nul()])),
			},
		},
	},
});
