import type { GraphNode, GraphRunResult, GraphRunStep } from "@rune/sdk";

import { createRuneSession } from "../session/index.ts";
import { getFinalAssistantText } from "./graph.final.ts";
import { buildNodeUserMessage } from "./graph.message.ts";

export interface RunGraphOptions {
	graphId: string;
	/** Ordered source→sink nodes (from validateGraph path). */
	nodes: GraphNode[];
	prompt: string;
	cwd?: string;
	/**
	 * Optional node runner for tests. Default: isolated createRuneSession + prompt
	 * per node with profile activation.
	 */
	runNode?: GraphNodeRunner;
}

/** Runs one graph node; returns final assistant text only. */
export type GraphNodeRunner = (options: {
	node: GraphNode;
	input: string;
	cwd: string;
}) => Promise<string>;

function nowIso(): string {
	return new Date().toISOString();
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/**
 * Default node runner: new in-memory session per node so system prompt / model /
 * skills match that node's profile (profile isolation over reuse).
 */
export async function runGraphNodeWithSession(options: {
	node: GraphNode;
	input: string;
	cwd: string;
}): Promise<string> {
	const { session } = await createRuneSession({
		cwd: options.cwd,
		inMemory: true,
		profile: options.node.profile,
	});
	try {
		await session.prompt(options.input);
		// Final = last assistant text parts only (not tool traces).
		return getFinalAssistantText(session.messages);
	} finally {
		session.dispose();
	}
}

/**
 * Execute a validated linear graph. Caller MUST pass nodes already ordered
 * source→sink (same path as checkGraph / validateGraph).
 */
export async function runGraph(
	options: RunGraphOptions,
): Promise<GraphRunResult> {
	const cwd = options.cwd ?? process.cwd();
	const runNode = options.runNode ?? runGraphNodeWithSession;
	const startedAt = nowIso();
	const steps: GraphRunStep[] = [];
	let inherited = options.prompt;

	for (const node of options.nodes) {
		const input = buildNodeUserMessage(node, inherited);
		const stepStarted = nowIso();
		try {
			const output = await runNode({ node, input, cwd });
			steps.push({
				nodeId: node.id,
				profile: node.profile,
				input,
				output,
				status: "ok",
				startedAt: stepStarted,
				finishedAt: nowIso(),
			});
			inherited = output;
		} catch (err) {
			const message = errorMessage(err);
			steps.push({
				nodeId: node.id,
				profile: node.profile,
				input,
				status: "error",
				error: message,
				startedAt: stepStarted,
				finishedAt: nowIso(),
			});
			return {
				graphId: options.graphId,
				startedAt,
				finishedAt: nowIso(),
				status: "error",
				initialPrompt: options.prompt,
				steps,
				error: `Node "${node.id}" failed: ${message}`,
			};
		}
	}

	const last = steps[steps.length - 1];
	return {
		graphId: options.graphId,
		startedAt,
		finishedAt: nowIso(),
		status: "ok",
		initialPrompt: options.prompt,
		steps,
		final: last?.output ?? "",
	};
}
