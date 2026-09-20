import { afterEach, describe, expect, test } from "bun:test";

import {
	buildWhichProfileCriteria,
	classifyWhichProfile,
	DEFAULT_PROFILE_CRITERION,
	readTypesafeApiKey,
	TYPESAFE_URL,
} from "./profile-selector.http.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("readTypesafeApiKey", () => {
	test("trims an api_key entry", () => {
		expect(
			readTypesafeApiKey({ typesafe: { type: "api_key", key: " tok " } }),
		).toBe("tok");
	});

	test("returns undefined for missing oauth or empty keys", () => {
		expect(readTypesafeApiKey(undefined)).toBeUndefined();
		expect(readTypesafeApiKey([])).toBeUndefined();
		expect(
			readTypesafeApiKey({ openai: { type: "api_key", key: "x" } }),
		).toBeUndefined();
		expect(
			readTypesafeApiKey({ typesafe: { type: "oauth", key: "tok" } }),
		).toBeUndefined();
		expect(
			readTypesafeApiKey({ typesafe: { type: "api_key", key: "   " } }),
		).toBeUndefined();
	});
});

describe("buildWhichProfileCriteria", () => {
	test("uses description, falls back to name then id, and sets default last", () => {
		expect(
			buildWhichProfileCriteria([
				{ id: "researcher", description: "Does research" },
				{ id: "writer" },
			]),
		).toEqual({
			researcher: "Does research",
			writer: "writer",
			default: DEFAULT_PROFILE_CRITERION,
		});
	});

	test("name wins over id when description is missing", () => {
		expect(buildWhichProfileCriteria([{ id: "w", name: "Writer" }])).toEqual({
			w: "Writer",
			default: DEFAULT_PROFILE_CRITERION,
		});
	});
});

describe("classifyWhichProfile", () => {
	test("POSTs to Typesafe and returns the choice", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		globalThis.fetch = (async (
			url: string | URL | Request,
			init?: RequestInit,
		) => {
			calls.push({ url: String(url), init: init ?? {} });
			return new Response(
				JSON.stringify({
					answers: { which_profile: { choice: "researcher" } },
				}),
				{ status: 200 },
			);
		}) as typeof fetch;

		const result = await classifyWhichProfile({
			userMessage: "research this paper",
			criteria: {
				researcher: "Does research",
				default: DEFAULT_PROFILE_CRITERION,
			},
			apiKey: "k",
		});

		expect(result).toEqual({ ok: true, choice: "researcher" });
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(TYPESAFE_URL);
		const headers = new Headers(calls[0]?.init.headers);
		expect(headers.get("authorization")).toBe("Bearer k");
		const body = JSON.parse(String(calls[0]?.init.body)) as {
			state: string;
			questions: { which_profile: { criteria: Record<string, string> } };
		};
		expect(body.state).toBe("research this paper");
		expect(body.questions.which_profile.criteria.default).toBe(
			DEFAULT_PROFILE_CRITERION,
		);
	});

	test("returns ok false on HTTP 500", async () => {
		globalThis.fetch = (async () =>
			new Response("nope", { status: 500 })) as typeof fetch;

		expect(
			await classifyWhichProfile({
				userMessage: "x",
				criteria: { default: DEFAULT_PROFILE_CRITERION },
				apiKey: "k",
			}),
		).toEqual({ ok: false });
	});
});
