import type { Profile } from "@rune/sdk";

export interface ProfileTableProps {
	profiles: Profile[];
	usedBy: Record<string, string[]>;
	selectedId: string | null;
	onDelete: (profile: Profile) => void;
}

function ProfileRow({
	profile,
	usedBy,
	selectedId,
	onDelete,
}: {
	profile: Profile;
	usedBy: Record<string, string[]>;
	selectedId: string | null;
	onDelete: (profile: Profile) => void;
}) {
	const graphs = usedBy[profile.id];
	const usedLabel = graphs?.length ? graphs.join(", ") : "—";
	const glyph = profile.meta.glyph ?? profile.id.charAt(0);
	const selected = profile.id === selectedId;
	const systemClass = profile.hasSystemPrompt
		? "profile-col-system profile-system profile-system-yes"
		: "profile-col-system profile-system profile-system-none";

	return (
		<div
			className={
				selected
					? "profile-table-row profile-table-row-selected"
					: "profile-table-row"
			}
		>
			<div className="profile-col-glyph">
				<div className="profile-glyph">{glyph}</div>
			</div>
			<div className="profile-col-gutter" />
			<div className="profile-col-id profile-id">{profile.id}</div>
			<div className="profile-col-name profile-name">{profile.displayName}</div>
			<div className="profile-col-model profile-model">
				{profile.meta.model ?? "—"}
			</div>
			<div className="profile-col-think profile-think">
				{profile.meta.thinkingLevel ?? "—"}
			</div>
			<div className={systemClass}>
				{profile.hasSystemPrompt ? "SYSTEM.md" : "default"}
			</div>
			<div className="profile-col-used profile-used">{usedLabel}</div>
			<div className="profile-col-actions">
				<button
					type="button"
					disabled
					className="profile-action profile-action-edit"
				>
					Edit
				</button>
				<button
					type="button"
					className="profile-action profile-action-delete"
					aria-label={`Delete ${profile.id}`}
					onClick={() => onDelete(profile)}
				>
					Delete
				</button>
			</div>
		</div>
	);
}

export function ProfileTable({
	profiles,
	usedBy,
	selectedId,
	onDelete,
}: ProfileTableProps) {
	return (
		<div className="profile-table">
			<div className="profile-table-header">
				<div className="profile-col-glyph" />
				<div className="profile-col-gutter" />
				<div className="profile-col-id profile-th">Id</div>
				<div className="profile-col-name profile-th">Name</div>
				<div className="profile-col-model profile-th">Model</div>
				<div className="profile-col-think profile-th">Think</div>
				<div className="profile-col-system profile-th">System</div>
				<div className="profile-col-used profile-th">Used by</div>
				<div className="profile-col-actions" />
			</div>
			{profiles.map((profile) => (
				<ProfileRow
					key={profile.id}
					profile={profile}
					usedBy={usedBy}
					selectedId={selectedId}
					onDelete={onDelete}
				/>
			))}
		</div>
	);
}
