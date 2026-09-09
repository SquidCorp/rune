export const THINKING_LEVELS = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
] as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export const RUNE_SCOPES = ["user", "project"] as const;

export type RuneScope = (typeof RUNE_SCOPES)[number];

export function parseRuneScope(value: string | undefined | null): RuneScope {
	if (value === undefined || value === null || value === "") {
		return "user";
	}
	if (value === "user" || value === "project") {
		return value;
	}
	throw new Error(`Invalid scope "${value}". Use: user, project`);
}

export interface ProfileMeta {
	name?: string;
	model?: string;
	thinkingLevel?: ThinkingLevel;
	glyph?: string;
}

export interface Profile {
	id: string;
	displayName: string;
	meta: ProfileMeta;
	hasSystemPrompt: boolean;
	paths: {
		dir: string;
		skills?: string;
		prompts?: string;
		themes?: string;
		extensions?: string;
	};
}

export interface CreateProfileInput {
	id: string;
	name?: string;
	model?: string;
	thinkingLevel?: ThinkingLevel;
	systemPrompt?: string;
}

export interface UpdateProfileInput {
	name?: string;
	model?: string;
	thinkingLevel?: ThinkingLevel;
	systemPrompt?: string;
}
