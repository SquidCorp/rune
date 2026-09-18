import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { type InlineExtension, main } from "@earendil-works/pi-coding-agent";

import {
	profileDir,
	profilesRoot,
	runeDir,
	userRuneDir,
} from "../paths/index.ts";
import profileExtensionFactory from "../profile/index.ts";

/** Pi reads this instead of ~/.pi/agent. Not re-exported from the package JS. */
const PI_AGENT_DIR_ENV = "PI_CODING_AGENT_DIR";

const profileExtension: InlineExtension = {
	name: "pi-profile",
	factory: profileExtensionFactory,
};

export interface InvokeInteractiveOptions {
	profile?: string;
	extraArgs?: string[];
}

function isUnsafeProfileId(id: string): boolean {
	return (
		id.length === 0 ||
		id === "." ||
		id === ".." ||
		id.startsWith(".") ||
		id.includes("/") ||
		id.includes("\\")
	);
}

export function assertInvokeProfile(profile: string): void {
	const id = profile.trim();
	const root = profilesRoot();
	if (isUnsafeProfileId(id)) {
		throw new Error(`Profile "${id}" not found in ${root}`);
	}
	const dir = profileDir(id);
	if (!existsSync(dir) || !statSync(dir).isDirectory()) {
		throw new Error(`Profile "${id}" not found in ${root}`);
	}
}

export function piArgsForInvoke(options: InvokeInteractiveOptions): string[] {
	const extra = options.extraArgs ?? [];
	const id = options.profile?.trim();
	if (!id || id === "default") return [...extra];
	return ["--profile", id, ...extra];
}

function authHasProviders(path: string): boolean {
	if (!existsSync(path)) return false;
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return false;
		}
		return Object.keys(parsed).length > 0;
	} catch {
		return false;
	}
}

/** Pi agentDir is user-scoped; project `.rune/auth.json` is never read. */
export function assertInvokeAuthLocation(): void {
	const userAuth = join(userRuneDir(), "auth.json");
	if (authHasProviders(userAuth)) return;
	const projectAuth = join(runeDir(), "auth.json");
	if (!authHasProviders(projectAuth)) return;
	throw new Error(
		`Pi reads credentials from ${userAuth}, not ${projectAuth}. Move auth.json to the user Rune dir (~/.rune or $RUNE_HOME).`,
	);
}

export async function invokeInteractive(
	options: InvokeInteractiveOptions = {},
): Promise<void> {
	const id = options.profile?.trim();
	if (id && id !== "default") assertInvokeProfile(id);
	assertInvokeAuthLocation();
	process.env[PI_AGENT_DIR_ENV] = userRuneDir();
	await main(piArgsForInvoke(options), {
		extensionFactories: [profileExtension],
	});
}
