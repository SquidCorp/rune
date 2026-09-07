import { describe, expect, test } from "bun:test";
import type { GraphNode } from "@rune/sdk";

import { getFinalAssistantText } from "./graph.final.ts";
import { buildNodeUserMessage } from "./graph.message.ts";
import { runGraph } from "./graph.run.ts";

describe("buildNodeUserMessage", () => {
	test("wraps inherited with insert and append", () => {
		expect(
			buildNodeUserMessage({ insert: "PREFIX:", append: ":SUFFIX" }, "body"),
		).toBe("PREFIX:body:SUFFIX");
	});

	test("treats missing insert/append as empty", () => {
		expect(buildNodeUserMessage({}, "only")).toBe("only");
	});
});

describe("getFinalAssistantText", () => {
	test("returns last assistant text parts only", () => {
		const messages = [
			{ role: "user", content: [{ type: "text", text: "hi" }] },
			{
				role: "assistant",
				content: [
					{ type: "text", text: "first" },
					{ type: "toolCall", name: "x", arguments: {} },
				],
			},
			{
				role: "assistant",
				content: [
					{ type: "toolCall", name: "y", arguments: {} },
					{ type: "text", text: "final-a" },
					{ type: "text", text: "-b" },
				],
			},
		];
		expect(getFinalAssistantText(messages)).toBe("final-a-b");
	});

	test("returns empty when no assistant text", () => {
		expect(getFinalAssistantText([{ role: "user", content: [] }])).toBe("");
	});
});

describe("runGraph", () => {
	const nodes: GraphNode[] = [
		{ id: "plan", profile: "planner", insert: "P:" },
		{ id: "write", profile: "writer", append: ":W" },
	];

	test("chains final assistant text with insert/append", async () => {
		const calls: Array<{ profile: string; input: string }> = [];
		const result = await runGraph({
			graphId: "draft",
			nodes,
			prompt: "seed",
			runNode: async ({ node, input }) => {
				calls.push({ profile: node.profile, input });
				return `out-${node.id}`;
			},
		});

		expect(result.status).toBe("ok");
		expect(result.final).toBe("out-write");
		expect(calls).toEqual([
			{ profile: "planner", input: "P:seed" },
			{ profile: "writer", input: "out-plan:W" },
		]);
		expect(result.steps.map((s) => s.output)).toEqual([
			"out-plan",
			"out-write",
		]);
	});

	test("keeps partial steps on mid-chain failure", async () => {
		const result = await runGraph({
			graphId: "draft",
			nodes,
			prompt: "seed",
			runNode: async ({ node, input }) => {
				if (node.id === "write") throw new Error("boom");
				return `ok:${input}`;
			},
		});

		expect(result.status).toBe("error");
		expect(result.steps).toHaveLength(2);
		expect(result.steps[0]?.status).toBe("ok");
		expect(result.steps[0]?.output).toBe("ok:P:seed");
		expect(result.steps[1]?.status).toBe("error");
		expect(result.steps[1]?.error).toBe("boom");
		expect(result.final).toBeUndefined();
		expect(result.error).toContain('Node "write" failed');
	});
});
