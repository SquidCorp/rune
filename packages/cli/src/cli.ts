import { RuneClient } from "@rune/sdk";

import { runGraphCommand } from "./modules/graph/index.ts";
import { runHealthCommand } from "./modules/health/index.ts";
import { runLinkCommand } from "./modules/link/index.ts";
import { runProfileCommand } from "./modules/profile/index.ts";
import { runServeCommand } from "./modules/serve/index.ts";

function printHelp(): void {
	console.log(`rune — Rune CLI

Usage:
  rune serve [--port <n>] [--host <addr>]
  rune profile list
  rune profile show <id>
  rune profile create <id> [--name <name>] [--model <provider/id>] [--thinking-level <level>] [--prompt <string>] [--prompt-file <path>]
  rune profile set <id> [--name <name>] [--model <provider/id>] [--thinking-level <level>] [--prompt <string>] [--prompt-file <path>]
  rune profile delete <id> [--force]
  rune link list
  rune link create <from> <to> [--label <text>]
  rune graph list
  rune graph show <graph-id>
  rune graph check <graph-id>
  rune graph run <graph-id> --prompt <string> | --prompt-file <path> [--log <path>] [--verbose]
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

export async function runCli(argv: string[]): Promise<void> {
	const [cmd, sub, ...rest] = argv;

	if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
		printHelp();
		return;
	}

	if (cmd === "serve") {
		await runServeCommand(argv);
		return;
	}

	const client = clientFromArgs(argv);

	if (cmd === "health") {
		await runHealthCommand(client);
		return;
	}
	if (cmd === "profile") {
		await runProfileCommand({ client, sub, rest, printHelp });
		return;
	}
	if (cmd === "link") {
		await runLinkCommand({ client, sub, rest, printHelp });
		return;
	}
	if (cmd === "graph") {
		await runGraphCommand({ client, sub, rest, printHelp });
		return;
	}

	printHelp();
	throw new Error(`Unknown command: ${argv.join(" ")}`);
}
