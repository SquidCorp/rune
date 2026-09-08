import type {
	GraphNode,
	GraphRunResult,
	GraphRunStep,
	GraphSessionDiagEvent,
} from "@rune/sdk";

import { createRuneSession } from "../session/index.ts";
import { sessionEventToDiag } from "./graph.diag.ts";
import { getFinalAssistantText } from "./graph.final.ts";
import { buildNodeUserMessage } from "./graph.message.ts";

export interface RunGraphOptions {
	graphId: string;
	/** Ordered source→sink nodes (from validateGraph path). */
	nodes: GraphNode[];
	prompt: string;
	cwd?: string;
	/** Buffer sparse session diagnostics onto each step. */
	verbose?: boolean;
	/**
	 * Optional node runner for tests. Default: isolated createRuneSession + prompt
	 * per node with profile activation.
	 */
	runNode?: GraphNodeRunner;
}

/** Result of one graph node run. */
export interface GraphNodeRunResult {
	/** Final assistant text only (chain inheritance). */
	output: string;
	/** Sparse session diagnostics when verbose collection ran. */
	events?: GraphSessionDiagEvent[];
}

/** Runs one graph node. */
export type GraphNodeRunner = (options: {
	node: GraphNode;
	input: string;
	cwd: string;
	verbose?: boolean;
}) => Promise<GraphNodeRunResult>;

function nowIso(): string {
	return new Date().toISOString();
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function okStep(options: {
	node: GraphNode;
	input: string;
	output: string;
	startedAt: string;
	verbose: boolean;
	events?: GraphSessionDiagEvent[];
}): GraphRunStep {
	const step: GraphRunStep = {
		nodeId: options.node.id,
		profile: options.node.profile,
		input: options.input,
		output: options.output,
		status: "ok",
		startedAt: options.startedAt,
		finishedAt: nowIso(),
	};
	if (options.verbose) step.events = options.events ?? [];
	return step;
}

function errorStep(options: {
	node: GraphNode;
	input: string;
	error: string;
	startedAt: string;
	verbose: boolean;
}): GraphRunStep {
	const step: GraphRunStep = {
		nodeId: options.node.id,
		profile: options.node.profile,
		input: options.input,
		status: "error",
		error: options.error,
		startedAt: options.startedAt,
		finishedAt: nowIso(),
	};
	if (options.verbose) step.events = [];
	return step;
}

/**
 * Default node runner: new in-memory session per node so system prompt / model /
 * skills match that node's profile (profile isolation over reuse).
 * When verbose, subscribes to session events and buffers sparse diagnostics.
 */
export async function runGraphNodeWithSession(options: {
	node: GraphNode;
	input: string;
	cwd: string;
	verbose?: boolean;
}): Promise<GraphNodeRunResult> {
	const { session } = await createRuneSession({
		cwd: options.cwd,
		inMemory: true,
		profile: options.node.profile,
	});
	const events: GraphSessionDiagEvent[] = [];
	let unsubscribe: (() => void) | undefined;
	try {
		if (options.verbose) {
			unsubscribe = session.subscribe((event) => {
				const diag = sessionEventToDiag(event);
				if (diag) events.push(diag);
			});
		}
		await session.prompt(options.input);
		// Final = last assistant text parts only (not tool traces).
		const output = getFinalAssistantText(session.messages);
		if (options.verbose) return { output, events };
		return { output };
	} finally {
		unsubscribe?.();
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
	const verbose = options.verbose === true;
	const startedAt = nowIso();
	const steps: GraphRunStep[] = [];
	let inherited = options.prompt;

	for (const node of options.nodes) {
		const input = buildNodeUserMessage(node, inherited);
		const stepStarted = nowIso();
		try {
			const nodeResult = await runNode({ node, input, cwd, verbose });
			steps.push(
				okStep({
					node,
					input,
					output: nodeResult.output,
					startedAt: stepStarted,
					verbose,
					events: nodeResult.events,
				}),
			);
			inherited = nodeResult.output;
		} catch (err) {
			const message = errorMessage(err);
			steps.push(
				errorStep({
					node,
					input,
					error: message,
					startedAt: stepStarted,
					verbose,
				}),
			);
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
