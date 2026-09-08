import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createHandler } from "../../app.ts";

const dirs: string[] = [];

afterEach(() => {
	while (dirs.length > 0) {
		const dir = dirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
});

function tempCwd(): string {
	const dir = mkdtempSync(join(tmpdir(), "rune-graph-run-"));
	dirs.push(dir);
	return dir;
}

function writeProfile(cwd: string, id: string): void {
	const dir = join(cwd, ".rune", "profiles", id);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "profile.json"), "{}\n", "utf-8");
}

function writeGraph(cwd: string, id: string, toml: string): void {
	const dir = join(cwd, ".rune", "graphs");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, `${id}.toml`), toml, "utf-8");
}

describe("POST /graphs/:id/run", () => {
	test("returns 400 validation issues without running when invalid", async () => {
		const cwd = tempCwd();
		writeProfile(cwd, "planner");
		writeGraph(
			cwd,
			"broken",
			`
[[nodes]]
id = "a"
profile = "planner"

[[nodes]]
id = "b"
profile = "missing"

[[edges]]
from = "a"
to = "b"
`,
		);

		const handler = createHandler({ cwd });
		const res = await handler(
			new Request("http://127.0.0.1/graphs/broken/run", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ prompt: "hi" }),
			}),
		);

		expect(res.status).toBe(400);
		const body = (await res.json()) as {
			ok: boolean;
			issues: Array<{ code: string }>;
		};
		expect(body.ok).toBe(false);
		expect(body.issues.some((i) => i.code.includes("profile"))).toBe(true);
	});

	test("returns 404 for unknown graph", async () => {
		const cwd = tempCwd();
		const handler = createHandler({ cwd });
		const res = await handler(
			new Request("http://127.0.0.1/graphs/nope/run", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ prompt: "hi" }),
			}),
		);
		expect(res.status).toBe(404);
	});
});

describe("POST /graphs/:id/run verbose body", () => {
	test("returns 400 when verbose is not boolean", async () => {
		const cwd = tempCwd();
		writeProfile(cwd, "planner");
		writeGraph(
			cwd,
			"ok",
			`
[[nodes]]
id = "a"
profile = "planner"
`,
		);

		const handler = createHandler({ cwd });
		const res = await handler(
			new Request("http://127.0.0.1/graphs/ok/run", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ prompt: "hi", verbose: "yes" }),
			}),
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain("verbose");
	});
});
