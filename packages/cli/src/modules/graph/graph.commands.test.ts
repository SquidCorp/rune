import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GraphRunRequest, GraphRunResult, RuneClient } from "@rune/sdk";

import { runGraphCommand } from "./graph.commands.ts";

function mockClient(run: () => Promise<GraphRunResult>): RuneClient {
	return {
		runGraph: async () => run(),
	} as unknown as RuneClient;
}

function promptClient(
	onRun: (body: GraphRunRequest) => Promise<GraphRunResult>,
): RuneClient {
	return {
		runGraph: async (_id: string, body: GraphRunRequest) => onRun(body),
	} as unknown as RuneClient;
}

function okResult(final: string): GraphRunResult {
	return {
		graphId: "draft",
		startedAt: "t0",
		finishedAt: "t1",
		status: "ok",
		initialPrompt: "seed",
		steps: [
			{
				nodeId: "a",
				profile: "p",
				input: "seed",
				output: "mid",
				status: "ok",
				startedAt: "t0",
				finishedAt: "t0",
			},
			{
				nodeId: "b",
				profile: "q",
				input: "mid",
				output: final,
				status: "ok",
				startedAt: "t1",
				finishedAt: "t1",
			},
		],
		final,
	};
}

async function withCapturedStdout(fn: () => Promise<void>): Promise<string> {
	const originalWrite = process.stdout.write.bind(process.stdout);
	let stdout = "";
	process.stdout.write = ((chunk: string | Uint8Array) => {
		stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
		return true;
	}) as typeof process.stdout.write;
	try {
		await fn();
		return stdout;
	} finally {
		process.stdout.write = originalWrite;
	}
}

async function withCapturedStderr(fn: () => Promise<void>): Promise<string> {
	const originalError = console.error;
	const lines: string[] = [];
	console.error = (...args: unknown[]) => {
		lines.push(args.map(String).join(" "));
	};
	try {
		await fn();
		return lines.join("\n");
	} finally {
		console.error = originalError;
	}
}

describe("rune graph run flags", () => {
	test("requires prompt or prompt-file", async () => {
		await expect(
			runGraphCommand({
				client: mockClient(async () => {
					throw new Error("should not run");
				}),
				sub: "run",
				rest: ["draft"],
				printHelp: () => {},
			}),
		).rejects.toThrow(/--prompt/);
	});

	test("rejects both prompt flags", async () => {
		await expect(
			runGraphCommand({
				client: mockClient(async () => {
					throw new Error("should not run");
				}),
				sub: "run",
				rest: ["draft", "--prompt", "a", "--prompt-file", "b"],
				printHelp: () => {},
			}),
		).rejects.toThrow(/not both/);
	});

	test("reads prompt-file", async () => {
		const dir = mkdtempSync(join(tmpdir(), "rune-cli-prompt-"));
		const promptPath = join(dir, "p.txt");
		writeFileSync(promptPath, "from-file", "utf-8");
		let seenPrompt = "";

		await withCapturedStdout(async () => {
			await runGraphCommand({
				client: promptClient(async (body) => {
					seenPrompt = body.prompt;
					return okResult("ok");
				}),
				sub: "run",
				rest: ["draft", "--prompt-file", promptPath],
				printHelp: () => {},
			});
		});

		expect(seenPrompt).toBe("from-file");
	});
});

describe("rune graph run verbose flag", () => {
	test("passes verbose true on --verbose", async () => {
		let seenVerbose: boolean | undefined;
		await withCapturedStderr(async () => {
			await withCapturedStdout(async () => {
				await runGraphCommand({
					client: promptClient(async (body) => {
						seenVerbose = body.verbose;
						return okResult("ok");
					}),
					sub: "run",
					rest: ["draft", "--prompt", "seed", "--verbose"],
					printHelp: () => {},
				});
			});
		});
		expect(seenVerbose).toBe(true);
	});

	test("omits verbose field without --verbose", async () => {
		let seenBody: GraphRunRequest | undefined;
		await withCapturedStdout(async () => {
			await runGraphCommand({
				client: promptClient(async (body) => {
					seenBody = body;
					return okResult("ok");
				}),
				sub: "run",
				rest: ["draft", "--prompt", "seed"],
				printHelp: () => {},
			});
		});
		expect(seenBody).toEqual({ prompt: "seed" });
	});

	test("prints session events on stderr", async () => {
		const result = okResult("FINAL");
		result.steps[0] = {
			nodeId: "a",
			profile: "p",
			input: "seed",
			output: "mid",
			status: "ok",
			startedAt: "t0",
			finishedAt: "t0",
			events: [
				{ type: "user", text: "seed" },
				{ type: "tool", name: "read", ok: true },
				{ type: "assistant", text: "mid" },
			],
		};

		const stderr = await withCapturedStderr(async () => {
			await withCapturedStdout(async () => {
				await runGraphCommand({
					client: mockClient(async () => result),
					sub: "run",
					rest: ["draft", "--prompt", "seed", "--verbose"],
					printHelp: () => {},
				});
			});
		});

		expect(stderr).toContain("[graph] run draft");
		expect(stderr).toContain("[graph] a user: seed");
		expect(stderr).toContain("[graph] a tool read ok");
		expect(stderr).toContain("[graph] a assistant: mid");
		expect(stderr).toContain("[graph] a ok (3 chars)");
	});
});

describe("rune graph run output", () => {
	test("prints final only and writes log", async () => {
		const dir = mkdtempSync(join(tmpdir(), "rune-cli-graph-"));
		const logPath = join(dir, "out.json");
		const result = okResult("FINAL");

		const stdout = await withCapturedStdout(async () => {
			await runGraphCommand({
				client: mockClient(async () => result),
				sub: "run",
				rest: ["draft", "--prompt", "seed", "--log", logPath],
				printHelp: () => {},
			});
		});

		expect(stdout).toBe("FINAL\n");
		const logged = JSON.parse(await Bun.file(logPath).text()) as GraphRunResult;
		expect(logged.final).toBe("FINAL");
		expect(logged.steps).toHaveLength(2);
	});

	test("writes log then throws on run error", async () => {
		const dir = mkdtempSync(join(tmpdir(), "rune-cli-graph-err-"));
		const logPath = join(dir, "out.json");
		const result: GraphRunResult = {
			graphId: "draft",
			startedAt: "t0",
			finishedAt: "t1",
			status: "error",
			initialPrompt: "seed",
			steps: [
				{
					nodeId: "a",
					profile: "p",
					input: "seed",
					status: "error",
					error: "nope",
					startedAt: "t0",
					finishedAt: "t1",
				},
			],
			error: 'Node "a" failed: nope',
		};

		await expect(
			runGraphCommand({
				client: mockClient(async () => result),
				sub: "run",
				rest: ["draft", "--prompt", "seed", "--log", logPath],
				printHelp: () => {},
			}),
		).rejects.toThrow(/failed/);

		const logged = JSON.parse(await Bun.file(logPath).text()) as GraphRunResult;
		expect(logged.status).toBe("error");
		expect(logged.steps).toHaveLength(1);
	});
});
