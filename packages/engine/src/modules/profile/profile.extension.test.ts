import { describe, expect, test } from "bun:test";

import { resolveProfileModel } from "./profile.extension.ts";

const catalog = [
	{ provider: "openrouter", id: "x-ai/grok-4.6" },
	{ provider: "xai", id: "grok-4.6" },
	{ provider: "openai", id: "gpt-5" },
] as const;

describe("resolveProfileModel", () => {
	test("matches canonical provider/id when the model id contains a slash", () => {
		const found = resolveProfileModel("openrouter/x-ai/grok-4.6", catalog);
		expect(found).toEqual({
			model: { provider: "openrouter", id: "x-ai/grok-4.6" },
		});
	});

	test("matches a unique OpenRouter-style bare id", () => {
		const found = resolveProfileModel("x-ai/grok-4.6", catalog);
		expect(found).toEqual({
			model: { provider: "openrouter", id: "x-ai/grok-4.6" },
		});
	});

	test("matches a direct-provider canonical ref", () => {
		const found = resolveProfileModel("xai/grok-4.6", catalog);
		expect(found).toEqual({ model: { provider: "xai", id: "grok-4.6" } });
	});

	test("rejects a mashed xai + OpenRouter id", () => {
		const found = resolveProfileModel("xai/x-ai/grok-4.6", catalog);
		expect(found).toEqual({ error: "model xai/x-ai/grok-4.6 not found" });
	});
});
