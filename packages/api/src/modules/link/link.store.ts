import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runeDir } from "@rune/engine";
import type { CreateLinkInput, Link } from "@rune/sdk";

import { getProfile } from "../profile/index.ts";

function ensureDir(path: string): void {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

function linksPath(cwd: string): string {
	return join(runeDir(cwd), "links.json");
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

export function listLinks(cwd: string = process.cwd()): Link[] {
	return readJson<Link[]>(linksPath(cwd), []);
}

export function replaceLinks(links: Link[], cwd: string = process.cwd()): void {
	ensureDir(runeDir(cwd));
	writeJson(linksPath(cwd), links);
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

	const links = listLinks(cwd);
	const link: Link = {
		id: crypto.randomUUID(),
		from: input.from,
		to: input.to,
		label: input.label?.trim() || undefined,
	};
	links.push(link);
	replaceLinks(links, cwd);
	return link;
}
