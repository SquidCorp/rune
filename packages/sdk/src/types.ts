export type ThinkingLevel =
	| "off"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh"
	| "max";

export interface ProfileMeta {
	name?: string;
	model?: string;
	thinkingLevel?: ThinkingLevel;
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

export interface Link {
	id: string;
	from: string;
	to: string;
	label?: string;
}

export interface CreateLinkInput {
	from: string;
	to: string;
	label?: string;
}

export interface HealthResponse {
	ok: true;
	service: "rune-api";
	version: string;
}
