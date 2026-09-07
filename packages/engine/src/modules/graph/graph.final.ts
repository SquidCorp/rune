/**
 * Final assistant text for a graph node = last assistant message's text parts only.
 * Tool calls / traces are ignored — chain inheritance uses this string alone.
 */
export function getFinalAssistantText(messages: readonly unknown[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (!isAssistantMessage(msg)) continue;
		const texts: string[] = [];
		for (const part of msg.content) {
			if (isTextPart(part)) texts.push(part.text);
		}
		if (texts.length > 0) return texts.join("");
	}
	return "";
}

function isAssistantMessage(
	msg: unknown,
): msg is { role: "assistant"; content: unknown[] } {
	if (msg === null || typeof msg !== "object") return false;
	const row = msg as { role?: unknown; content?: unknown };
	return row.role === "assistant" && Array.isArray(row.content);
}

function isTextPart(part: unknown): part is { type: "text"; text: string } {
	if (part === null || typeof part !== "object") return false;
	const row = part as { type?: unknown; text?: unknown };
	return row.type === "text" && typeof row.text === "string";
}
