import { describe, expect, test } from "bun:test";
import type {
	CreateProfileInput,
	Profile,
	RuneClient,
	RuneScope,
	UpdateProfileInput,
} from "@rune/sdk";

import { runProfileCommand } from "./profile.commands.ts";

function fakeProfile(id: string): Profile {
	return {
		id,
		displayName: id,
		meta: { glyph: "ᚠ" },
		hasSystemPrompt: false,
		paths: { dir: `/tmp/${id}` },
	};
}

function mockClient(record: {
	create?: { input: CreateProfileInput; options?: { scope?: RuneScope } };
	list?: { scope?: RuneScope };
	update?: {
		id: string;
		input: UpdateProfileInput;
		options?: { scope?: RuneScope };
	};
	profile?: Profile;
}): RuneClient {
	return {
		async createProfile(
			input: CreateProfileInput,
			options?: { scope?: RuneScope },
		) {
			record.create = { input, options };
			return fakeProfile(input.id);
		},
		async listProfiles(options?: { scope?: RuneScope }) {
			record.list = options;
			return [];
		},
		async getProfile() {
			return record.profile ?? fakeProfile("x");
		},
		async updateProfile(
			id: string,
			input: UpdateProfileInput,
			options?: { scope?: RuneScope },
		) {
			record.update = { id, input, options };
			return record.profile ?? fakeProfile(id);
		},
		async deleteProfile() {},
	} as unknown as RuneClient;
}

async function withCapturedStdout(fn: () => Promise<void>): Promise<string> {
	const originalWrite = process.stdout.write.bind(process.stdout);
	const originalLog = console.log;
	let stdout = "";
	process.stdout.write = ((chunk: string | Uint8Array) => {
		stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
		return true;
	}) as typeof process.stdout.write;
	console.log = (...args: unknown[]) => {
		stdout += `${args.map(String).join(" ")}\n`;
	};
	try {
		await fn();
		return stdout;
	} finally {
		process.stdout.write = originalWrite;
		console.log = originalLog;
	}
}

describe("rune profile --scope", () => {
	test("create defaults to user scope", async () => {
		const record: {
			create?: { input: CreateProfileInput; options?: { scope?: RuneScope } };
		} = {};
		const client = mockClient(record);

		await withCapturedStdout(async () => {
			await runProfileCommand({
				client,
				sub: "create",
				rest: ["x"],
				printHelp: () => {},
			});
		});

		expect(record.create?.input.id).toBe("x");
		expect(record.create?.options?.scope).toBe("user");
	});

	test("create passes project scope", async () => {
		const record: {
			create?: { input: CreateProfileInput; options?: { scope?: RuneScope } };
		} = {};
		const client = mockClient(record);

		await withCapturedStdout(async () => {
			await runProfileCommand({
				client,
				sub: "create",
				rest: ["x", "--scope", "project"],
				printHelp: () => {},
			});
		});

		expect(record.create?.options?.scope).toBe("project");
	});

	test("create rejects invalid scope", async () => {
		const client = mockClient({});

		await expect(
			runProfileCommand({
				client,
				sub: "create",
				rest: ["x", "--scope", "bogus"],
				printHelp: () => {},
			}),
		).rejects.toThrow(/Invalid scope/);
	});

	test("list passes project scope", async () => {
		const record: { list?: { scope?: RuneScope } } = {};
		const client = mockClient(record);

		await withCapturedStdout(async () => {
			await runProfileCommand({
				client,
				sub: "list",
				rest: ["--scope", "project"],
				printHelp: () => {},
			});
		});

		expect(record.list?.scope).toBe("project");
	});
});

describe("rune profile description", () => {
	test("create passes --description into createProfile", async () => {
		const record: {
			create?: { input: CreateProfileInput; options?: { scope?: RuneScope } };
		} = {};
		const client = mockClient(record);

		await withCapturedStdout(async () => {
			await runProfileCommand({
				client,
				sub: "create",
				rest: ["r", "--description", "Does research"],
				printHelp: () => {},
			});
		});

		expect(record.create?.input.description).toBe("Does research");
	});

	test("set passes --description into updateProfile", async () => {
		const record: {
			update?: {
				id: string;
				input: UpdateProfileInput;
				options?: { scope?: RuneScope };
			};
		} = {};
		const client = mockClient(record);

		await withCapturedStdout(async () => {
			await runProfileCommand({
				client,
				sub: "set",
				rest: ["r", "--description", "x"],
				printHelp: () => {},
			});
		});

		expect(record.update?.id).toBe("r");
		expect(record.update?.input.description).toBe("x");
	});

	test("show prints a description tab line when meta has it", async () => {
		const profile = fakeProfile("r");
		profile.meta.description = "Does research";
		const client = mockClient({ profile });

		const stdout = await withCapturedStdout(async () => {
			await runProfileCommand({
				client,
				sub: "show",
				rest: ["r"],
				printHelp: () => {},
			});
		});

		expect(stdout).toContain("description\tDoes research");
	});
});
