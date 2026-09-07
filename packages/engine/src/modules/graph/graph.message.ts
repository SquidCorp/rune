import type { GraphNode } from "@rune/sdk";

/**
 * Build the user message for one graph node.
 * `inherited` is the CLI prompt for the source node, else prior final assistant text.
 */
export function buildNodeUserMessage(
	node: Pick<GraphNode, "insert" | "append">,
	inherited: string,
): string {
	return `${node.insert ?? ""}${inherited}${node.append ?? ""}`;
}
