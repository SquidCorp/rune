import { startServer } from "@rune/api";
import { RuneClient } from "@rune/sdk";

function printHelp(): void {
	console.log(`rune — Rune CLI

Usage:
  rune serve [--port <n>] [--host <addr>]
  rune profile list
  rune profile create <id> [--name <name>] [--model <provider/id>]
  rune link list
  rune link create <from> <to> [--label <text>]
  rune health
  rune help
`);
}

function getFlag(args: string[], name: string): string | undefined {
	const idx = args.indexOf(name);
	if (idx === -1) return undefined;
	return args[idx + 1];
}

function clientFromArgs(args: string[]): RuneClient {
	const baseUrl =
		getFlag(args, "--url") ?? process.env.RUNE_URL ?? "http://127.0.0.1:8787";
	return new RuneClient({ baseUrl });
}

async function cmdServe(argv: string[]): Promise<void> {
	const port = Number(getFlag(argv, "--port") ?? process.env.PORT ?? 8787);
	const hostname = getFlag(argv, "--host") ?? process.env.HOST ?? "127.0.0.1";
	const { url } = startServer({ port, hostname, cwd: process.cwd() });
	console.log(`Rune API listening on ${url}`);
	console.log(`Data root: ${process.cwd()}/.rune`);
	await new Promise(() => {});
}

async function cmdHealth(client: RuneClient): Promise<void> {
	const health = await client.health();
	console.log(JSON.stringify(health, null, 2));
}

async function cmdProfileList(client: RuneClient): Promise<void> {
	const profiles = await client.listProfiles();
	if (profiles.length === 0) {
		console.log("No profiles yet.");
		return;
	}
	for (const profile of profiles) {
		console.log(`${profile.id}\t${profile.displayName}`);
	}
}

async function cmdProfileCreate(
	client: RuneClient,
	rest: string[],
): Promise<void> {
	const id = rest[0];
	if (!id) {
		throw new Error(
			"Usage: rune profile create <id> [--name <name>] [--model <provider/id>]",
		);
	}
	const profile = await client.createProfile({
		id,
		name: getFlag(rest, "--name"),
		model: getFlag(rest, "--model"),
	});
	console.log(`Created profile ${profile.id}`);
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

async function cmdProfile(
	client: RuneClient,
	sub: string | undefined,
	rest: string[],
): Promise<void> {
	if (sub === "list") {
		await cmdProfileList(client);
		return;
	}
	if (sub === "create") {
		await cmdProfileCreate(client, rest);
		return;
	}
	printHelp();
	throw new Error(`Unknown profile command: ${sub ?? "(none)"}`);
}

async function cmdLink(
	client: RuneClient,
	sub: string | undefined,
	rest: string[],
): Promise<void> {
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

export async function runCli(argv: string[]): Promise<void> {
	const [cmd, sub, ...rest] = argv;

	if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
		printHelp();
		return;
	}

	if (cmd === "serve") {
		await cmdServe(argv);
		return;
	}

	const client = clientFromArgs(argv);

	if (cmd === "health") {
		await cmdHealth(client);
		return;
	}
	if (cmd === "profile") {
		await cmdProfile(client, sub, rest);
		return;
	}
	if (cmd === "link") {
		await cmdLink(client, sub, rest);
		return;
	}

	printHelp();
	throw new Error(`Unknown command: ${argv.join(" ")}`);
}
