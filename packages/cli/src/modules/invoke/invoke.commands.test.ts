import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runInvokeCommand } from "./invoke.commands.ts";

const originalCwd = process.cwd();
const temps: string[] = [];

function tempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	temps.push(dir);
	return dir;
}

afterEach(() => {
	process.chdir(originalCwd);
	for (const dir of temps.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("rune invoke flags", () => {
	test("requires a value for --profile", async () => {
		await expect(runInvokeCommand(["--profile"])).rejects.toThrow(
			"--profile requires a value",
		);
	});

	test("fails before Pi when the profile directory is missing", async () => {
		const cwd = tempDir("rune-cli-invoke-");
		mkdirSync(join(cwd, ".rune", "profiles"), { recursive: true });
		process.chdir(cwd);

		await expect(
			runInvokeCommand(["--profile", "researcher", "--continue"]),
		).rejects.toThrow(/Profile "researcher" not found/);
	});
});
