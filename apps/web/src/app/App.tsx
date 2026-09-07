import { type Profile, RuneClient } from "@rune/sdk";
import { useCallback, useEffect, useState } from "react";

import { CanvasPlaceholder } from "@/modules/canvas";
import { HealthStatus } from "@/modules/health";
import { ProfileSection } from "@/modules/profile";

const client = new RuneClient({ baseUrl: "/api" });

export function App() {
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [status, setStatus] = useState<string>("Connecting…");
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		try {
			const health = await client.health();
			setStatus(`${health.service} v${health.version}`);
			const nextProfiles = await client.listProfiles();
			setProfiles(nextProfiles);
			setError(null);
		} catch (err) {
			setStatus("API offline");
			setError(err instanceof Error ? err.message : "Failed to reach API");
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return (
		<main className="page">
			<header>
				<h1>Rune</h1>
				<HealthStatus status={status} />
			</header>

			{error ? <p className="error">{error}</p> : null}

			<ProfileSection
				client={client}
				profiles={profiles}
				onError={setError}
				onRefresh={refresh}
			/>

			<section className="panel">
				<h2>Workflow topology</h2>
				<p className="muted">
					Profile→profile links moved into graph edges (
					<code>.rune/graphs/*.toml</code> <code>[[edges]]</code>). Use{" "}
					<code>rune graph</code> to list, check, and run chains.
				</p>
			</section>

			<CanvasPlaceholder />
		</main>
	);
}
