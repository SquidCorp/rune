import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	InputEvent,
} from "@earendil-works/pi-coding-agent";

import profileSelectorExtension from "./profile-selector.extension.ts";

const ACTIVE_STORE = Symbol.for("pi.profiles.activeId");
const PENDING_STORE = Symbol.for("rune.profileSelector.pendingMessage");

type GlobalStore = typeof globalThis & {
	[ACTIVE_STORE]?: string;
	[PENDING_STORE]?: { text: string; images?: InputEvent["images"] };
};

type SendCall = {
	content: unknown;
	options?: { expandPromptTemplates?: boolean };
};

const originalCwd = process.cwd();
const originalRuneHome = process.env.RUNE_HOME;
const originalFetch = globalThis.fetch;
const temps: string[] = [];

function tempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	temps.push(dir);
	return dir;
}

afterEach(() => {
	process.chdir(originalCwd);
	if (originalRuneHome === undefined) {
		delete process.env.RUNE_HOME;
	} else {
		process.env.RUNE_HOME = originalRuneHome;
	}
	globalThis.fetch = originalFetch;
	const store = globalThis as GlobalStore;
	delete store[ACTIVE_STORE];
	delete store[PENDING_STORE];
	for (const dir of temps.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function writeResearcherProject(): void {
	const cwd = tempDir("rune-selector-cwd-");
	const dir = join(cwd, ".rune", "profiles", "researcher");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "profile.json"),
		JSON.stringify({ description: "Does research" }),
	);
	process.chdir(cwd);
}

function writeAuth(typesafe?: unknown): void {
	const home = tempDir("rune-selector-home-");
	process.env.RUNE_HOME = home;
	const auth =
		typesafe === undefined
			? { openai: { type: "api_key", key: "x" } }
			: { typesafe };
	writeFileSync(join(home, "auth.json"), JSON.stringify(auth));
}

function mockClassify(choice: string): { calls: number } {
	const tracker = { calls: 0 };
	globalThis.fetch = (async () => {
		tracker.calls += 1;
		return new Response(
			JSON.stringify({ answers: { which_profile: { choice } } }),
			{ status: 200 },
		);
	}) as typeof fetch;
	return tracker;
}

function installSelector(): {
	onInput: (event: InputEvent, ctx: ExtensionContext) => Promise<unknown>;
	onSelect: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
	sendCalls: SendCall[];
} {
	let onInput:
		| ((event: InputEvent, ctx: ExtensionContext) => Promise<unknown>)
		| undefined;
	let onSelect:
		| ((args: string, ctx: ExtensionCommandContext) => Promise<void>)
		| undefined;
	const sendCalls: SendCall[] = [];
	profileSelectorExtension({
		on: (event, handler) => {
			if (event === "input") onInput = handler as typeof onInput;
		},
		registerCommand: (name, options) => {
			if (name === "rune-select") onSelect = options.handler as typeof onSelect;
		},
		sendUserMessage: (content, options) => {
			sendCalls.push({ content, options });
		},
	} as unknown as ExtensionAPI);
	if (!onInput) throw new Error("input handler missing");
	if (!onSelect) throw new Error("rune-select handler missing");
	return { onInput, onSelect, sendCalls };
}

function inputEvent(partial: Partial<InputEvent> = {}): InputEvent {
	return {
		type: "input",
		text: "research this paper",
		source: "interactive",
		...partial,
	};
}

function inputCtx(
	partial: {
		mode?: ExtensionContext["mode"];
		branch?: Array<{ type: string; message?: { role: string } }>;
		notifies?: Array<{ message: string; level: string }>;
	} = {},
): ExtensionContext {
	const notifies = partial.notifies ?? [];
	return {
		mode: partial.mode ?? "tui",
		sessionManager: { getBranch: () => partial.branch ?? [] },
		ui: {
			notify: (message: string, level: string) => {
				notifies.push({ message, level });
			},
		},
	} as unknown as ExtensionContext;
}

function setupClassifiable(choice = "researcher"): {
	onInput: (event: InputEvent, ctx: ExtensionContext) => Promise<unknown>;
	sendCalls: SendCall[];
	fetch: { calls: number };
} {
	writeResearcherProject();
	writeAuth({ type: "api_key", key: "tok" });
	const fetch = mockClassify(choice);
	const installed = installSelector();
	return { onInput: installed.onInput, sendCalls: installed.sendCalls, fetch };
}

async function flushMicrotasks(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe("profile-selector intercept", () => {
	test("handles first TUI message when classify differs from current", async () => {
		const { onInput, sendCalls } = setupClassifiable("researcher");
		const result = await onInput(inputEvent(), inputCtx());
		await flushMicrotasks();
		expect(result).toEqual({ action: "handled" });
		expect((globalThis as GlobalStore)[PENDING_STORE]).toEqual({
			text: "research this paper",
			images: undefined,
		});
		expect(sendCalls).toEqual([
			{
				content: "/rune-select researcher",
				options: { expandPromptTemplates: true },
			},
		]);
	});

	test("continues when choice matches the current profile", async () => {
		const { onInput, sendCalls } = setupClassifiable("default");
		const result = await onInput(inputEvent(), inputCtx());
		await flushMicrotasks();
		expect(result).toEqual({ action: "continue" });
		expect(sendCalls).toEqual([]);
	});
});

describe("profile-selector skip paths", () => {
	test("continues without fetch when the branch already has a user message", async () => {
		const { onInput, sendCalls, fetch } = setupClassifiable();
		const result = await onInput(
			inputEvent(),
			inputCtx({ branch: [{ type: "message", message: { role: "user" } }] }),
		);
		expect(result).toEqual({ action: "continue" });
		expect(fetch.calls).toBe(0);
		expect(sendCalls).toEqual([]);
	});

	test("continues in print mode", async () => {
		const { onInput, fetch } = setupClassifiable();
		const result = await onInput(inputEvent(), inputCtx({ mode: "print" }));
		expect(result).toEqual({ action: "continue" });
		expect(fetch.calls).toBe(0);
	});

	test("continues for extension-sourced input", async () => {
		const { onInput, fetch } = setupClassifiable();
		const result = await onInput(
			inputEvent({ source: "extension" }),
			inputCtx(),
		);
		expect(result).toEqual({ action: "continue" });
		expect(fetch.calls).toBe(0);
	});

	test("continues and notifies when the typesafe key is missing", async () => {
		writeResearcherProject();
		writeAuth();
		const fetch = mockClassify("researcher");
		const { onInput } = installSelector();
		const notifies: Array<{ message: string; level: string }> = [];
		const result = await onInput(inputEvent(), inputCtx({ notifies }));
		expect(result).toEqual({ action: "continue" });
		expect(fetch.calls).toBe(0);
		expect(notifies).toEqual([
			{
				message: "rune-profile-selector: missing typesafe key in auth.json",
				level: "warning",
			},
		]);
	});
});

describe("profile-selector rune-select", () => {
	test("notifies and sends pending on the replacement session", async () => {
		writeResearcherProject();
		(globalThis as GlobalStore)[PENDING_STORE] = {
			text: "research this paper",
		};
		const { onSelect, sendCalls } = installSelector();
		const replacementNotifies: Array<{ message: string; level: string }> = [];
		const replacementSends: unknown[] = [];
		await onSelect("researcher", {
			newSession: async ({
				withSession,
			}: {
				withSession?: (ctx: ExtensionCommandContext) => Promise<void>;
			}) => {
				await withSession?.({
					ui: {
						notify: (message: string, level: string) => {
							replacementNotifies.push({ message, level });
						},
					},
					sendUserMessage: async (content: unknown) => {
						replacementSends.push(content);
					},
				} as unknown as ExtensionCommandContext);
				return { cancelled: false };
			},
		} as unknown as ExtensionCommandContext);
		expect(replacementNotifies).toEqual([
			{ message: "Profile: researcher", level: "info" },
		]);
		expect(replacementSends).toEqual(["research this paper"]);
		expect(sendCalls).toEqual([]);
		expect((globalThis as GlobalStore)[ACTIVE_STORE]).toBe("researcher");
		expect((globalThis as GlobalStore)[PENDING_STORE]).toBeUndefined();
	});

	test("restores the previous id and resends pending when cancelled", async () => {
		writeResearcherProject();
		(globalThis as GlobalStore)[ACTIVE_STORE] = "default";
		(globalThis as GlobalStore)[PENDING_STORE] = {
			text: "research this paper",
		};
		const { onSelect, sendCalls } = installSelector();
		const notifies: Array<{ message: string; level: string }> = [];
		await onSelect("researcher", {
			ui: {
				notify: (message: string, level: string) => {
					notifies.push({ message, level });
				},
			},
			newSession: async () => ({ cancelled: true }),
		} as unknown as ExtensionCommandContext);
		expect((globalThis as GlobalStore)[ACTIVE_STORE]).toBe("default");
		expect(notifies).toEqual([
			{ message: "Profile switch cancelled", level: "warning" },
		]);
		expect(sendCalls).toEqual([{ content: "research this paper" }]);
	});
});
