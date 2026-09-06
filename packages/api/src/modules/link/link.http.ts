import type { CreateLinkInput } from "@rune/sdk";

import { createLink, listLinks } from "./link.store.ts";

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
	if (message.includes("already exists")) return error(message, 409);
	if (message.includes("is linked")) return error(message, 409);
	if (message.includes("Unknown profile")) return error(message, 400);
	return error(message);
}

async function readBody<T>(req: Request): Promise<T> {
	return (await req.json()) as T;
}

async function handleCreateLink(req: Request, cwd: string): Promise<Response> {
	try {
		const input = await readBody<CreateLinkInput>(req);
		return json(createLink(input, cwd), 201);
	} catch (err) {
		return storeError(err, "Failed to create link");
	}
}

export const linkExactRoutes: Record<string, RouteHandler> = {
	"GET /links": (_req, cwd) => json(listLinks(cwd)),
	"POST /links": (req, cwd) => handleCreateLink(req, cwd),
};
