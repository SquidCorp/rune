import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { startServer } from "../packages/api/src/index.ts";
import { runCli } from "../packages/cli/src/index.ts";

export type ScopeFlag = undefined | "user" | "project";

/** Always writes harness progress; never captured by CLI stdout mute. */
const out = console.log.bind(console);

export function scopeArgs(flag: ScopeFlag): string[] {
	return flag === undefined ? [] : ["--scope", flag];
}

export function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

export interface ProfileCliFixture {
	url: string;
	cwd: string;
	userDir: string;
	rune: (args: string[]) => Promise<string>;
	userProfileJson: (id: string) => string;
	projectProfileJson: (id: string) => string;
}

interface StartedServer {
	url: string;
	port: number;
	stop: () => void;
}

interface ScopePaths {
	extra: string[];
	expectedJson: string;
	otherJson: string;
	otherListArgs: string[];
	scopeLabel: string;
	writesUser: boolean;
}

function restoreEnv(
	key: "RUNE_HOME" | "RUNE_CWD",
	original: string | undefined,
) {
	if (original === undefined) {
		delete process.env[key];
	} else {
		process.env[key] = original;
	}
}

function startApi(cwd: string): StartedServer {
	try {
		return startServer({ cwd, port: 0, hostname: "127.0.0.1" });
	} catch {
		return startServer({
			cwd,
			port: 18000 + (process.pid % 1000),
			hostname: "127.0.0.1",
		});
	}
}

function formatCmd(args: string[]): string {
	return `rune ${args.join(" ")}`;
}

function makeFixture(
	url: string,
	cwd: string,
	userDir: string,
): ProfileCliFixture {
	const fx: ProfileCliFixture = {
		url,
		cwd,
		userDir,
		userProfileJson: (id) =>
			join(resolve(userDir), "profiles", id, "profile.json"),
		projectProfileJson: (id) =>
			join(cwd, ".rune", "profiles", id, "profile.json"),
		rune: async (args) => {
			const full = [...args, "--url", fx.url];
			out(`  $ ${formatCmd(full)}`);
			const lines: string[] = [];
			const originalLog = console.log;
			console.log = (...logArgs: unknown[]) => {
				lines.push(logArgs.map(String).join(" "));
			};
			try {
				await runCli(full);
				const stdout = lines.join("\n");
				if (stdout.length === 0) {
					out("    (no stdout)");
				} else {
					for (const line of stdout.split("\n")) {
						out(`    › ${line}`);
					}
				}
				return stdout;
			} finally {
				console.log = originalLog;
			}
		},
	};
	return fx;
}

export async function withProfileCliFixture(
	run: (fx: ProfileCliFixture) => Promise<void>,
): Promise<void> {
	const userDir = mkdtempSync(join(tmpdir(), "rune-profile-cli-user-"));
	const cwd = mkdtempSync(join(tmpdir(), "rune-profile-cli-cwd-"));
	const originalRuneHome = process.env.RUNE_HOME;
	const originalRuneCwd = process.env.RUNE_CWD;

	process.env.RUNE_HOME = userDir;
	delete process.env.RUNE_CWD;

	let started: StartedServer | undefined;
	try {
		started = startApi(cwd);
		out("fixture:");
		out(`  RUNE_HOME  ${userDir}`);
		out(`  cwd        ${cwd}`);
		out(`  api        ${started.url}`);
		out(`  RUNE_CWD   (unset)`);
		await run(makeFixture(started.url, cwd, userDir));
	} finally {
		started?.stop();
		restoreEnv("RUNE_HOME", originalRuneHome);
		restoreEnv("RUNE_CWD", originalRuneCwd);
		rmSync(userDir, { recursive: true, force: true });
		rmSync(cwd, { recursive: true, force: true });
		out("teardown: stopped api, removed temp dirs");
	}
}

function pass(detail: string): void {
	out(`  ✓ ${detail}`);
}

async function assertCreateAndList(
	fx: ProfileCliFixture,
	paths: ScopePaths,
): Promise<void> {
	out("");
	out("Given a temp RUNE_HOME and project cwd and a listening API");
	out(
		`When I run \`profile create alpha --name Alpha\` (scope ${paths.scopeLabel})`,
	);
	const created = await fx.rune([
		"profile",
		"create",
		"alpha",
		"--name",
		"Alpha",
		...paths.extra,
	]);
	out("Then stdout matches /Created profile .+alpha/");
	assert(
		/Created profile .+alpha/.test(created),
		`expected create stdout to match Created profile .+alpha, got: ${created}`,
	);
	pass(`create stdout: ${JSON.stringify(created)}`);

	out("And expected profile.json exists; other root does not");
	assert(
		existsSync(paths.expectedJson),
		`expected profile.json at ${paths.expectedJson}`,
	);
	assert(
		!existsSync(paths.otherJson),
		`did not expect profile.json at ${paths.otherJson}`,
	);
	pass(`wrote ${paths.expectedJson}`);
	pass(`absent ${paths.otherJson}`);

	out(`When I run \`profile list\` (scope ${paths.scopeLabel})`);
	const listed = await fx.rune(["profile", "list", ...paths.extra]);
	out("Then stdout contains alpha and Alpha");
	assert(listed.includes("alpha"), `list missing alpha: ${listed}`);
	assert(listed.includes("Alpha"), `list missing Alpha: ${listed}`);
	pass("list shows alpha / Alpha");

	const otherLabel = paths.writesUser ? "project" : "omitted→user";
	out(`When I run \`profile list\` for the other scope (${otherLabel})`);
	const otherListed = await fx.rune([
		"profile",
		"list",
		...paths.otherListArgs,
	]);
	out("Then stdout is `No profiles yet.`");
	assert(
		otherListed === "No profiles yet.",
		`other scope list expected empty, got: ${otherListed}`,
	);
	pass(`other scope empty (${otherLabel})`);
}

async function assertShow(
	fx: ProfileCliFixture,
	paths: ScopePaths,
): Promise<void> {
	out("");
	out(`When I run \`profile show alpha\` (scope ${paths.scopeLabel})`);
	const shown = await fx.rune(["profile", "show", "alpha", ...paths.extra]);
	const expectedDir = dirname(paths.expectedJson);
	out("Then stdout contains name\\tAlpha and dir\\t<profile dir>");
	assert(shown.includes("name\tAlpha"), `show missing name\\tAlpha: ${shown}`);
	assert(
		shown.includes(`dir\t${expectedDir}`),
		`show missing dir\\t${expectedDir}: ${shown}`,
	);
	pass(`show name=Alpha dir=${expectedDir}`);
}

async function assertSet(
	fx: ProfileCliFixture,
	paths: ScopePaths,
): Promise<void> {
	out("");
	out(
		`When I run \`profile set alpha --name Beta\` (scope ${paths.scopeLabel})`,
	);
	const updated = await fx.rune([
		"profile",
		"set",
		"alpha",
		"--name",
		"Beta",
		...paths.extra,
	]);
	out("Then stdout is `Updated profile alpha` and show contains name\\tBeta");
	assert(
		updated === "Updated profile alpha",
		`expected Updated profile alpha, got: ${updated}`,
	);
	pass("set stdout Updated profile alpha");
	const shownAfterSet = await fx.rune([
		"profile",
		"show",
		"alpha",
		...paths.extra,
	]);
	assert(
		shownAfterSet.includes("name\tBeta"),
		`show after set missing name\\tBeta: ${shownAfterSet}`,
	);
	pass("show after set name=Beta");
}

async function assertDelete(
	fx: ProfileCliFixture,
	paths: ScopePaths,
): Promise<void> {
	out("");
	out(
		`When I run \`profile delete alpha\` (scope ${paths.scopeLabel}, no --force)`,
	);
	const deleted = await fx.rune(["profile", "delete", "alpha", ...paths.extra]);
	out(
		"Then stdout is `Deleted profile alpha`, list is empty, both alpha dirs gone",
	);
	assert(
		deleted === "Deleted profile alpha",
		`expected Deleted profile alpha, got: ${deleted}`,
	);
	pass("delete stdout Deleted profile alpha");
	const listedAfterDelete = await fx.rune(["profile", "list", ...paths.extra]);
	assert(
		listedAfterDelete === "No profiles yet.",
		`list after delete expected empty, got: ${listedAfterDelete}`,
	);
	pass("list after delete empty");
	assert(
		!existsSync(dirname(paths.expectedJson)),
		`expected alpha dir removed at ${dirname(paths.expectedJson)}`,
	);
	assert(
		!existsSync(dirname(paths.otherJson)),
		`expected other alpha dir absent at ${dirname(paths.otherJson)}`,
	);
	pass(`removed ${dirname(paths.expectedJson)}`);
	pass(`absent ${dirname(paths.otherJson)}`);
}

export async function runProfileScopeScript(flag: ScopeFlag): Promise<void> {
	const scopeLabel =
		flag === undefined ? "omitted→user" : flag === "user" ? "user" : "project";
	out(`=== profile scope: ${scopeLabel} ===`);

	await withProfileCliFixture(async (fx) => {
		const writesUser = flag !== "project";
		const paths: ScopePaths = {
			extra: scopeArgs(flag),
			expectedJson: writesUser
				? fx.userProfileJson("alpha")
				: fx.projectProfileJson("alpha"),
			otherJson: writesUser
				? fx.projectProfileJson("alpha")
				: fx.userProfileJson("alpha"),
			otherListArgs: writesUser ? ["--scope", "project"] : [],
			scopeLabel,
			writesUser,
		};

		out(
			`target root: ${writesUser ? "user ($RUNE_HOME/profiles)" : "project (<cwd>/.rune/profiles)"}`,
		);
		out(`expected json: ${paths.expectedJson}`);
		out(`other json:    ${paths.otherJson}`);
		out(
			`scope args:    ${paths.extra.length ? paths.extra.join(" ") : "(none)"}`,
		);

		await assertCreateAndList(fx, paths);
		await assertShow(fx, paths);
		await assertSet(fx, paths);
		await assertDelete(fx, paths);
	});

	out(`=== pass: profile scope ${scopeLabel} ===`);
}
