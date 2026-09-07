import type { Graph, GraphCheckResult, RuneClient } from "@rune/sdk";

function requireGraphId(rest: string[], usage: string): string {
	const id = rest[0];
	if (!id) {
		throw new Error(usage);
	}
	return id;
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
	printHelp();
	throw new Error(`Unknown graph command: ${sub ?? "(none)"}`);
}
