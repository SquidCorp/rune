import { describe, expect, test } from "bun:test";
import type { GraphNode } from "@rune/sdk";

import { sessionEventToDiag, truncateDiagText } from "./graph.diag.ts";
import { getFinalAssistantText } from "./graph.final.ts";
import { buildNodeUserMessage } from "./graph.message.ts";
import { runGraph } from "./graph.run.ts";

const chainNodes: GraphNode[] = [
	{ id: "plan", profile: "planner", insert: "P:" },
	{ id: "write", profile: "writer", append: ":W" },
];

const planOnly: GraphNode[] = [
	{ id: "plan", profile: "planner", insert: "P:" },
];

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

describe("sessionEventToDiag", () => {
	test("maps user and assistant message_end", () => {
		expect(
			sessionEventToDiag({
				type: "message_end",
				message: {
					role: "user",
					content: [{ type: "text", text: "hello" }],
				},
			}),
		).toEqual({ type: "user", text: "hello" });

		expect(
			sessionEventToDiag({
				type: "message_end",
				message: {
					role: "assistant",
					content: [
						{ type: "text", text: "a" },
						{ type: "text", text: "b" },
					],
				},
			}),
		).toEqual({ type: "assistant", text: "ab" });
	});

	test("maps tool_execution_end and ignores deltas", () => {
		expect(
			sessionEventToDiag({
				type: "tool_execution_end",
				toolName: "read",
				isError: false,
			}),
		).toEqual({ type: "tool", name: "read", ok: true });

		expect(
			sessionEventToDiag({
				type: "tool_execution_end",
				toolName: "bash",
				isError: true,
			}),
		).toEqual({ type: "tool", name: "bash", ok: false });

		expect(
			sessionEventToDiag({
				type: "message_update",
				assistantMessageEvent: { type: "thinking_delta", delta: "nope" },
			}),
		).toBeUndefined();
	});

	test("truncates long message text", () => {
		const long = "x".repeat(400);
		const diag = sessionEventToDiag({
			type: "message_end",
			message: { role: "user", content: long },
		});
		expect(diag).toEqual({
			type: "user",
			text: truncateDiagText(long),
		});
		expect(diag && "text" in diag ? diag.text.length : 0).toBe(301);
	});
});

describe("runGraph chain", () => {
	test("chains final assistant text with insert/append", async () => {
		const calls: Array<{ profile: string; input: string }> = [];
		const result = await runGraph({
			graphId: "draft",
			nodes: chainNodes,
			prompt: "seed",
			runNode: async ({ node, input }) => {
				calls.push({ profile: node.profile, input });
				return { output: `out-${node.id}` };
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
		expect(result.steps[0]?.events).toBeUndefined();
	});

	test("keeps partial steps on mid-chain failure", async () => {
		const result = await runGraph({
			graphId: "draft",
			nodes: chainNodes,
			prompt: "seed",
			runNode: async ({ node, input }) => {
				if (node.id === "write") throw new Error("boom");
				return { output: `ok:${input}` };
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

describe("runGraph verbose events", () => {
	test("attaches events when verbose", async () => {
		const result = await runGraph({
			graphId: "draft",
			nodes: planOnly,
			prompt: "seed",
			verbose: true,
			runNode: async () => ({
				output: "out",
				events: [
					{ type: "user", text: "P:seed" },
					{ type: "tool", name: "read", ok: true },
					{ type: "assistant", text: "out" },
				],
			}),
		});

		expect(result.status).toBe("ok");
		expect(result.steps[0]?.events).toEqual([
			{ type: "user", text: "P:seed" },
			{ type: "tool", name: "read", ok: true },
			{ type: "assistant", text: "out" },
		]);
	});

	test("ignores runner events when not verbose", async () => {
		const result = await runGraph({
			graphId: "draft",
			nodes: planOnly,
			prompt: "seed",
			runNode: async () => ({
				output: "out",
				events: [{ type: "user", text: "secret" }],
			}),
		});

		expect(result.steps[0]?.events).toBeUndefined();
	});
});
