import type { GraphSessionDiagEvent } from "@rune/sdk";

/** Max chars kept per user/assistant diag text. */
export const DIAG_TEXT_MAX = 300;

export function truncateDiagText(
	text: string,
	max: number = DIAG_TEXT_MAX,
): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}…`;
}

type TextPart = { type: "text"; text: string };
type RoleMessage = { role: "user" | "assistant"; content: unknown };

function isTextPart(part: unknown): part is TextPart {
	if (part === null || typeof part !== "object") return false;
	const row = part as { type?: unknown; text?: unknown };
	return row.type === "text" && typeof row.text === "string";
}

function isUserOrAssistantMessage(message: unknown): message is RoleMessage {
	if (message === null || typeof message !== "object") return false;
	const row = message as { role?: unknown; content?: unknown };
	return row.role === "user" || row.role === "assistant";
}

function messageText(message: RoleMessage): string {
	if (typeof message.content === "string") return message.content;
	if (!Array.isArray(message.content)) return "";
	const parts: string[] = [];
	for (const part of message.content) {
		if (isTextPart(part)) parts.push(part.text);
	}
	return parts.join("");
}

function diagFromMessageEnd(
	message: unknown,
): GraphSessionDiagEvent | undefined {
	if (!isUserOrAssistantMessage(message)) return undefined;
	return {
		type: message.role,
		text: truncateDiagText(messageText(message)),
	};
}

function diagFromToolEnd(event: {
	toolName?: unknown;
	isError?: unknown;
}): GraphSessionDiagEvent {
	const name =
		typeof event.toolName === "string" && event.toolName.length > 0
			? event.toolName
			: "unknown";
	return {
		type: "tool",
		name,
		ok: event.isError !== true,
	};
}

/**
 * Map a pi AgentSessionEvent to a sparse diag event.
 * Keeps message_end (user/assistant) and tool_execution_end only.
 */
export function sessionEventToDiag(
	event: unknown,
): GraphSessionDiagEvent | undefined {
	if (event === null || typeof event !== "object") return undefined;
	const row = event as {
		type?: unknown;
		message?: unknown;
		toolName?: unknown;
		isError?: unknown;
	};
	if (row.type === "message_end") return diagFromMessageEnd(row.message);
	if (row.type === "tool_execution_end") return diagFromToolEnd(row);
	return undefined;
}
