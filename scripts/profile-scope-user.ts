import { runProfileScopeScript } from "./profile-cli.harness.ts";

if (import.meta.main) {
	try {
		await runProfileScopeScript("user");
	} catch (err) {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	}
}
