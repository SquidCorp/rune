import { join } from "node:path";

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
