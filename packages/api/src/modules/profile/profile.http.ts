import {
	type CreateProfileInput,
	parseRuneScope,
	type RuneScope,
	type UpdateProfileInput,
} from "@rune/sdk";

import { listGraphs } from "../graph/index.ts";

import {
	createProfile,
	deleteProfile,
	getProfile,
	listProfiles,
	updateProfile,
} from "./profile.store.ts";

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
	if (message.includes("is used by graph") || message.includes("is linked")) {
		return error(message, 409);
	}
	return error(message);
}

async function readBody<T>(req: Request): Promise<T> {
	return (await req.json()) as T;
}

function requestScope(req: Request): RuneScope {
	return parseRuneScope(new URL(req.url).searchParams.get("scope"));
}

async function handleCreateProfile(
	req: Request,
	cwd: string,
): Promise<Response> {
	try {
		const input = await readBody<CreateProfileInput>(req);
		return json(createProfile(input, cwd, requestScope(req)), 201);
	} catch (err) {
		return storeError(err, "Failed to create profile");
	}
}

export function matchProfileId(pathname: string): string | undefined {
	const profileMatch = pathname.match(/^\/profiles\/([^/]+)$/);
	if (!profileMatch) return undefined;
	return decodeURIComponent(profileMatch[1] ?? "");
}

function handleGetProfile(req: Request, id: string, cwd: string): Response {
	try {
		const profile = getProfile(id, cwd, requestScope(req));
		if (!profile) return error(`Profile "${id}" not found`, 404);
		return json(profile);
	} catch (err) {
		return storeError(err, "Failed to get profile");
	}
}

async function handleUpdateProfile(
	req: Request,
	id: string,
	cwd: string,
): Promise<Response> {
	try {
		const input = await readBody<UpdateProfileInput>(req);
		return json(updateProfile(id, input, { cwd, scope: requestScope(req) }));
	} catch (err) {
		return storeError(err, "Failed to update profile");
	}
}

function graphsReferencingProfile(profileId: string, cwd: string): string[] {
	const refs: string[] = [];
	for (const graph of listGraphs(cwd)) {
		if (graph.nodes.some((node) => node.profile === profileId)) {
			refs.push(graph.id);
		}
	}
	return refs;
}

function handleDeleteProfile(req: Request, id: string, cwd: string): Response {
	try {
		const scope = requestScope(req);
		const force = new URL(req.url).searchParams.get("force") === "true";
		if (!force && scope === "project") {
			const graphRefs = graphsReferencingProfile(id, cwd);
			if (graphRefs.length > 0) {
				return error(
					`Profile "${id}" is used by graph(s): ${graphRefs.join(", ")}; pass force to delete`,
					409,
				);
			}
		}
		deleteProfile(id, { force, cwd, scope });
		return json(undefined, 204);
	} catch (err) {
		return storeError(err, "Failed to delete profile");
	}
}

export const profileExactRoutes: Record<string, RouteHandler> = {
	"GET /profiles": (req, cwd) => {
		try {
			return json(listProfiles(cwd, requestScope(req)));
		} catch (err) {
			return storeError(err, "Failed to list profiles");
		}
	},
	"POST /profiles": (req, cwd) => handleCreateProfile(req, cwd),
};

export async function handleProfileApi(options: {
	req: Request;
	method: string;
	pathname: string;
	cwd: string;
}): Promise<Response | undefined> {
	const { req, method, pathname, cwd } = options;
	const id = matchProfileId(pathname);
	if (id === undefined) return undefined;
	if (method === "GET") return handleGetProfile(req, id, cwd);
	if (method === "PATCH") return handleUpdateProfile(req, id, cwd);
	if (method === "DELETE") return handleDeleteProfile(req, id, cwd);
	return undefined;
}
