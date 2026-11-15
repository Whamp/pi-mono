// The owner's routines (worker): the agent's `routines` tools, reaching `Routines` on the server in roots of the
// worker's own (it acts as the session's worker there, whose calls the server checks: neither shared nor locked).
import { type Ctx, contribute, defineFacet, expectVariant } from "@p2/app/v1";
import { Extensions, workerOf } from "@p2/app/v1/worker";
import { Routines } from "./contract.ts";
import { createRoutinesExtension } from "./tool.ts";

export default defineFacet((host) => {
	contribute(host, "p2.routines-tools", (self) => {
		const worker = workerOf(self);
		const routines = async (ctx: Ctx) => expectVariant(await ctx.get(Routines, {}), "agent");
		const extension = createRoutinesExtension({
			list: (context) => worker().root(async (ctx) => (await routines(ctx)).list(ctx), context),
			run: (name, context) => worker().root(async (ctx) => (await routines(ctx)).run({ name }, ctx), context),
		});
		self.contribute(Extensions, { [extension.name]: extension });
	});
});
