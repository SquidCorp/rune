import type { RuneClient } from "@rune/sdk";

export async function runHealthCommand(client: RuneClient): Promise<void> {
	const health = await client.health();
	console.log(JSON.stringify(health, null, 2));
}
