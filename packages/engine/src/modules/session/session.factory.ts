import {
	type CreateAgentSessionResult,
	createAgentSession,
	DefaultResourceLoader,
	type InlineExtension,
	ModelRuntime,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

import { runeDir } from "../paths/index.ts";
import profileExtensionFactory from "../profile/index.ts";

const profileExtension: InlineExtension = {
	name: "pi-profile",
	factory: profileExtensionFactory,
};

/** Same store the profile extension reads on session_start. */
const ACTIVE_PROFILE_STORE = Symbol.for("pi.profiles.activeId");

type GlobalStore = typeof globalThis & {
	[ACTIVE_PROFILE_STORE]?: string;
};

export interface CreateRuneSessionOptions {
	cwd?: string;
	inMemory?: boolean;
	/**
	 * Profile id to activate for this session (system prompt / model / skills).
	 * Applied via the profile extension before session_start.
	 */
	profile?: string;
}

function activateProfile(profile: string | undefined): void {
	const store = globalThis as GlobalStore;
	if (profile?.trim()) {
		store[ACTIVE_PROFILE_STORE] = profile.trim();
		return;
	}
	delete store[ACTIVE_PROFILE_STORE];
}

/**
 * Creates a fully configured Rune runtime session with pi-profile loaded.
 * Agent dir and profiles both resolve under `./.rune`.
 */
export async function createRuneSession(
	options?: CreateRuneSessionOptions,
): Promise<CreateAgentSessionResult> {
	const cwd = options?.cwd ?? process.cwd();
	const localAgentDir = runeDir(cwd);

	activateProfile(options?.profile);

	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: localAgentDir,
		extensionFactories: [profileExtension],
	});

	await loader.reload();

	// Prefer explicit extension flag in addition to ACTIVE_STORE.
	const profileId = options?.profile?.trim();
	if (profileId) {
		const extensions = loader.getExtensions();
		extensions.runtime.flagValues.set("profile", profileId);
	}

	const modelRuntime = await ModelRuntime.create();
	const sessionManager =
		options?.inMemory !== false
			? SessionManager.inMemory()
			: SessionManager.create(cwd);

	return createAgentSession({
		resourceLoader: loader,
		sessionManager,
		modelRuntime,
	});
}
