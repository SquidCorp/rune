import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	InputEvent,
} from "@earendil-works/pi-coding-agent";

import {
	profilesRoot,
	profileDir as resolveProfileDir,
	userRuneDir,
} from "../paths/index.ts";
import {
	buildWhichProfileCriteria,
	classifyWhichProfile,
	readTypesafeApiKey,
} from "./profile-selector.http.ts";

const ACTIVE_STORE = Symbol.for("pi.profiles.activeId");
const PENDING_STORE = Symbol.for("rune.profileSelector.pendingMessage");
const RESERVED_DEFAULT = "default";

const MISSING_KEY_NOTIFY =
	"rune-profile-selector: missing typesafe key in auth.json";
const CLASSIFY_FAILED_NOTIFY = "rune-profile-selector: classification failed";
const SWITCH_CANCELLED_NOTIFY = "Profile switch cancelled";

type PendingMessage = {
	text: string;
	images?: InputEvent["images"];
};

type PendingContent =
	| string
	| Array<
			| { type: "text"; text: string }
			| NonNullable<PendingMessage["images"]>[number]
	  >;

type GlobalStore = typeof globalThis & {
	[ACTIVE_STORE]?: string;
	[PENDING_STORE]?: PendingMessage;
};

function isSafeProfileId(id: string): boolean {
	return (
		id.length > 0 &&
		id !== RESERVED_DEFAULT &&
		id !== "." &&
		id !== ".." &&
		!id.startsWith(".") &&
		!id.includes("/") &&
		!id.includes("\\")
	);
}

function getStoredId(): string | undefined {
	const value = (globalThis as GlobalStore)[ACTIVE_STORE];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function setStoredId(id: string): void {
	(globalThis as GlobalStore)[ACTIVE_STORE] = id;
}

function currentProfileId(): string {
	return getStoredId() ?? RESERVED_DEFAULT;
}

function takePending(): PendingMessage | undefined {
	const store = globalThis as GlobalStore;
	const pending = store[PENDING_STORE];
	delete store[PENDING_STORE];
	return pending;
}

function setPending(pending: PendingMessage): void {
	(globalThis as GlobalStore)[PENDING_STORE] = pending;
}

function conversationHasUserMessage(ctx: ExtensionContext): boolean {
	return ctx.sessionManager
		.getBranch()
		.some((entry) => entry.type === "message" && entry.message.role === "user");
}

function trimmedField(
	raw: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = raw[key];
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function readJsonObject(path: string): Record<string, unknown> | undefined {
	if (!existsSync(path)) return undefined;
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function listCandidateProfiles(): Array<{
	id: string;
	description?: string;
	name?: string;
}> {
	const root = profilesRoot();
	if (!existsSync(root)) return [];
	try {
		return readdirSync(root, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && isSafeProfileId(entry.name))
			.map((entry) => {
				const id = entry.name;
				const raw = readJsonObject(join(resolveProfileDir(id), "profile.json"));
				if (!raw) return { id };
				return {
					id,
					description: trimmedField(raw, "description"),
					name: trimmedField(raw, "name"),
				};
			});
	} catch {
		return [];
	}
}

function readAuthJson(): unknown {
	try {
		return JSON.parse(readFileSync(join(userRuneDir(), "auth.json"), "utf-8"));
	} catch {
		return undefined;
	}
}

function pendingContent(pending: PendingMessage): PendingContent {
	if (pending.images?.length) {
		return [{ type: "text", text: pending.text }, ...pending.images];
	}
	return pending.text;
}

function isKnownTarget(
	target: string,
	candidates: Array<{ id: string }>,
): boolean {
	if (target === RESERVED_DEFAULT) return true;
	return (
		isSafeProfileId(target) &&
		candidates.some((profile) => profile.id === target)
	);
}

function shouldSkipClassify(event: InputEvent, ctx: ExtensionContext): boolean {
	return (
		event.source === "extension" ||
		ctx.mode !== "tui" ||
		event.streamingBehavior !== undefined ||
		conversationHasUserMessage(ctx) ||
		!event.text.trim()
	);
}

async function handleRuneSelect(
	args: string,
	ctx: ExtensionCommandContext,
	pi: ExtensionAPI,
): Promise<void> {
	const target = args.trim();
	const candidates = listCandidateProfiles();
	if (!target || !isKnownTarget(target, candidates)) {
		ctx.ui.notify(CLASSIFY_FAILED_NOTIFY, "warning");
		return;
	}

	const pending = takePending();
	const previous = currentProfileId();
	setStoredId(target);
	const result = await ctx.newSession({
		withSession: async (newCtx) => {
			newCtx.ui.notify(`Profile: ${target}`, "info");
			if (pending) {
				await newCtx.sendUserMessage(pendingContent(pending));
			}
		},
	});
	if (result.cancelled) {
		setStoredId(previous);
		ctx.ui.notify(SWITCH_CANCELLED_NOTIFY, "warning");
		if (pending) {
			pi.sendUserMessage(pendingContent(pending));
		}
	}
}

async function handleInput(
	event: InputEvent,
	ctx: ExtensionContext,
	pi: ExtensionAPI,
): Promise<{ action: "continue" } | { action: "handled" }> {
	if (shouldSkipClassify(event, ctx)) return { action: "continue" };

	const candidates = listCandidateProfiles();
	if (candidates.length === 0) return { action: "continue" };

	const key = readTypesafeApiKey(readAuthJson());
	if (!key) {
		ctx.ui.notify(MISSING_KEY_NOTIFY, "warning");
		return { action: "continue" };
	}

	const classified = await classifyWhichProfile({
		userMessage: event.text,
		criteria: buildWhichProfileCriteria(candidates),
		apiKey: key,
	});
	if (!classified.ok || !isKnownTarget(classified.choice, candidates)) {
		ctx.ui.notify(CLASSIFY_FAILED_NOTIFY, "warning");
		return { action: "continue" };
	}

	const choice = classified.choice;
	if (choice === currentProfileId()) return { action: "continue" };

	setPending({ text: event.text, images: event.images });
	queueMicrotask(() => {
		pi.sendUserMessage(`/rune-select ${choice}`, {
			expandPromptTemplates: true,
		});
	});
	return { action: "handled" };
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("rune-select", {
		description: "Apply auto-selected profile",
		handler: async (args, ctx) => {
			await handleRuneSelect(args, ctx, pi);
		},
	});

	pi.on("input", async (event, ctx) => handleInput(event, ctx, pi));
}
