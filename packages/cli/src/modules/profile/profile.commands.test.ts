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
			return fakeProfile("x");
		},
		async updateProfile(
			_id: string,
			_input: UpdateProfileInput,
			_options?: { scope?: RuneScope },
		) {
			return fakeProfile("x");
		},
		async deleteProfile() {},
	} as unknown as RuneClient;
}

async function withCapturedStdout(fn: () => Promise<void>): Promise<string> {
	const originalWrite = process.stdout.write.bind(process.stdout);
	let stdout = "";
	process.stdout.write = ((chunk: string | Uint8Array) => {
		stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
		return true;
	}) as typeof process.stdout.write;
	try {
		await fn();
		return stdout;
	} finally {
		process.stdout.write = originalWrite;
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
