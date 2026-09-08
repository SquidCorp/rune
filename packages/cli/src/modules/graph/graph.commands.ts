import { readFileSync, writeFileSync } from "node:fs";
import type {
	Graph,
	GraphCheckResult,
	GraphRunResult,
	GraphSessionDiagEvent,
	RuneClient,
} from "@rune/sdk";

function requireGraphId(rest: string[], usage: string): string {
	const id = rest[0];
	if (!id || id.startsWith("--")) {
		throw new Error(usage);
	}
	return id;
}

function flagValue(args: string[], name: string): string | undefined {
	const idx = args.indexOf(name);
	if (idx === -1) return undefined;
	const value = args[idx + 1];
	if (value === undefined || value.startsWith("--") || !value.trim()) {
		throw new Error(`${name} requires a value`);
	}
	return value;
}

function hasFlag(args: string[], name: string): boolean {
	return args.includes(name);
}

function readPromptFile(path: string): string {
	try {
		return readFileSync(path, "utf-8");
	} catch {
		throw new Error(`Cannot read --prompt-file "${path}"`);
	}
}

/** Exactly one of --prompt / --prompt-file required for graph run. */
function readRequiredPrompt(args: string[]): string {
	const hasPrompt = args.includes("--prompt");
	const hasFile = args.includes("--prompt-file");
	if (hasPrompt && hasFile) {
		throw new Error("Use either --prompt or --prompt-file, not both");
	}
	if (!hasPrompt && !hasFile) {
		throw new Error(
			"Usage: rune graph run <graph-id> --prompt <string> | --prompt-file <path> [--log <path>] [--verbose]",
		);
	}
	if (hasFile) {
		const path = flagValue(args, "--prompt-file");
		if (!path) throw new Error("--prompt-file requires a value");
		return readPromptFile(path);
	}
	const prompt = flagValue(args, "--prompt");
	if (prompt === undefined) throw new Error("--prompt requires a value");
	return prompt;
}

async function cmdGraphList(client: RuneClient): Promise<void> {
	const graphs = await client.listGraphs();
	if (graphs.length === 0) {
		console.log("No graphs yet.");
		return;
	}
	for (const graph of graphs) {
		const label = graph.name ? `\t${graph.name}` : "";
		console.log(`${graph.id}${label}`);
	}
}

function printGraphShow(graph: Graph): void {
	console.log(`id\t${graph.id}`);
	if (graph.name) console.log(`name\t${graph.name}`);
	if (graph.description) console.log(`description\t${graph.description}`);
	console.log(`path\t${graph.path}`);
	console.log(`nodes\t${graph.nodes.length}`);
	for (const node of graph.nodes) {
		const parts = [`  ${node.id}`, `profile=${node.profile}`];
		if (node.insert) parts.push("insert");
		if (node.append) parts.push("append");
		console.log(parts.join("\t"));
	}
	console.log(`edges\t${graph.edges.length}`);
	for (const edge of graph.edges) {
		console.log(`  ${edge.from} -> ${edge.to}`);
	}
}

async function cmdGraphShow(client: RuneClient, rest: string[]): Promise<void> {
	const id = requireGraphId(rest, "Usage: rune graph show <graph-id>");
	const graph = await client.getGraph(id);
	printGraphShow(graph);
}

function formatCheckFailure(result: GraphCheckResult): string {
	const lines = [`Graph "${result.graphId}" invalid:`];
	for (const item of result.issues) {
		lines.push(`  - ${item.code}: ${item.message}`);
	}
	return lines.join("\n");
}

async function cmdGraphCheck(
	client: RuneClient,
	rest: string[],
): Promise<void> {
	const id = requireGraphId(rest, "Usage: rune graph check <graph-id>");
	const result = await client.checkGraph(id);
	if (!result.ok) {
		throw new Error(formatCheckFailure(result));
	}
	console.log(`Graph "${result.graphId}" OK`);
	if (result.path && result.path.length > 0) {
		console.log(`path: ${result.path.join(" -> ")}`);
	}
}

function writeRunLog(path: string, result: GraphRunResult): void {
	try {
		writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
	} catch {
		throw new Error(`Cannot write --log "${path}"`);
	}
}

function printVerboseEvent(nodeId: string, event: GraphSessionDiagEvent): void {
	if (event.type === "user") {
		console.error(`[graph] ${nodeId} user: ${event.text}`);
		return;
	}
	if (event.type === "assistant") {
		console.error(`[graph] ${nodeId} assistant: ${event.text}`);
		return;
	}
	console.error(
		`[graph] ${nodeId} tool ${event.name} ${event.ok ? "ok" : "error"}`,
	);
}

function printVerboseStep(result: GraphRunResult): void {
	for (const step of result.steps) {
		console.error(`[graph] ${step.nodeId} (${step.profile}) start`);
		for (const event of step.events ?? []) {
			printVerboseEvent(step.nodeId, event);
		}
		if (step.status === "ok") {
			console.error(
				`[graph] ${step.nodeId} ok (${step.output?.length ?? 0} chars)`,
			);
			continue;
		}
		console.error(`[graph] ${step.nodeId} error (${step.error ?? "failed"})`);
	}
}

function emitGraphRunResult(
	id: string,
	result: GraphRunResult,
	logPath: string | undefined,
): void {
	if (logPath) writeRunLog(logPath, result);
	if (result.status === "error") {
		throw new Error(result.error ?? `Graph "${id}" run failed`);
	}
	// Final sink output only on stdout (intermediates never printed here).
	process.stdout.write(`${result.final ?? ""}\n`);
}

async function cmdGraphRun(client: RuneClient, rest: string[]): Promise<void> {
	const usage =
		"Usage: rune graph run <graph-id> --prompt <string> | --prompt-file <path> [--log <path>] [--verbose]";
	const id = requireGraphId(rest, usage);
	const prompt = readRequiredPrompt(rest);
	const logPath = flagValue(rest, "--log");
	const verbose = hasFlag(rest, "--verbose");

	if (verbose) console.error(`[graph] run ${id}`);
	const result = await client.runGraph(id, {
		prompt,
		...(verbose ? { verbose: true } : {}),
	});
	if (verbose) printVerboseStep(result);
	emitGraphRunResult(id, result, logPath);
}

export async function runGraphCommand(options: {
	client: RuneClient;
	sub: string | undefined;
	rest: string[];
	printHelp: () => void;
}): Promise<void> {
	const { client, sub, rest, printHelp } = options;
	if (sub === "list") {
		await cmdGraphList(client);
		return;
	}
	if (sub === "show") {
		await cmdGraphShow(client, rest);
		return;
	}
	if (sub === "check") {
		await cmdGraphCheck(client, rest);
		return;
	}
	if (sub === "run") {
		await cmdGraphRun(client, rest);
		return;
	}
	printHelp();
	throw new Error(`Unknown graph command: ${sub ?? "(none)"}`);
}
