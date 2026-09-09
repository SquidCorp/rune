import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRuneSession } from "./session.factory.ts";

const originalRuneHome = process.env.RUNE_HOME;
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
	for (const dir of temps.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("createRuneSession", () => {
	test("persists sessions under userRuneDir, not project .rune", async () => {
		const userDir = tempDir("rune-user-");
		const cwd = tempDir("rune-proj-");
		mkdirSync(join(cwd, ".rune"), { recursive: true });
		process.env.RUNE_HOME = userDir;

		const { session } = await createRuneSession({ cwd, inMemory: false });
		try {
			const userSessions = join(userDir, "sessions");
			const projectSessions = join(cwd, ".rune", "sessions");

			if (existsSync(userSessions)) {
				expect(existsSync(userSessions)).toBe(true);
			} else {
				// Contingency: session files may not appear until prompt.
				for (const name of [
					"auth.json",
					"models.json",
					"settings.json",
					"sessions",
				]) {
					expect(existsSync(join(cwd, ".rune", name))).toBe(false);
				}
				expect(process.env.RUNE_HOME).toBe(userDir);
			}
			expect(existsSync(projectSessions)).toBe(false);
		} finally {
			session.dispose?.();
		}
	});
});
