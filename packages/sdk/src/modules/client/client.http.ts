import type {
	Graph,
	GraphCheckResult,
	GraphRunRequest,
	GraphRunResult,
} from "../graph/index.ts";
import type { HealthResponse } from "../health/index.ts";
import type {
	CreateProfileInput,
	Profile,
	RuneScope,
	UpdateProfileInput,
} from "../profile/index.ts";

export interface RuneClientOptions {
	baseUrl?: string;
	fetch?: typeof fetch;
}

export class RuneClient {
	readonly baseUrl: string;
	private readonly fetchFn: typeof fetch;

	constructor(options: RuneClientOptions = {}) {
		this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:8787").replace(
			/\/$/,
			"",
		);
		this.fetchFn = options.fetch ?? fetch;
	}

	private async request<T>(path: string, init?: RequestInit): Promise<T> {
		const res = await this.fetchFn(`${this.baseUrl}${path}`, {
			...init,
			headers: {
				"content-type": "application/json",
				...(init?.headers ?? {}),
			},
		});

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(
				`Rune API ${res.status} ${res.statusText}: ${body || path}`,
			);
		}

		if (res.status === 204) {
			return undefined as T;
		}

		return (await res.json()) as T;
	}

	private withQuery(
		path: string,
		params: Record<string, string | undefined>,
	): string {
		const q = new URLSearchParams();
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) q.set(key, value);
		}
		const s = q.toString();
		return s ? `${path}?${s}` : path;
	}

	health(): Promise<HealthResponse> {
		return this.request<HealthResponse>("/health");
	}

	listProfiles(options?: { scope?: RuneScope }): Promise<Profile[]> {
		return this.request<Profile[]>(
			this.withQuery("/profiles", { scope: options?.scope }),
		);
	}

	getProfile(id: string, options?: { scope?: RuneScope }): Promise<Profile> {
		return this.request<Profile>(
			this.withQuery(`/profiles/${encodeURIComponent(id)}`, {
				scope: options?.scope,
			}),
		);
	}

	createProfile(
		input: CreateProfileInput,
		options?: { scope?: RuneScope },
	): Promise<Profile> {
		return this.request<Profile>(
			this.withQuery("/profiles", { scope: options?.scope }),
			{
				method: "POST",
				body: JSON.stringify(input),
			},
		);
	}

	updateProfile(
		id: string,
		input: UpdateProfileInput,
		options?: { scope?: RuneScope },
	): Promise<Profile> {
		return this.request<Profile>(
			this.withQuery(`/profiles/${encodeURIComponent(id)}`, {
				scope: options?.scope,
			}),
			{
				method: "PATCH",
				body: JSON.stringify(input),
			},
		);
	}

	deleteProfile(
		id: string,
		options: { force?: boolean; scope?: RuneScope } = {},
	): Promise<void> {
		return this.request<void>(
			this.withQuery(`/profiles/${encodeURIComponent(id)}`, {
				force: options.force ? "true" : undefined,
				scope: options.scope,
			}),
			{
				method: "DELETE",
			},
		);
	}

	listGraphs(): Promise<Graph[]> {
		return this.request<Graph[]>("/graphs");
	}

	getGraph(id: string): Promise<Graph> {
		return this.request<Graph>(`/graphs/${encodeURIComponent(id)}`);
	}

	checkGraph(id: string): Promise<GraphCheckResult> {
		return this.request<GraphCheckResult>(
			`/graphs/${encodeURIComponent(id)}/check`,
		);
	}

	/**
	 * Run a validated linear graph. Long-running synchronous HTTP for v1.
	 * Mid-chain failures still return GraphRunResult (status: "error").
	 * Validation failures throw with the check payload message.
	 */
	async runGraph(id: string, body: GraphRunRequest): Promise<GraphRunResult> {
		const path = `/graphs/${encodeURIComponent(id)}/run`;
		const res = await this.fetchFn(`${this.baseUrl}${path}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});

		const text = await res.text().catch(() => "");
		let data: unknown;
		try {
			data = text ? JSON.parse(text) : undefined;
		} catch {
			data = undefined;
		}

		if (res.status === 400 && isGraphCheckResult(data)) {
			throw new Error(formatCheckFailure(data));
		}

		if (!res.ok) {
			const message = apiErrorMessage(data) ?? (text || path);
			throw new Error(`Rune API ${res.status} ${res.statusText}: ${message}`);
		}

		return data as GraphRunResult;
	}
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

function apiErrorMessage(data: unknown): string | undefined {
	if (data === null || typeof data !== "object") return undefined;
	if (!("error" in data)) return undefined;
	const error = data.error;
	return typeof error === "string" ? error : undefined;
}

function formatCheckFailure(result: GraphCheckResult): string {
	const lines = [`Graph "${result.graphId}" invalid:`];
	for (const item of result.issues) {
		lines.push(`  - ${item.code}: ${item.message}`);
	}
	return lines.join("\n");
}
