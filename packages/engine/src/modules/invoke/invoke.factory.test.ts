import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	assertInvokeAuthLocation,
	assertInvokeProfile,
	piArgsForInvoke,
} from "./invoke.factory.ts";

const originalCwd = process.cwd();
const originalRuneHome = process.env.RUNE_HOME;
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
	for (const dir of temps.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("assertInvokeProfile", () => {
	test("rejects a missing project profile", () => {
		const cwd = tempDir("rune-invoke-missing-");
		mkdirSync(join(cwd, ".rune", "profiles"), { recursive: true });
		process.chdir(cwd);

		expect(() => assertInvokeProfile("researcher")).toThrow(
			/Profile "researcher" not found/,
		);
	});

	test("accepts an existing project profile directory", () => {
		const cwd = tempDir("rune-invoke-ok-");
		const dir = join(cwd, ".rune", "profiles", "researcher");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "profile.json"), "{}");
		process.chdir(cwd);

		expect(() => assertInvokeProfile("researcher")).not.toThrow();
	});

	test("rejects path-like profile ids", () => {
		const cwd = tempDir("rune-invoke-unsafe-");
		mkdirSync(join(cwd, ".rune", "profiles"), { recursive: true });
		process.chdir(cwd);

		expect(() => assertInvokeProfile("../secret")).toThrow(/not found/);
	});
});

describe("piArgsForInvoke", () => {
	test("forwards --profile then extra Pi args", () => {
		expect(
			piArgsForInvoke({
				profile: "researcher",
				extraArgs: ["--continue", "hello"],
			}),
		).toEqual(["--profile", "researcher", "--continue", "hello"]);
	});

	test("omits --profile for Default", () => {
		expect(piArgsForInvoke({ extraArgs: ["--continue"] })).toEqual([
			"--continue",
		]);
		expect(
			piArgsForInvoke({ profile: "default", extraArgs: ["hello"] }),
		).toEqual(["hello"]);
	});
});

describe("assertInvokeAuthLocation", () => {
	test("errors when credentials are only in project .rune/auth.json", () => {
		const userDir = tempDir("rune-invoke-user-");
		const cwd = tempDir("rune-invoke-proj-");
		process.env.RUNE_HOME = userDir;
		writeFileSync(join(userDir, "auth.json"), "{}");
		mkdirSync(join(cwd, ".rune"), { recursive: true });
		writeFileSync(
			join(cwd, ".rune", "auth.json"),
			JSON.stringify({ openrouter: { type: "api_key", key: "x" } }),
		);
		process.chdir(cwd);

		expect(() => assertInvokeAuthLocation()).toThrow(
			/Pi reads credentials from/,
		);
		expect(() => assertInvokeAuthLocation()).toThrow(/not .*auth\.json/);
	});

	test("allows empty project auth when user auth has a provider", () => {
		const userDir = tempDir("rune-invoke-user-ok-");
		const cwd = tempDir("rune-invoke-proj-ok-");
		process.env.RUNE_HOME = userDir;
		writeFileSync(
			join(userDir, "auth.json"),
			JSON.stringify({ openrouter: { type: "api_key", key: "x" } }),
		);
		mkdirSync(join(cwd, ".rune"), { recursive: true });
		process.chdir(cwd);

		expect(() => assertInvokeAuthLocation()).not.toThrow();
	});
});
