import type {
	CreateLinkInput,
	CreateProfileInput,
	HealthResponse,
} from "@rune/sdk/types";
import {
	createLink,
	createProfile,
	getProfile,
	listLinks,
	listProfiles,
} from "./store.ts";

export interface StartServerOptions {
	port?: number;
	hostname?: string;
	cwd?: string;
	/** Directory of built SPA assets to serve (optional). */
	staticDir?: string;
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json",
			"access-control-allow-origin": "*",
			"access-control-allow-methods": "GET,POST,OPTIONS",
			"access-control-allow-headers": "content-type",
		},
	});
}

function error(message: string, status = 400): Response {
	return json({ error: message }, status);
}

async function readBody<T>(req: Request): Promise<T> {
	return (await req.json()) as T;
}

function healthResponse(): Response {
	const body: HealthResponse = {
		ok: true,
		service: "rune-api",
		version: "0.1.0",
	};
	return json(body);
}

async function handleCreateProfile(
	req: Request,
	cwd: string,
): Promise<Response> {
	try {
		const input = await readBody<CreateProfileInput>(req);
		return json(createProfile(input, cwd), 201);
	} catch (err) {
		return error(
			err instanceof Error ? err.message : "Failed to create profile",
		);
	}
}

function handleGetProfile(pathname: string, cwd: string): Response | undefined {
	const profileMatch = pathname.match(/^\/profiles\/([^/]+)$/);
	if (!profileMatch) return undefined;

	const id = decodeURIComponent(profileMatch[1] ?? "");
	const profile = getProfile(id, cwd);
	if (!profile) return error(`Profile "${id}" not found`, 404);
	return json(profile);
}

async function handleCreateLink(req: Request, cwd: string): Promise<Response> {
	try {
		const input = await readBody<CreateLinkInput>(req);
		return json(createLink(input, cwd), 201);
	} catch (err) {
		return error(err instanceof Error ? err.message : "Failed to create link");
	}
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

type RouteHandler = (req: Request, cwd: string) => Response | Promise<Response>;

const exactRoutes: Record<string, RouteHandler> = {
	"GET /health": () => healthResponse(),
	"GET /profiles": (_req, cwd) => json(listProfiles(cwd)),
	"POST /profiles": (req, cwd) => handleCreateProfile(req, cwd),
	"GET /links": (_req, cwd) => json(listLinks(cwd)),
	"POST /links": (req, cwd) => handleCreateLink(req, cwd),
};

async function handleApi(
	req: Request,
	method: string,
	pathname: string,
	cwd: string,
): Promise<Response | undefined> {
	const exact = exactRoutes[`${method} ${pathname}`];
	if (exact) return exact(req, cwd);
	if (method === "GET") return handleGetProfile(pathname, cwd);
	return undefined;
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

		const apiResponse = await handleApi(req, method, pathname, cwd);
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
