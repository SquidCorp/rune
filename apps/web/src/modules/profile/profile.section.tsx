import type { Profile, RuneScope } from "@rune/sdk";

import { ProfileEmpty } from "./ProfileEmpty.tsx";
import { ProfileTable } from "./ProfileTable.tsx";

export type ProfileViewState =
	| { kind: "loading" }
	| { kind: "error"; message: string }
	| { kind: "empty" }
	| { kind: "list"; profiles: Profile[]; usedBy: Record<string, string[]> };

export interface ProfileSectionProps {
	state: ProfileViewState;
	scope: RuneScope;
	selectedId: string | null;
	onDelete: (profile: Profile) => void;
	onCreate: () => void;
	onEdit: (profile: Profile) => void;
}

function panelBody({
	state,
	scope,
	selectedId,
	onDelete,
	onCreate,
	onEdit,
}: ProfileSectionProps) {
	switch (state.kind) {
		case "loading":
			return (
				<div className="profile-well">
					<p className="profile-empty-body">Loading profiles…</p>
				</div>
			);
		case "error":
			return (
				<div className="profile-well">
					<p className="profile-error">{state.message}</p>
				</div>
			);
		case "empty":
			return <ProfileEmpty scope={scope} onCreate={onCreate} />;
		case "list":
			return (
				<ProfileTable
					profiles={state.profiles}
					usedBy={state.usedBy}
					selectedId={selectedId}
					onDelete={onDelete}
					onEdit={onEdit}
				/>
			);
	}
}

export function ProfileSection(props: ProfileSectionProps) {
	return <main className="shell-main">{panelBody(props)}</main>;
}
