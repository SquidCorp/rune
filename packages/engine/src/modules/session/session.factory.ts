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

export interface CreateRuneSessionOptions {
	cwd?: string;
	inMemory?: boolean;
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

	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: localAgentDir,
		extensionFactories: [profileExtension],
	});

	await loader.reload();

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
