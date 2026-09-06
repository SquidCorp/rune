import type { Profile, RuneClient } from "@rune/sdk";
import { useState } from "react";

export interface ProfileSectionProps {
	client: RuneClient;
	profiles: Profile[];
	onError: (message: string | null) => void;
	onRefresh: () => Promise<void>;
}

export function ProfileSection({
	client,
	profiles,
	onError,
	onRefresh,
}: ProfileSectionProps) {
	const [id, setId] = useState("");
	const [name, setName] = useState("");

	async function onCreateProfile(event: React.FormEvent) {
		event.preventDefault();
		try {
			await client.createProfile({
				id: id.trim(),
				name: name.trim() || undefined,
			});
			setId("");
			setName("");
			await onRefresh();
		} catch (err) {
			onError(err instanceof Error ? err.message : "Create profile failed");
		}
	}

	return (
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
	);
}
