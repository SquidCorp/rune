import { describe, expect, test } from "bun:test";

import {
	type ActiveProfile,
	DEFAULT_GLYPH,
	formatCurrent,
	resolveProfileModel,
} from "./profile.extension.ts";

const catalog = [
	{ provider: "openrouter", id: "x-ai/grok-4.6" },
	{ provider: "xai", id: "grok-4.6" },
	{ provider: "openai", id: "gpt-5" },
] as const;

const theme = {
	fg: (_c: string, t: string) => t,
	bold: (t: string) => `*${t}*`,
};

function fixture(
	partial: Pick<ActiveProfile, "id" | "displayName"> & {
		glyph?: string;
	},
): ActiveProfile {
	return {
		id: partial.id,
		displayName: partial.displayName,
		dir: "/tmp",
		meta: partial.glyph ? { glyph: partial.glyph } : {},
	};
}

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

describe("formatCurrent", () => {
	test("named profile with glyph", () => {
		const profile = fixture({
			id: "coder",
			displayName: "Berserker",
			glyph: "ᛃ",
		});
		expect(formatCurrent(profile)).toBe("ᛃ Berserker (coder)");
	});

	test("named profile with styled glyph override", () => {
		const profile = fixture({
			id: "coder",
			displayName: "Berserker",
			glyph: "ᛃ",
		});
		expect(formatCurrent(profile, "*ᛃ*")).toBe("*ᛃ* Berserker (coder)");
	});

	test("id-only display name without glyph", () => {
		expect(
			formatCurrent({
				id: "coder",
				displayName: "coder",
				dir: "/tmp",
				meta: {},
			}),
		).toBe("coder");
	});

	test("undefined profile is Raidho Default", () => {
		expect(formatCurrent(undefined)).toBe(`${DEFAULT_GLYPH} Default`);
	});

	test("undefined profile with styled glyph override", () => {
		expect(formatCurrent(undefined, `*${DEFAULT_GLYPH}*`)).toBe(
			`*${DEFAULT_GLYPH}* Default`,
		);
	});
});

describe("footer status", () => {
	test("bolds the named-profile glyph", () => {
		const profile = fixture({
			id: "coder",
			displayName: "Berserker",
			glyph: "ᛃ",
		});
		const glyph = profile.meta.glyph;
		const current = formatCurrent(
			profile,
			glyph ? theme.bold(glyph) : undefined,
		);
		expect(theme.fg("accent", `Profile: ${current}`)).toBe(
			"Profile: *ᛃ* Berserker (coder)",
		);
	});

	test("Default bolds Raidho", () => {
		const current = formatCurrent(undefined, theme.bold(DEFAULT_GLYPH));
		expect(theme.fg("accent", `Profile: ${current}`)).toBe(
			`Profile: *${DEFAULT_GLYPH}* Default`,
		);
	});
});
