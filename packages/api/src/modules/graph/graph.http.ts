import type { GraphCheckResult, GraphRunRequest } from "@rune/sdk";

import { checkGraph, getGraph, listGraphs, runGraph } from "./graph.store.ts";

type RouteHandler = (req: Request, cwd: string) => Response | Promise<Response>;

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json",
			"access-control-allow-origin": "*",
			"access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
			"access-control-allow-headers": "content-type",
		},
	});
}

function error(message: string, status = 400): Response {
	return json({ error: message }, status);
}

function storeError(err: unknown, fallback: string): Response {
	const message = err instanceof Error ? err.message : fallback;
	if (message.includes("not found")) return error(message, 404);
	if (message.includes("Malformed") || message.includes("Invalid graph")) {
		return error(message, 400);
	}
	return error(message);
}

function isGraphCheckResult(value: unknown): value is GraphCheckResult {
	if (value === null || typeof value !== "object") return false;
	const row = value as { graphId?: unknown; ok?: unknown; issues?: unknown };
	return (
		typeof row.graphId === "string" &&
		typeof row.ok === "boolean" &&
		Array.isArray(row.issues)
	);
}

export function matchGraphRoute(
	pathname: string,
): { id: string; action: "get" | "check" | "run" } | undefined {
	const runMatch = pathname.match(/^\/graphs\/([^/]+)\/run$/);
	if (runMatch?.[1] !== undefined) {
		return { id: decodeURIComponent(runMatch[1]), action: "run" };
	}
	const checkMatch = pathname.match(/^\/graphs\/([^/]+)\/check$/);
	if (checkMatch?.[1] !== undefined) {
		return { id: decodeURIComponent(checkMatch[1]), action: "check" };
	}
	const getMatch = pathname.match(/^\/graphs\/([^/]+)$/);
	if (getMatch?.[1] !== undefined) {
		return { id: decodeURIComponent(getMatch[1]), action: "get" };
	}
	return undefined;
}

function handleGetGraph(id: string, cwd: string): Response {
	try {
		const graph = getGraph(id, cwd);
		if (!graph) return error(`Graph "${id}" not found`, 404);
		return json(graph);
	} catch (err) {
		return storeError(err, "Failed to load graph");
	}
}

function handleCheckGraph(id: string, cwd: string): Response {
	try {
		return json(checkGraph(id, cwd));
	} catch (err) {
		return storeError(err, "Failed to check graph");
	}
}

async function handleRunGraph(
	req: Request,
	id: string,
	cwd: string,
): Promise<Response> {
	let body: GraphRunRequest;
	try {
		body = (await req.json()) as GraphRunRequest;
	} catch {
		return error("Invalid JSON body");
	}
	if (typeof body.prompt !== "string") {
		return error("prompt is required and must be a string");
	}

	try {
		// Synchronous HTTP for v1 — long-running model chain; no job queue.
		const result = await runGraph(id, body.prompt, cwd);
		return json(result);
	} catch (err) {
		const check =
			err instanceof Error
				? (err as Error & { check?: GraphCheckResult }).check
				: undefined;
		if (check && isGraphCheckResult(check)) {
			return json(check, 400);
		}
		return storeError(err, "Failed to run graph");
	}
}

export const graphExactRoutes: Record<string, RouteHandler> = {
	"GET /graphs": (_req, cwd) => json(listGraphs(cwd)),
};

export async function handleGraphApi(options: {
	req: Request;
	method: string;
	pathname: string;
	cwd: string;
}): Promise<Response | undefined> {
	const { req, method, pathname, cwd } = options;
	const matched = matchGraphRoute(pathname);
	if (matched === undefined) return undefined;

	if (matched.action === "run") {
		if (method !== "POST") return undefined;
		return handleRunGraph(req, matched.id, cwd);
	}
	if (method !== "GET") return undefined;
	if (matched.action === "check") return handleCheckGraph(matched.id, cwd);
	return handleGetGraph(matched.id, cwd);
}
