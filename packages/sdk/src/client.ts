import type {
	CreateLinkInput,
	CreateProfileInput,
	HealthResponse,
	Link,
	Profile,
} from "./types.ts";

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

	health(): Promise<HealthResponse> {
		return this.request<HealthResponse>("/health");
	}

	listProfiles(): Promise<Profile[]> {
		return this.request<Profile[]>("/profiles");
	}

	getProfile(id: string): Promise<Profile> {
		return this.request<Profile>(`/profiles/${encodeURIComponent(id)}`);
	}

	createProfile(input: CreateProfileInput): Promise<Profile> {
		return this.request<Profile>("/profiles", {
			method: "POST",
			body: JSON.stringify(input),
		});
	}

	listLinks(): Promise<Link[]> {
		return this.request<Link[]>("/links");
	}

	createLink(input: CreateLinkInput): Promise<Link> {
		return this.request<Link>("/links", {
			method: "POST",
			body: JSON.stringify(input),
		});
	}
}
