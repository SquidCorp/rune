import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { graphPath, graphsRoot } from "@rune/engine";
import type { Graph, GraphEdge, GraphNode } from "@rune/sdk";
import { parse as parseToml } from "smol-toml";

/** Same safe-id dialect as profiles (filename stem). */
function isSafeGraphId(id: string): boolean {
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

function asOptionalString(
	value: unknown,
	field: string,
	path: string,
): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== "string") {
		throw new Error(`Invalid graph "${path}": ${field} must be a string`);
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function asRequiredString(value: unknown, field: string, path: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(
			`Invalid graph "${path}": ${field} must be a non-empty string`,
		);
	}
	return value.trim();
}

function requireTable(
	raw: unknown,
	label: string,
	path: string,
): Record<string, unknown> {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		throw new Error(`Invalid graph "${path}": ${label} must be a table`);
	}
	return raw as Record<string, unknown>;
}

function parseNode(raw: unknown, index: number, path: string): GraphNode {
	const row = requireTable(raw, `nodes[${index}]`, path);
	const node: GraphNode = {
		id: asRequiredString(row.id, `nodes[${index}].id`, path),
		profile: asRequiredString(row.profile, `nodes[${index}].profile`, path),
	};
	const insert = asOptionalString(row.insert, `nodes[${index}].insert`, path);
	const append = asOptionalString(row.append, `nodes[${index}].append`, path);
	if (insert !== undefined) node.insert = insert;
	if (append !== undefined) node.append = append;
	return node;
}

function parseEdge(raw: unknown, index: number, path: string): GraphEdge {
	const row = requireTable(raw, `edges[${index}]`, path);
	return {
		from: asRequiredString(row.from, `edges[${index}].from`, path),
		to: asRequiredString(row.to, `edges[${index}].to`, path),
	};
}

function requireArray(raw: unknown, field: string, path: string): unknown[] {
	if (raw === undefined) return [];
	if (!Array.isArray(raw)) {
		throw new Error(
			`Invalid graph "${path}": ${field} must be an array of tables`,
		);
	}
	return raw;
}

function parseRootTable(text: string, path: string): Record<string, unknown> {
	try {
		const parsed = parseToml(text);
		return requireTable(parsed, "root", path);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Malformed graph TOML at "${path}": ${message}`);
	}
}

/** Pure TOML → Graph. Throws on malformed content. */
export function parseGraphToml(text: string, id: string, path: string): Graph {
	const raw = parseRootTable(text, path);
	const graph: Graph = {
		id,
		nodes: requireArray(raw.nodes, "nodes", path).map((node, index) =>
			parseNode(node, index, path),
		),
		edges: requireArray(raw.edges, "edges", path).map((edge, index) =>
			parseEdge(edge, index, path),
		),
		path,
	};

	const name = asOptionalString(raw.name, "name", path);
	const description = asOptionalString(raw.description, "description", path);
	if (name !== undefined) graph.name = name;
	if (description !== undefined) graph.description = description;

	return graph;
}

function loadGraphFile(id: string, cwd: string): Graph | undefined {
	if (!isSafeGraphId(id)) return undefined;
	const path = graphPath(id, cwd);
	if (!existsSync(path) || !statSync(path).isFile()) return undefined;
	return parseGraphToml(readFileSync(path, "utf-8"), id, path);
}

function tryLoadListedGraph(id: string, cwd: string): Graph | undefined {
	try {
		return loadGraphFile(id, cwd);
	} catch {
		// Prefer skip + continue for list.
		return undefined;
	}
}

/**
 * List graphs under `.rune/graphs/`. Skips unsafe ids and unreadable/malformed files.
 */
export function listGraphs(cwd: string = process.cwd()): Graph[] {
	const root = graphsRoot(cwd);
	if (!existsSync(root)) return [];

	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".toml"))
		.map((entry) => entry.name.slice(0, -".toml".length))
		.filter(isSafeGraphId)
		.map((id) => tryLoadListedGraph(id, cwd))
		.filter((graph): graph is Graph => graph !== undefined)
		.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Load one graph by id (filename stem).
 * Missing / unsafe id → undefined. Malformed TOML → throws.
 */
export function getGraph(
	id: string,
	cwd: string = process.cwd(),
): Graph | undefined {
	return loadGraphFile(id, cwd);
}
