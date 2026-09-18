import { invokeInteractive } from "@rune/engine";

const INVOKE_USAGE = "Usage: rune invoke [--profile <id>]";

function flagValue(args: string[], name: string): string | undefined {
	const idx = args.indexOf(name);
	if (idx === -1) return undefined;
	const value = args[idx + 1];
	if (value === undefined || value.startsWith("--") || !value.trim()) {
		throw new Error(`${name} requires a value`);
	}
	return value;
}

function stripFlagPair(args: string[], name: string): string[] {
	const idx = args.indexOf(name);
	if (idx === -1) return args.slice();
	return [...args.slice(0, idx), ...args.slice(idx + 2)];
}

function parseInvokeArgs(args: string[]): {
	profile?: string;
	extraArgs: string[];
} {
	if (!args.includes("--profile")) {
		return { extraArgs: args.slice() };
	}
	const profile = flagValue(args, "--profile");
	if (!profile) throw new Error("--profile requires a value");
	const extraArgs = stripFlagPair(args, "--profile");
	if (profile === "default") return { extraArgs };
	return { profile, extraArgs };
}

function printInvokeHelp(): void {
	console.log(`rune invoke — interactive Pi session

${INVOKE_USAGE}

No --profile uses Default (~/.rune). --profile <id> overlays <cwd>/.rune/profiles/<id>.
--profile default is the same as omitting the flag. Extra args are forwarded to Pi.
Credentials live in ~/.rune/auth.json (or $RUNE_HOME/auth.json), not project .rune/.
Does not require rune serve.
`);
}

export async function runInvokeCommand(args: string[]): Promise<void> {
	if (args.includes("--help") || args.includes("-h")) {
		printInvokeHelp();
		return;
	}
	const parsed = parseInvokeArgs(args);
	await invokeInteractive(parsed);
}
