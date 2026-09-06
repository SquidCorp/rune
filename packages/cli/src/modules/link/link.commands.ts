import type { RuneClient } from "@rune/sdk";

function getFlag(args: string[], name: string): string | undefined {
	const idx = args.indexOf(name);
	if (idx === -1) return undefined;
	return args[idx + 1];
}

async function cmdLinkList(client: RuneClient): Promise<void> {
	const links = await client.listLinks();
	if (links.length === 0) {
		console.log("No links yet.");
		return;
	}
	for (const link of links) {
		const label = link.label ? ` (${link.label})` : "";
		console.log(`${link.from} -> ${link.to}${label}`);
	}
}

async function cmdLinkCreate(
	client: RuneClient,
	rest: string[],
): Promise<void> {
	const from = rest[0];
	const to = rest[1];
	if (!from || !to) {
		throw new Error("Usage: rune link create <from> <to> [--label <text>]");
	}
	const link = await client.createLink({
		from,
		to,
		label: getFlag(rest, "--label"),
	});
	console.log(`Linked ${link.from} -> ${link.to}`);
}

export async function runLinkCommand(options: {
	client: RuneClient;
	sub: string | undefined;
	rest: string[];
	printHelp: () => void;
}): Promise<void> {
	const { client, sub, rest, printHelp } = options;
	if (sub === "list") {
		await cmdLinkList(client);
		return;
	}
	if (sub === "create") {
		await cmdLinkCreate(client, rest);
		return;
	}
	printHelp();
	throw new Error(`Unknown link command: ${sub ?? "(none)"}`);
}
