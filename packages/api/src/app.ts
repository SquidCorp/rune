import { graphExactRoutes, handleGraphApi } from "./modules/graph/index.ts";
import { healthExactRoutes } from "./modules/health/index.ts";
import { linkExactRoutes } from "./modules/link/index.ts";
import {
	handleProfileApi,
	profileExactRoutes,
} from "./modules/profile/index.ts";

export interface StartServerOptions {
	port?: number;
	hostname?: string;
	cwd?: string;
	/** Directory of built SPA assets to serve (optional). */
	staticDir?: string;
}

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

async function handleStatic(
	pathname: string,
	staticDir: string,
): Promise<Response | undefined> {
	const filePath = pathname === "/" ? "/index.html" : pathname;
	const file = Bun.file(`${staticDir}${filePath}`);
	if (await file.exists()) {
		return new Response(file);
	}
	const fallback = Bun.file(`${staticDir}/index.html`);
	if (await fallback.exists()) {
		return new Response(fallback);
	}
	return undefined;
}

const exactRoutes: Record<string, RouteHandler> = {
	...healthExactRoutes,
	...profileExactRoutes,
	...linkExactRoutes,
	...graphExactRoutes,
};

async function handleApi(options: {
	req: Request;
	method: string;
	pathname: string;
	cwd: string;
}): Promise<Response | undefined> {
	const { req, method, pathname, cwd } = options;
	const exact = exactRoutes[`${method} ${pathname}`];
	if (exact) return exact(req, cwd);

	return (
		(await handleProfileApi({ req, method, pathname, cwd })) ??
		(await handleGraphApi({ req, method, pathname, cwd }))
	);
}

export function createHandler(options: StartServerOptions = {}) {
	const cwd = options.cwd ?? process.cwd();
	const staticDir = options.staticDir;

	return async function handler(req: Request): Promise<Response> {
		const url = new URL(req.url);
		const { pathname } = url;
		const method = req.method.toUpperCase();

		if (method === "OPTIONS") {
			return json({}, 204);
		}

		const apiResponse = await handleApi({ req, method, pathname, cwd });
		if (apiResponse) return apiResponse;

		if (staticDir && method === "GET") {
			const staticResponse = await handleStatic(pathname, staticDir);
			if (staticResponse) return staticResponse;
		}

		return error("Not found", 404);
	};
}

export function startServer(options: StartServerOptions = {}) {
	const port = options.port ?? Number(process.env.PORT ?? 8787);
	const hostname = options.hostname ?? process.env.HOST ?? "127.0.0.1";
	const handler = createHandler(options);

	const server = Bun.serve({
		port,
		hostname,
		fetch: handler,
	});

	return {
		server,
		url: `http://${hostname}:${server.port}`,
		port: server.port,
		stop: () => server.stop(true),
	};
}

if (import.meta.main) {
	const { url } = startServer();
	console.log(`Rune API listening on ${url}`);
}
