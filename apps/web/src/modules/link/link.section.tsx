import type { Link, RuneClient } from "@rune/sdk";
import { useState } from "react";

export interface LinkSectionProps {
	client: RuneClient;
	links: Link[];
	onError: (message: string | null) => void;
	onRefresh: () => Promise<void>;
}

export function LinkSection({
	client,
	links,
	onError,
	onRefresh,
}: LinkSectionProps) {
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");

	async function onCreateLink(event: React.FormEvent) {
		event.preventDefault();
		try {
			await client.createLink({ from: from.trim(), to: to.trim() });
			setFrom("");
			setTo("");
			await onRefresh();
		} catch (err) {
			onError(err instanceof Error ? err.message : "Create link failed");
		}
	}

	return (
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
	);
}
