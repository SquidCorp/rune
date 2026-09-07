import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Resolve the project cwd that owns `.rune/`.
 * Prefer `RUNE_CWD`, else nearest ancestor (including start) that contains `.rune`,
 * else `process.cwd()`. Lets monorepo `packages/api` dev find the repo-root data dir.
 */
export function resolveRuneCwd(start: string = process.cwd()): string {
	const fromEnv = process.env.RUNE_CWD?.trim();
	if (fromEnv) return resolve(fromEnv);

	let dir = resolve(start);
	for (;;) {
		if (existsSync(join(dir, ".rune"))) return dir;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return resolve(start);
}

/** Runtime data root — single source of truth for agent state and profiles. */
export function runeDir(cwd: string = process.cwd()): string {
	return join(cwd, ".rune");
}

/** Profile directories live under `.rune/profiles/<id>/`. */
export function profilesRoot(cwd: string = process.cwd()): string {
	return join(runeDir(cwd), "profiles");
}

export function profileDir(id: string, cwd: string = process.cwd()): string {
	return join(profilesRoot(cwd), id);
}

/** Graph TOML files live under `.rune/graphs/<id>.toml`. */
export function graphsRoot(cwd: string = process.cwd()): string {
	return join(runeDir(cwd), "graphs");
}

export function graphPath(id: string, cwd: string = process.cwd()): string {
	return join(graphsRoot(cwd), `${id}.toml`);
}
