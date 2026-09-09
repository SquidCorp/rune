import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createHandler } from "../../app.ts";
import { createProfile, listProfiles } from "./profile.store.ts";

const dirs: string[] = [];
const originalRuneHome = process.env.RUNE_HOME;

afterEach(() => {
	if (originalRuneHome === undefined) {
		delete process.env.RUNE_HOME;
	} else {
		process.env.RUNE_HOME = originalRuneHome;
	}
	while (dirs.length > 0) {
		const dir = dirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
});

function tempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	dirs.push(dir);
	return dir;
}

describe("profile store scope", () => {
	test("createProfile user writes under RUNE_HOME/profiles", () => {
		const userDir = tempDir("rune-profile-user-");
		const cwd = tempDir("rune-profile-cwd-");
		process.env.RUNE_HOME = userDir;

		createProfile({ id: "u" }, cwd, "user");

		expect(existsSync(join(userDir, "profiles", "u", "profile.json"))).toBe(
			true,
		);
		expect(existsSync(join(cwd, ".rune", "profiles", "u"))).toBe(false);
	});

	test("createProfile project writes under cwd/.rune/profiles", () => {
		const userDir = tempDir("rune-profile-user-p-");
		const cwd = tempDir("rune-profile-cwd-p-");
		process.env.RUNE_HOME = userDir;

		createProfile({ id: "p" }, cwd, "project");

		expect(
			existsSync(join(cwd, ".rune", "profiles", "p", "profile.json")),
		).toBe(true);
		expect(existsSync(join(userDir, "profiles", "p"))).toBe(false);
	});

	test("same id allowed in both scopes", () => {
		const userDir = tempDir("rune-profile-both-user-");
		const cwd = tempDir("rune-profile-both-cwd-");
		process.env.RUNE_HOME = userDir;

		createProfile({ id: "shared" }, cwd, "user");
		createProfile({ id: "shared" }, cwd, "project");

		expect(
			existsSync(join(userDir, "profiles", "shared", "profile.json")),
		).toBe(true);
		expect(
			existsSync(join(cwd, ".rune", "profiles", "shared", "profile.json")),
		).toBe(true);
	});

	test("listProfiles user does not include project-only id", () => {
		const userDir = tempDir("rune-profile-list-user-");
		const cwd = tempDir("rune-profile-list-cwd-");
		process.env.RUNE_HOME = userDir;

		createProfile({ id: "only-project" }, cwd, "project");
		createProfile({ id: "only-user" }, cwd, "user");

		const userList = listProfiles(cwd, "user").map((p) => p.id);
		expect(userList).toContain("only-user");
		expect(userList).not.toContain("only-project");
	});

	test("omitted scope on createProfile defaults to user", () => {
		const userDir = tempDir("rune-profile-default-user-");
		const cwd = tempDir("rune-profile-default-cwd-");
		process.env.RUNE_HOME = userDir;

		createProfile({ id: "d" }, cwd);

		expect(existsSync(join(userDir, "profiles", "d", "profile.json"))).toBe(
			true,
		);
		expect(existsSync(join(cwd, ".rune", "profiles", "d"))).toBe(false);
	});
});

describe("profile HTTP scope", () => {
	test("POST /profiles without query writes user root", async () => {
		const userDir = tempDir("rune-http-user-");
		const cwd = tempDir("rune-http-cwd-");
		process.env.RUNE_HOME = userDir;

		const handler = createHandler({ cwd });
		const res = await handler(
			new Request("http://127.0.0.1/profiles", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id: "http-u" }),
			}),
		);

		expect(res.status).toBe(201);
		expect(
			existsSync(join(userDir, "profiles", "http-u", "profile.json")),
		).toBe(true);
		expect(existsSync(join(cwd, ".rune", "profiles", "http-u"))).toBe(false);
	});

	test("POST /profiles?scope=project writes project root", async () => {
		const userDir = tempDir("rune-http-proj-user-");
		const cwd = tempDir("rune-http-proj-cwd-");
		process.env.RUNE_HOME = userDir;

		const handler = createHandler({ cwd });
		const res = await handler(
			new Request("http://127.0.0.1/profiles?scope=project", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id: "http-p" }),
			}),
		);

		expect(res.status).toBe(201);
		expect(
			existsSync(join(cwd, ".rune", "profiles", "http-p", "profile.json")),
		).toBe(true);
		expect(existsSync(join(userDir, "profiles", "http-p"))).toBe(false);
	});

	test("GET /profiles?scope=bogus returns 400", async () => {
		const userDir = tempDir("rune-http-bogus-user-");
		const cwd = tempDir("rune-http-bogus-cwd-");
		process.env.RUNE_HOME = userDir;

		const handler = createHandler({ cwd });
		const res = await handler(
			new Request("http://127.0.0.1/profiles?scope=bogus"),
		);

		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/Invalid scope/);
	});
});
