import type { HealthResponse } from "@rune/sdk";

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

function healthResponse(): Response {
	const body: HealthResponse = {
		ok: true,
		service: "rune-api",
		version: "0.1.0",
	};
	return json(body);
}

export const healthExactRoutes: Record<string, RouteHandler> = {
	"GET /health": () => healthResponse(),
};
