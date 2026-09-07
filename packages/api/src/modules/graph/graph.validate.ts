import type {
	Graph,
	GraphCheckResult,
	GraphEdge,
	GraphValidationIssue,
} from "@rune/sdk";

export interface GraphValidationContext {
	profileExists(id: string): boolean;
}

interface DegreeMaps {
	inDegree: Map<string, number>;
	outDegree: Map<string, number>;
	outEdge: Map<string, GraphEdge>;
}

/** Same safe-id dialect as graph/profile ids. */
function isSafeNodeId(id: string): boolean {
	return (
		id.length > 0 &&
		id !== "default" &&
		id !== "." &&
		id !== ".." &&
		!id.startsWith(".") &&
		!id.includes("/") &&
		!id.includes("\\")
	);
}

function issue(
	code: string,
	message: string,
	extra: Omit<GraphValidationIssue, "code" | "message"> = {},
): GraphValidationIssue {
	return { code, message, ...extra };
}

function validateOneNode(
	node: Graph["nodes"][number],
	nodeIds: Set<string>,
	ctx: GraphValidationContext,
): GraphValidationIssue | undefined {
	if (!isSafeNodeId(node.id)) {
		return issue("unsafe_node_id", `node id "${node.id}" is not a safe id`, {
			nodeId: node.id,
		});
	}
	if (nodeIds.has(node.id)) {
		return issue("duplicate_node", `duplicate node id "${node.id}"`, {
			nodeId: node.id,
		});
	}
	nodeIds.add(node.id);
	if (!ctx.profileExists(node.profile)) {
		return issue(
			"missing_profile",
			`node "${node.id}" references profile "${node.profile}" (not found)`,
			{ nodeId: node.id, profile: node.profile },
		);
	}
	return undefined;
}

function collectNodeIssues(
	graph: Graph,
	ctx: GraphValidationContext,
): { issues: GraphValidationIssue[]; nodeIds: Set<string> } {
	const issues: GraphValidationIssue[] = [];
	const nodeIds = new Set<string>();
	for (const node of graph.nodes) {
		const found = validateOneNode(node, nodeIds, ctx);
		if (found) issues.push(found);
	}
	return { issues, nodeIds };
}

function emptyDegrees(nodeIds: Set<string>): DegreeMaps {
	const inDegree = new Map<string, number>();
	const outDegree = new Map<string, number>();
	const outEdge = new Map<string, GraphEdge>();
	for (const id of nodeIds) {
		inDegree.set(id, 0);
		outDegree.set(id, 0);
	}
	return { inDegree, outDegree, outEdge };
}

function validateOneEdge(
	edge: GraphEdge,
	nodeIds: Set<string>,
	degrees: DegreeMaps,
): GraphValidationIssue | undefined {
	const { from, to } = edge;
	if (from === to) {
		return issue("self_edge", `self-edge on node "${from}"`, {
			nodeId: from,
			edge: { from, to },
		});
	}
	if (!nodeIds.has(from)) {
		return issue(
			"unknown_edge_endpoint",
			`edge from "${from}" -> "${to}" references unknown node "${from}"`,
			{ edge: { from, to }, nodeId: from },
		);
	}
	if (!nodeIds.has(to)) {
		return issue(
			"unknown_edge_endpoint",
			`edge from "${from}" -> "${to}" references unknown node "${to}"`,
			{ edge: { from, to }, nodeId: to },
		);
	}
	degrees.inDegree.set(to, (degrees.inDegree.get(to) ?? 0) + 1);
	degrees.outDegree.set(from, (degrees.outDegree.get(from) ?? 0) + 1);
	if (!degrees.outEdge.has(from)) {
		degrees.outEdge.set(from, edge);
	}
	return undefined;
}

function collectDegreeIssues(
	nodeIds: Set<string>,
	degrees: DegreeMaps,
): GraphValidationIssue[] {
	const issues: GraphValidationIssue[] = [];
	for (const id of nodeIds) {
		const out = degrees.outDegree.get(id) ?? 0;
		const inn = degrees.inDegree.get(id) ?? 0;
		if (out > 1) {
			issues.push(
				issue("branch", `node "${id}" has out-degree ${out}`, { nodeId: id }),
			);
		}
		if (inn > 1) {
			issues.push(
				issue("merge", `node "${id}" has in-degree ${inn}`, { nodeId: id }),
			);
		}
	}
	return issues;
}

function collectEdgeIssues(
	edges: GraphEdge[],
	nodeIds: Set<string>,
): { issues: GraphValidationIssue[]; degrees: DegreeMaps } {
	const degrees = emptyDegrees(nodeIds);
	const issues: GraphValidationIssue[] = [];
	for (const edge of edges) {
		const found = validateOneEdge(edge, nodeIds, degrees);
		if (found) issues.push(found);
	}
	issues.push(...collectDegreeIssues(nodeIds, degrees));
	return { issues, degrees };
}

function sourceSinkLists(
	nodeIds: Set<string>,
	degrees: DegreeMaps,
): { sources: string[]; sinks: string[] } {
	const sources: string[] = [];
	const sinks: string[] = [];
	for (const id of nodeIds) {
		if ((degrees.inDegree.get(id) ?? 0) === 0) sources.push(id);
		if ((degrees.outDegree.get(id) ?? 0) === 0) sinks.push(id);
	}
	return { sources, sinks };
}

function sourceCountIssues(sources: string[]): GraphValidationIssue[] {
	if (sources.length === 0) {
		return [
			issue(
				"no_source",
				"graph has no source node (every node has an incoming edge)",
			),
		];
	}
	if (sources.length > 1) {
		return [
			issue(
				"multiple_sources",
				`graph has ${sources.length} source nodes: ${sources.join(", ")}`,
			),
		];
	}
	return [];
}

function sinkCountIssues(sinks: string[]): GraphValidationIssue[] {
	if (sinks.length === 0) {
		return [
			issue(
				"no_sink",
				"graph has no sink node (every node has an outgoing edge)",
			),
		];
	}
	if (sinks.length > 1) {
		return [
			issue(
				"multiple_sinks",
				`graph has ${sinks.length} sink nodes: ${sinks.join(", ")}`,
			),
		];
	}
	return [];
}

function collectEndpointIssues(
	nodeIds: Set<string>,
	degrees: DegreeMaps,
): {
	issues: GraphValidationIssue[];
	sources: string[];
	sinks: string[];
} {
	const { sources, sinks } = sourceSinkLists(nodeIds, degrees);
	if (sources.length === 0 && sinks.length === 0) {
		return {
			issues: [issue("cycle", "graph has a cycle (no source or sink node)")],
			sources,
			sinks,
		};
	}
	return {
		issues: [...sourceCountIssues(sources), ...sinkCountIssues(sinks)],
		sources,
		sinks,
	};
}

function degreesAreLinear(nodeIds: Set<string>, degrees: DegreeMaps): boolean {
	for (const id of nodeIds) {
		if (
			(degrees.inDegree.get(id) ?? 0) > 1 ||
			(degrees.outDegree.get(id) ?? 0) > 1
		) {
			return false;
		}
	}
	return true;
}

function edgesReferenceNodes(
	edges: GraphEdge[],
	nodeIds: Set<string>,
): boolean {
	for (const edge of edges) {
		if (
			edge.from === edge.to ||
			!nodeIds.has(edge.from) ||
			!nodeIds.has(edge.to)
		) {
			return false;
		}
	}
	return true;
}

function walkStep(options: {
	current: string;
	sink: string;
	seen: Set<string>;
	walked: string[];
	outEdge: Map<string, GraphEdge>;
}): { next?: string; issue?: GraphValidationIssue; done: boolean } {
	const { current, sink, seen, walked, outEdge } = options;
	if (current === sink) return { done: true };
	const edge = outEdge.get(current);
	if (!edge) return { done: true };
	const next = edge.to;
	if (seen.has(next)) {
		return {
			done: true,
			issue: issue(
				"cycle",
				`cycle detected at edge "${current}" -> "${next}"`,
				{ edge: { from: current, to: next }, nodeId: next },
			),
		};
	}
	seen.add(next);
	walked.push(next);
	return { next, done: false };
}

function disconnectedIssue(
	nodeIds: Set<string>,
	seen: Set<string>,
): GraphValidationIssue {
	const missing = [...nodeIds].filter((id) => !seen.has(id));
	return issue(
		"disconnected",
		missing.length > 0
			? `not a single linear path; nodes off the source→sink path: ${missing.join(", ")}`
			: "not a single linear path from source to sink",
		missing.length === 1 ? { nodeId: missing[0] } : {},
	);
}

function walkLinearPath(options: {
	nodeIds: Set<string>;
	source: string;
	sink: string;
	outEdge: Map<string, GraphEdge>;
}): { path?: string[]; issues: GraphValidationIssue[] } {
	const { nodeIds, source, sink, outEdge } = options;
	const walked: string[] = [source];
	const seen = new Set<string>([source]);
	let current = source;

	while (true) {
		const step = walkStep({ current, sink, seen, walked, outEdge });
		if (step.issue) return { issues: [step.issue] };
		if (step.done) break;
		if (step.next === undefined) break;
		current = step.next;
	}

	if (current !== sink || walked.length !== nodeIds.size) {
		return { issues: [disconnectedIssue(nodeIds, seen)] };
	}
	return { path: walked, issues: [] };
}

/**
 * Pure graph validation: schema/topology only.
 * No I/O — profile existence comes from `ctx`.
 */
export function validateGraph(
	graph: Graph,
	ctx: GraphValidationContext,
): GraphCheckResult {
	const graphId = graph.id;

	if (graph.nodes.length === 0) {
		return {
			graphId,
			ok: false,
			issues: [issue("empty_graph", "graph must declare at least one node")],
		};
	}

	const nodes = collectNodeIssues(graph, ctx);
	const edgeResult = collectEdgeIssues(graph.edges, nodes.nodeIds);
	const endpoints = collectEndpointIssues(nodes.nodeIds, edgeResult.degrees);
	const issues = [...nodes.issues, ...edgeResult.issues, ...endpoints.issues];

	const canWalk =
		endpoints.sources.length === 1 &&
		endpoints.sinks.length === 1 &&
		degreesAreLinear(nodes.nodeIds, edgeResult.degrees) &&
		edgesReferenceNodes(graph.edges, nodes.nodeIds);

	let path: string[] | undefined;
	if (canWalk) {
		const source = endpoints.sources[0];
		const sink = endpoints.sinks[0];
		if (source !== undefined && sink !== undefined) {
			const walked = walkLinearPath({
				nodeIds: nodes.nodeIds,
				source,
				sink,
				outEdge: edgeResult.degrees.outEdge,
			});
			issues.push(...walked.issues);
			path = walked.path;
		}
	}

	if (issues.length > 0) {
		return { graphId, ok: false, issues };
	}

	return {
		graphId,
		ok: true,
		issues: [],
		path: path ?? [...nodes.nodeIds],
	};
}
