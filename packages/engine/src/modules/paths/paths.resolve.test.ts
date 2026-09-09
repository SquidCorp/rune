import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
	profileDirForScope,
	profilesRoot,
	profilesRootForScope,
	resolveRuneCwd,
	runeDir,
	userRuneDir,
} from "./paths.resolve.ts";

const originalRuneHome = process.env.RUNE_HOME;
const originalRuneCwd = process.env.RUNE_CWD;
const temps: string[] = [];

function tempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	temps.push(dir);
	return dir;
}

afterEach(() => {
	if (originalRuneHome === undefined) {
		delete process.env.RUNE_HOME;
	} else {
		process.env.RUNE_HOME = originalRuneHome;
	}
	if (originalRuneCwd === undefined) {
		delete process.env.RUNE_CWD;
	} else {
		process.env.RUNE_CWD = originalRuneCwd;
	}
	for (const dir of temps.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("userRuneDir", () => {
	test("defaults to ~/.rune when RUNE_HOME unset", () => {
		delete process.env.RUNE_HOME;
		expect(userRuneDir()).toBe(join(homedir(), ".rune"));
	});

	test("uses absolute RUNE_HOME when set", () => {
		const home = tempDir("rune-home-");
		process.env.RUNE_HOME = home;
		expect(userRuneDir()).toBe(resolve(home));
	});
});

describe("runeDir", () => {
	test("joins cwd with .rune", () => {
		const cwd = tempDir("rune-cwd-");
		expect(runeDir(cwd)).toBe(join(cwd, ".rune"));
	});
});

describe("resolveRuneCwd", () => {
	test("skips user-scoped RUNE_HOME .rune and returns start", () => {
		const fakeHome = tempDir("rune-fakehome-");
		const userRoot = join(fakeHome, ".rune");
		mkdirSync(userRoot, { recursive: true });
		const nested = join(fakeHome, "proj", "nested");
		mkdirSync(nested, { recursive: true });
		process.env.RUNE_HOME = userRoot;
		delete process.env.RUNE_CWD;

		expect(resolveRuneCwd(nested)).toBe(resolve(nested));
	});

	test("finds project .rune from nested package dir", () => {
		const proj = tempDir("rune-proj-");
		mkdirSync(join(proj, ".rune"), { recursive: true });
		const nested = join(proj, "packages", "api");
		mkdirSync(nested, { recursive: true });
		delete process.env.RUNE_CWD;
		delete process.env.RUNE_HOME;

		expect(resolveRuneCwd(nested)).toBe(resolve(proj));
	});
});

describe("profilesRootForScope", () => {
	test("user scope uses RUNE_HOME/profiles", () => {
		const home = tempDir("rune-scope-user-");
		process.env.RUNE_HOME = home;
		expect(profilesRootForScope("user")).toBe(join(resolve(home), "profiles"));
	});

	test("project scope uses cwd/.rune/profiles", () => {
		const cwd = tempDir("rune-scope-proj-");
		expect(profilesRootForScope("project", cwd)).toBe(
			join(cwd, ".rune", "profiles"),
		);
	});

	test("profileDirForScope joins id under each root", () => {
		const home = tempDir("rune-scope-dir-user-");
		const cwd = tempDir("rune-scope-dir-proj-");
		process.env.RUNE_HOME = home;
		expect(profileDirForScope("p", "user")).toBe(
			join(resolve(home), "profiles", "p"),
		);
		expect(profileDirForScope("p", "project", cwd)).toBe(
			join(cwd, ".rune", "profiles", "p"),
		);
	});

	test("profilesRoot remains project-only", () => {
		const cwd = tempDir("rune-profiles-root-");
		expect(profilesRoot(cwd)).toBe(join(cwd, ".rune", "profiles"));
	});
});
