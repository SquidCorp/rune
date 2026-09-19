import { describe, expect, test } from "bun:test";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

import runeBannerExtension, {
	type RuneHeaderTheme,
	renderRuneHeader,
} from "./invoke.extension.ts";

const identityTheme: RuneHeaderTheme = {
	fg: (_color, text) => text,
	bold: (text) => text,
};

const installBanner = () => {
	let onSessionStart:
		| ((event: unknown, ctx: ExtensionContext) => void)
		| undefined;
	runeBannerExtension({
		on: (event, handler) => {
			if (event === "session_start") onSessionStart = handler;
		},
	} as unknown as ExtensionAPI);
	if (!onSessionStart) throw new Error("session_start handler missing");
	return onSessionStart;
};

describe("renderRuneHeader", () => {
	test("wide terminal paints a multi-line wordmark", () => {
		const lines = renderRuneHeader(identityTheme, 80);
		expect(lines.length).toBeGreaterThanOrEqual(4);
		expect(lines.join("\n")).toContain("██████╗");
	});

	test("narrow terminal falls back to RUNE", () => {
		expect(renderRuneHeader(identityTheme, 10)).toEqual(["RUNE"]);
	});

	test("styles the wordmark with the accent color", () => {
		const theme: RuneHeaderTheme = {
			fg: (color, text) => (color === "accent" ? `{${text}}` : text),
			bold: (text) => text,
		};
		const lines = renderRuneHeader(theme, 80);
		expect(
			lines.every((line) => line.startsWith("{") && line.endsWith("}")),
		).toBe(true);
	});
});

describe("rune banner extension", () => {
	test("installs a RUNE header in TUI mode", () => {
		const onSessionStart = installBanner();
		let header: { render: (width: number) => string[] } | undefined;
		onSessionStart({ type: "session_start", reason: "startup" }, {
			mode: "tui",
			ui: {
				setHeader: (factory) => {
					header = factory({} as never, identityTheme as never);
				},
			},
		} as unknown as ExtensionContext);
		expect(header?.render(80).join("\n")).toContain("██████╗");
		expect(header?.render(10)).toEqual(["RUNE"]);
	});

	test("skips the header outside TUI mode", () => {
		const onSessionStart = installBanner();
		let setHeaderCalls = 0;
		onSessionStart({ type: "session_start", reason: "startup" }, {
			mode: "print",
			ui: {
				setHeader: () => {
					setHeaderCalls += 1;
				},
			},
		} as unknown as ExtensionContext);
		expect(setHeaderCalls).toBe(0);
	});
});
