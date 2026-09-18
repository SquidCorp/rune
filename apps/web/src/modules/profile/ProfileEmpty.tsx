import type { RuneScope } from "@rune/sdk";

import { NewProfileButton, RuneMark } from "@/modules/shell";

export interface ProfileEmptyProps {
	scope: RuneScope;
	onCreate: () => void;
}

export function ProfileEmpty({ scope, onCreate }: ProfileEmptyProps) {
	const body =
		scope === "project"
			? "Create the first agent for this project. Pipelines can only run project-scoped profiles."
			: "Create the first agent for this user. Graphs cannot see user profiles.";

	return (
		<div className="profile-well">
			<RuneMark />
			<h2 className="profile-empty-title">No profiles yet</h2>
			<p className="profile-empty-body">{body}</p>
			<div className="profile-empty-cta">
				<NewProfileButton onClick={onCreate} />
			</div>
		</div>
	);
}
