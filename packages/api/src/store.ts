import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { profileDir, profilesRoot, runeDir } from "@rune/engine";
import type {
	CreateLinkInput,
	CreateProfileInput,
	Link,
	Profile,
	ProfileMeta,
} from "@rune/sdk/types";

function ensureDir(path: string): void {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

function linksPath(cwd: string): string {
	return join(runeDir(cwd), "links.json");
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

function optionalSubdir(dir: string, name: string): string | undefined {
	const path = join(dir, name);
	try {
		if (existsSync(path) && statSync(path).isDirectory()) return path;
	} catch {
		return undefined;
	}
	return undefined;
}

function loadProfile(id: string, cwd: string): Profile | undefined {
	if (!isSafeProfileId(id)) return undefined;
	const dir = profileDir(id, cwd);
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

export function listProfiles(cwd: string = process.cwd()): Profile[] {
	const root = profilesRoot(cwd);
	if (!existsSync(root)) return [];

	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && isSafeProfileId(entry.name))
		.map((entry) => loadProfile(entry.name, cwd))
		.filter((profile): profile is Profile => profile !== undefined)
		.sort((a, b) => a.id.localeCompare(b.id));
}

export function getProfile(
	id: string,
	cwd: string = process.cwd(),
): Profile | undefined {
	return loadProfile(id, cwd);
}

export function createProfile(
	input: CreateProfileInput,
	cwd: string = process.cwd(),
): Profile {
	if (!isSafeProfileId(input.id)) {
		throw new Error(`Invalid profile id "${input.id}"`);
	}

	const existing = getProfile(input.id, cwd);
	if (existing) {
		throw new Error(`Profile "${input.id}" already exists`);
	}

	const dir = profileDir(input.id, cwd);
	ensureDir(dir);

	const meta: ProfileMeta = {};
	if (input.name?.trim()) meta.name = input.name.trim();
	if (input.model?.trim()) meta.model = input.model.trim();
	if (input.thinkingLevel) meta.thinkingLevel = input.thinkingLevel;

	writeFileSync(
		join(dir, "profile.json"),
		`${JSON.stringify(meta, null, 2)}\n`,
		"utf-8",
	);

	if (input.systemPrompt?.trim()) {
		writeFileSync(
			join(dir, "SYSTEM.md"),
			`${input.systemPrompt.trim()}\n`,
			"utf-8",
		);
	}

	const profile = getProfile(input.id, cwd);
	if (!profile) {
		throw new Error(`Failed to create profile "${input.id}"`);
	}
	return profile;
}

export function listLinks(cwd: string = process.cwd()): Link[] {
	return readJson<Link[]>(linksPath(cwd), []);
}

export function createLink(
	input: CreateLinkInput,
	cwd: string = process.cwd(),
): Link {
	if (!getProfile(input.from, cwd)) {
		throw new Error(`Unknown profile "${input.from}"`);
	}
	if (!getProfile(input.to, cwd)) {
		throw new Error(`Unknown profile "${input.to}"`);
	}

	ensureDir(runeDir(cwd));
	const links = listLinks(cwd);
	const link: Link = {
		id: crypto.randomUUID(),
		from: input.from,
		to: input.to,
		label: input.label?.trim() || undefined,
	};
	links.push(link);
	writeFileSync(linksPath(cwd), `${JSON.stringify(links, null, 2)}\n`, "utf-8");
	return link;
}
