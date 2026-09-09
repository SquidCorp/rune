import { readFileSync } from "node:fs";
import {
	parseRuneScope,
	type RuneClient,
	type RuneScope,
	THINKING_LEVELS,
	type ThinkingLevel,
} from "@rune/sdk";

function flagValue(args: string[], name: string): string | undefined {
	const idx = args.indexOf(name);
	if (idx === -1) return undefined;
	const value = args[idx + 1];
	if (value === undefined || value.startsWith("--") || !value.trim()) {
		throw new Error(`${name} requires a value`);
	}
	return value;
}

function parseScopeFlag(args: string[]): RuneScope {
	if (!args.includes("--scope")) return "user";
	return parseRuneScope(flagValue(args, "--scope"));
}

function parseThinkingLevelFlag(args: string[]): ThinkingLevel | undefined {
	const value = flagValue(args, "--thinking-level");
	if (value === undefined) return undefined;
	if (!(THINKING_LEVELS as readonly string[]).includes(value)) {
		throw new Error(
			`Invalid thinking level "${value}". Use: ${THINKING_LEVELS.join(", ")}`,
		);
	}
	return value as ThinkingLevel;
}

function readPromptFlags(args: string[]): string | undefined {
	const hasPrompt = args.includes("--prompt");
	const hasFile = args.includes("--prompt-file");
	if (hasPrompt && hasFile) {
		throw new Error("Use either --prompt or --prompt-file, not both");
	}
	if (hasFile) {
		const path = flagValue(args, "--prompt-file");
		if (!path) {
			throw new Error("--prompt-file requires a value");
		}
		try {
			return readFileSync(path, "utf-8");
		} catch {
			throw new Error(`Cannot read --prompt-file "${path}"`);
		}
	}
	if (hasPrompt) {
		return flagValue(args, "--prompt");
	}
	return undefined;
}

interface ProfileMutation {
	name?: string;
	model?: string;
	thinkingLevel?: ThinkingLevel;
	systemPrompt?: string;
}

function profileMutationFromArgs(args: string[]): ProfileMutation {
	return {
		name: flagValue(args, "--name"),
		model: flagValue(args, "--model"),
		thinkingLevel: parseThinkingLevelFlag(args),
		systemPrompt: readPromptFlags(args),
	};
}

function requireProfileId(rest: string[], usage: string): string {
	const id = rest[0];
	if (!id || id.startsWith("--")) {
		throw new Error(usage);
	}
	return id;
}

async function cmdProfileList(
	client: RuneClient,
	rest: string[],
): Promise<void> {
	const scope = parseScopeFlag(rest);
	const profiles = await client.listProfiles({ scope });
	if (profiles.length === 0) {
		console.log("No profiles yet.");
		return;
	}
	for (const profile of profiles) {
		console.log(
			`${profile.meta.glyph ?? "-"}\t${profile.id}\t${profile.displayName}`,
		);
	}
}

async function cmdProfileShow(
	client: RuneClient,
	rest: string[],
): Promise<void> {
	const id = requireProfileId(
		rest,
		"Usage: rune profile show <id> [--scope user|project]",
	);
	const scope = parseScopeFlag(rest);
	const profile = await client.getProfile(id, { scope });
	console.log(`${profile.meta.glyph ?? "-"}\t${profile.id}`);
	console.log(`name\t${profile.displayName}`);
	if (profile.meta.model) console.log(`model\t${profile.meta.model}`);
	if (profile.meta.thinkingLevel) {
		console.log(`thinkingLevel\t${profile.meta.thinkingLevel}`);
	}
	console.log(`system\t${profile.hasSystemPrompt ? "SYSTEM.md" : "(none)"}`);
	console.log(`dir\t${profile.paths.dir}`);
}

async function cmdProfileCreate(
	client: RuneClient,
	rest: string[],
): Promise<void> {
	const id = requireProfileId(
		rest,
		"Usage: rune profile create <id> [--name <name>] [--model <provider/id>] [--thinking-level <level>] [--prompt <string>] [--prompt-file <path>] [--scope user|project]",
	);
	const scope = parseScopeFlag(rest);
	const profile = await client.createProfile(
		{
			id,
			...profileMutationFromArgs(rest),
		},
		{ scope },
	);
	const glyph = profile.meta.glyph ? `${profile.meta.glyph} ` : "";
	console.log(`Created profile ${glyph}${profile.id}`);
}

async function cmdProfileSet(
	client: RuneClient,
	rest: string[],
): Promise<void> {
	const usage =
		"Usage: rune profile set <id> [--name <name>] [--model <provider/id>] [--thinking-level <level>] [--prompt <string>] [--prompt-file <path>] [--scope user|project]";
	const id = requireProfileId(rest, usage);
	const scope = parseScopeFlag(rest);
	const input = profileMutationFromArgs(rest);
	if (
		input.name === undefined &&
		input.model === undefined &&
		input.thinkingLevel === undefined &&
		input.systemPrompt === undefined
	) {
		throw new Error(usage);
	}
	const profile = await client.updateProfile(id, input, { scope });
	console.log(`Updated profile ${profile.id}`);
}

async function cmdProfileDelete(
	client: RuneClient,
	rest: string[],
): Promise<void> {
	const id = requireProfileId(
		rest,
		"Usage: rune profile delete <id> [--force] [--scope user|project]",
	);
	const scope = parseScopeFlag(rest);
	await client.deleteProfile(id, {
		force: rest.includes("--force"),
		scope,
	});
	console.log(`Deleted profile ${id}`);
}

export async function runProfileCommand(options: {
	client: RuneClient;
	sub: string | undefined;
	rest: string[];
	printHelp: () => void;
}): Promise<void> {
	const { client, sub, rest, printHelp } = options;
	switch (sub) {
		case "list":
			await cmdProfileList(client, rest);
			return;
		case "show":
			await cmdProfileShow(client, rest);
			return;
		case "create":
			await cmdProfileCreate(client, rest);
			return;
		case "set":
			await cmdProfileSet(client, rest);
			return;
		case "delete":
			await cmdProfileDelete(client, rest);
			return;
		default:
			printHelp();
			throw new Error(`Unknown profile command: ${sub ?? "(none)"}`);
	}
}
