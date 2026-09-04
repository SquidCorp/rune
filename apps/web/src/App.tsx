import { type Link, type Profile, RuneClient } from "@rune/sdk";
import { useCallback, useEffect, useState } from "react";

const client = new RuneClient({ baseUrl: "/api" });

export function App() {
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [links, setLinks] = useState<Link[]>([]);
	const [status, setStatus] = useState<string>("Connecting…");
	const [id, setId] = useState("");
	const [name, setName] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		try {
			const health = await client.health();
			setStatus(`${health.service} v${health.version}`);
			const [nextProfiles, nextLinks] = await Promise.all([
				client.listProfiles(),
				client.listLinks(),
			]);
			setProfiles(nextProfiles);
			setLinks(nextLinks);
			setError(null);
		} catch (err) {
			setStatus("API offline");
			setError(err instanceof Error ? err.message : "Failed to reach API");
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	async function onCreateProfile(event: React.FormEvent) {
		event.preventDefault();
		try {
			await client.createProfile({
				id: id.trim(),
				name: name.trim() || undefined,
			});
			setId("");
			setName("");
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Create profile failed");
		}
	}

	async function onCreateLink(event: React.FormEvent) {
		event.preventDefault();
		try {
			await client.createLink({ from: from.trim(), to: to.trim() });
			setFrom("");
			setTo("");
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Create link failed");
		}
	}

	return (
		<main className="page">
			<header>
				<h1>Rune</h1>
				<p className="muted">{status}</p>
			</header>

			{error ? <p className="error">{error}</p> : null}

			<section>
				<h2>Profiles</h2>
				<form className="row" onSubmit={onCreateProfile}>
					<input
						placeholder="id (e.g. researcher)"
						value={id}
						onChange={(e) => setId(e.target.value)}
						required
					/>
					<input
						placeholder="display name"
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
					<button type="submit">Create</button>
				</form>
				<ul>
					{profiles.length === 0 ? (
						<li className="muted">No profiles yet</li>
					) : null}
					{profiles.map((profile) => (
						<li key={profile.id}>
							<strong>{profile.id}</strong>
							{profile.displayName !== profile.id
								? ` — ${profile.displayName}`
								: ""}
						</li>
					))}
				</ul>
			</section>

			<section>
				<h2>Links</h2>
				<form className="row" onSubmit={onCreateLink}>
					<input
						placeholder="from profile id"
						value={from}
						onChange={(e) => setFrom(e.target.value)}
						required
					/>
					<input
						placeholder="to profile id"
						value={to}
						onChange={(e) => setTo(e.target.value)}
						required
					/>
					<button type="submit">Link</button>
				</form>
				<ul>
					{links.length === 0 ? <li className="muted">No links yet</li> : null}
					{links.map((link) => (
						<li key={link.id}>
							{link.from} → {link.to}
							{link.label ? ` (${link.label})` : ""}
						</li>
					))}
				</ul>
			</section>

			<section>
				<h2>Canvas</h2>
				<p className="muted">Live agentic flow canvas will land here later.</p>
			</section>
		</main>
	);
}
