import { checkGraph, getGraph, listGraphs } from "./graph.store.ts";

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

export function matchGraphRoute(
	pathname: string,
): { id: string; check: boolean } | undefined {
	const checkMatch = pathname.match(/^\/graphs\/([^/]+)\/check$/);
	if (checkMatch?.[1] !== undefined) {
		return { id: decodeURIComponent(checkMatch[1]), check: true };
	}
	const getMatch = pathname.match(/^\/graphs\/([^/]+)$/);
	if (getMatch?.[1] !== undefined) {
		return { id: decodeURIComponent(getMatch[1]), check: false };
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

export const graphExactRoutes: Record<string, RouteHandler> = {
	"GET /graphs": (_req, cwd) => json(listGraphs(cwd)),
};

export async function handleGraphApi(options: {
	req: Request;
	method: string;
	pathname: string;
	cwd: string;
}): Promise<Response | undefined> {
	const { method, pathname, cwd } = options;
	const matched = matchGraphRoute(pathname);
	if (matched === undefined) return undefined;
	if (method !== "GET") return undefined;
	if (matched.check) return handleCheckGraph(matched.id, cwd);
	return handleGetGraph(matched.id, cwd);
}
