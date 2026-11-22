import assert from "node:assert/strict";
import { test } from "node:test";
import { isDoneLocation, RoutingQuestion, routeDoneCard } from "./done-routing.ts";

test("routes the owner's exact camera, household and shop words with the fixed table", () => {
	for (const [text, location] of [
		["kitchen camera is down", "fleet"],
		["Check my calendar and contact", "household"],
		["Fix the shop's discount rounding.", "shop"],
		["Restart shop-web", "fleet"],
	]) {
		assert.deepEqual(routeDoneCard(text), { kind: "location", location, rule: "R1/R2" });
	}
});

test("an existing maker keeps a card in its location", () => {
	assert.deepEqual(routeDoneCard("check the calendar", "fleet"), {
		kind: "location",
		location: "fleet",
		rule: "R0",
	});
});

test("zero and multiple matches both ask once with the same fixed choices", () => {
	assert.deepEqual(routeDoneCard("sort this out"), { kind: "question", rule: "R2", matches: [] });
	assert.deepEqual(routeDoneCard("test the camera"), { kind: "question", rule: "R2", matches: ["fleet", "shop"] });
	assert.deepEqual(RoutingQuestion.options, ["fleet", "household", "shop"]);
	assert(RoutingQuestion.options.every(isDoneLocation));
	assert.equal(isDoneLocation("constructor"), false);
});
