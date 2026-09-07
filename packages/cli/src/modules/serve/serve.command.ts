import { startServer } from "@rune/api";

function getFlag(args: string[], name: string): string | undefined {
	const idx = args.indexOf(name);
	if (idx === -1) return undefined;
	return args[idx + 1];
}

export async function runServeCommand(argv: string[]): Promise<void> {
	const port = Number(getFlag(argv, "--port") ?? process.env.PORT ?? 8787);
	const hostname = getFlag(argv, "--host") ?? process.env.HOST ?? "127.0.0.1";
	const { url, dataRoot } = startServer({ port, hostname });
	console.log(`Rune API listening on ${url}`);
	console.log(`Data root: ${dataRoot}`);
	const { promise } = Promise.withResolvers<void>();
	await promise;
}
