import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * Resolve the project cwd that owns `.rune/`.
 * Prefer `RUNE_CWD`, else nearest ancestor (including start) that contains a
 * project `.rune` (not the user-scoped root), else `process.cwd()`.
 * Lets monorepo `packages/api` dev find the repo-root data dir.
 */
export function resolveRuneCwd(start: string = process.cwd()): string {
	const fromEnv = process.env.RUNE_CWD?.trim();
	if (fromEnv) return resolve(fromEnv);

	const userRoot = resolve(userRuneDir());
	let dir = resolve(start);
	for (;;) {
		const candidate = resolve(join(dir, ".rune"));
		if (existsSync(join(dir, ".rune")) && candidate !== userRoot) {
			return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return resolve(start);
}

/** User-scoped Pi agentDir — `$RUNE_HOME` or `~/.rune`. */
export function userRuneDir(): string {
	const fromEnv = process.env.RUNE_HOME?.trim();
	if (fromEnv) return resolve(fromEnv);
	return join(homedir(), ".rune");
}

/** Project data root (profiles, graphs, artifacts). */
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

/** Profile root for `--scope user` ($RUNE_HOME/profiles) or project (.rune/profiles). */
export function profilesRootForScope(
	scope: "user" | "project",
	cwd: string = process.cwd(),
): string {
	return join(scope === "user" ? userRuneDir() : runeDir(cwd), "profiles");
}

export function profileDirForScope(
	id: string,
	scope: "user" | "project",
	cwd: string = process.cwd(),
): string {
	return join(profilesRootForScope(scope, cwd), id);
}

/** Graph TOML files live under `.rune/graphs/<id>.toml`. */
export function graphsRoot(cwd: string = process.cwd()): string {
	return join(runeDir(cwd), "graphs");
}

export function graphPath(id: string, cwd: string = process.cwd()): string {
	return join(graphsRoot(cwd), `${id}.toml`);
}
