import { randomInt } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { profileDirForScope, profilesRootForScope } from "@rune/engine";
import type {
	CreateProfileInput,
	Profile,
	ProfileMeta,
	RuneScope,
	ThinkingLevel,
	UpdateProfileInput,
} from "@rune/sdk";
import { THINKING_LEVELS } from "@rune/sdk";

const RUNIC_LETTERS = [
	...Array.from({ length: 0x16ea - 0x16a0 + 1 }, (_, i) =>
		String.fromCodePoint(0x16a0 + i),
	),
	...Array.from({ length: 0x16f8 - 0x16f1 + 1 }, (_, i) =>
		String.fromCodePoint(0x16f1 + i),
	),
];

function ensureDir(path: string): void {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

function isSafeProfileId(id: string): boolean {
	return (
		id.length > 0 &&
		id !== "default" &&
		id !== "." &&
		id !== ".." &&
		!id.startsWith(".") &&
		!id.includes("/") &&
		!id.includes("\\")
	);
}

function readJson<T>(path: string, fallback: T): T {
	if (!existsSync(path)) return fallback;
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as T;
	} catch {
		return fallback;
	}
}

function writeJson(path: string, data: unknown): void {
	writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function optionalSubdir(dir: string, name: string): string | undefined {
	const path = join(dir, name);
	try {
		if (existsSync(path) && statSync(path).isDirectory()) return path;
	} catch {
		return undefined;
	}
	return undefined;
}

function loadProfile(
	id: string,
	cwd: string,
	scope: RuneScope,
): Profile | undefined {
	if (!isSafeProfileId(id)) return undefined;
	const dir = profileDirForScope(id, scope, cwd);
	if (!existsSync(dir) || !statSync(dir).isDirectory()) return undefined;

	const meta = readJson<ProfileMeta>(join(dir, "profile.json"), {});
	const systemPath = join(dir, "SYSTEM.md");

	return {
		id,
		displayName: meta.name?.trim() || id,
		meta,
		hasSystemPrompt: existsSync(systemPath),
		paths: {
			dir,
			skills: optionalSubdir(dir, "skills"),
			prompts: optionalSubdir(dir, "prompts"),
			themes: optionalSubdir(dir, "themes"),
			extensions: optionalSubdir(dir, "extensions"),
		},
	};
}

function parseThinkingLevel(value: string): ThinkingLevel {
	if ((THINKING_LEVELS as readonly string[]).includes(value)) {
		return value as ThinkingLevel;
	}
	throw new Error(`Invalid thinkingLevel "${value}"`);
}

function requireNonEmpty(value: string, field: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${field} cannot be empty`);
	}
	return trimmed;
}

function assignGlyph(cwd: string, scope: RuneScope): string {
	const used = new Set(
		listProfiles(cwd, scope)
			.map((profile) => profile.meta.glyph)
			.filter((glyph): glyph is string => Boolean(glyph)),
	);
	const available = RUNIC_LETTERS.filter((glyph) => !used.has(glyph));
	const pool = available.length > 0 ? available : RUNIC_LETTERS;
	return pool[randomInt(pool.length)] ?? pool[0] ?? "ᚠ";
}

function writeSystemPrompt(dir: string, prompt: string): void {
	writeFileSync(
		join(dir, "SYSTEM.md"),
		`${requireNonEmpty(prompt, "systemPrompt")}\n`,
		"utf-8",
	);
}

function requireProfile(id: string, cwd: string, scope: RuneScope): Profile {
	const profile = getProfile(id, cwd, scope);
	if (!profile) {
		throw new Error(`Profile "${id}" not found`);
	}
	return profile;
}

export function listProfiles(
	cwd: string = process.cwd(),
	scope: RuneScope = "user",
): Profile[] {
	const root = profilesRootForScope(scope, cwd);
	if (!existsSync(root)) return [];

	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && isSafeProfileId(entry.name))
		.map((entry) => loadProfile(entry.name, cwd, scope))
		.filter((profile): profile is Profile => profile !== undefined)
		.sort((a, b) => a.id.localeCompare(b.id));
}

export function getProfile(
	id: string,
	cwd: string = process.cwd(),
	scope: RuneScope = "user",
): Profile | undefined {
	return loadProfile(id, cwd, scope);
}

export function createProfile(
	input: CreateProfileInput,
	cwd: string = process.cwd(),
	scope: RuneScope = "user",
): Profile {
	if (!isSafeProfileId(input.id)) {
		throw new Error(`Invalid profile id "${input.id}"`);
	}

	if (getProfile(input.id, cwd, scope)) {
		throw new Error(`Profile "${input.id}" already exists`);
	}

	const dir = profileDirForScope(input.id, scope, cwd);
	const meta: ProfileMeta = { glyph: assignGlyph(cwd, scope) };
	if (input.name?.trim()) meta.name = input.name.trim();
	if (input.model?.trim()) meta.model = input.model.trim();
	if (input.thinkingLevel) {
		meta.thinkingLevel = parseThinkingLevel(input.thinkingLevel);
	}

	ensureDir(dir);
	writeJson(join(dir, "profile.json"), meta);

	if (input.systemPrompt?.trim()) {
		writeSystemPrompt(dir, input.systemPrompt);
	}

	return requireProfile(input.id, cwd, scope);
}

export function updateProfile(
	id: string,
	input: UpdateProfileInput,
	options: { cwd?: string; scope?: RuneScope } = {},
): Profile {
	const cwd = options.cwd ?? process.cwd();
	const scope = options.scope ?? "user";
	const profile = requireProfile(id, cwd, scope);
	const meta: ProfileMeta = { ...profile.meta };

	if (input.name !== undefined) meta.name = requireNonEmpty(input.name, "name");
	if (input.model !== undefined)
		meta.model = requireNonEmpty(input.model, "model");
	if (input.thinkingLevel !== undefined) {
		meta.thinkingLevel = parseThinkingLevel(input.thinkingLevel);
	}

	writeJson(join(profile.paths.dir, "profile.json"), meta);

	if (input.systemPrompt !== undefined) {
		writeSystemPrompt(profile.paths.dir, input.systemPrompt);
	}

	return requireProfile(id, cwd, scope);
}

export function deleteProfile(
	id: string,
	options: { force?: boolean; cwd?: string; scope?: RuneScope } = {},
): void {
	if (!isSafeProfileId(id)) {
		throw new Error(`Invalid profile id "${id}"`);
	}

	const cwd = options.cwd ?? process.cwd();
	const scope = options.scope ?? "user";
	const profile = requireProfile(id, cwd, scope);
	rmSync(profile.paths.dir, { recursive: true, force: true });
}
