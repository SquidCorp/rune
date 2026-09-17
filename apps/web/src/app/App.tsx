import {
	type Graph,
	type HealthResponse,
	type Profile,
	RuneClient,
	type RuneScope,
} from "@rune/sdk";
import { useEffect, useState } from "react";

import type { ProfileViewState } from "@/modules/profile";
import { ProfileDeleteDialog, ProfileSection } from "@/modules/profile";
import { ShellFooter, ShellHeader } from "@/modules/shell";

const client = new RuneClient({
	baseUrl: "/api",
	fetch: (input, init) => globalThis.fetch(input, init),
});

interface PanelSnapshot {
	health: HealthResponse | null;
	profiles: Profile[];
	graphs: Graph[];
	graphsError: boolean;
	panelError: string | null;
}

interface PanelSetters {
	setHealth: (value: HealthResponse | null) => void;
	setProfiles: (value: Profile[]) => void;
	setGraphs: (value: Graph[]) => void;
	setGraphsError: (value: boolean) => void;
	setPanelError: (value: string | null) => void;
	setLoading: (value: boolean) => void;
}

async function loadPanel(nextScope: RuneScope): Promise<PanelSnapshot> {
	let health: HealthResponse;
	try {
		health = await client.health();
	} catch (err) {
		return {
			health: null,
			profiles: [],
			graphs: [],
			graphsError: true,
			panelError: err instanceof Error ? err.message : "Failed to reach API",
		};
	}

	let profiles: Profile[] = [];
	let panelError: string | null = null;
	try {
		profiles = await client.listProfiles({ scope: nextScope });
	} catch (err) {
		panelError = err instanceof Error ? err.message : "Failed to list profiles";
	}

	let graphs: Graph[] = [];
	let graphsError = false;
	try {
		graphs = await client.listGraphs();
	} catch {
		graphsError = true;
	}

	return { health, profiles, graphs, graphsError, panelError };
}

function usedByMap(
	graphs: Graph[],
	scope: RuneScope,
): Record<string, string[]> {
	if (scope !== "project") return {};
	const map: Record<string, string[]> = {};
	for (const graph of graphs) {
		for (const node of graph.nodes) {
			const ids = map[node.profile] ?? [];
			if (!ids.includes(graph.id)) ids.push(graph.id);
			map[node.profile] = ids;
		}
	}
	return map;
}

function viewStateFromPanel(panel: {
	loading: boolean;
	panelError: string | null;
	profiles: Profile[];
	graphs: Graph[];
	scope: RuneScope;
}): ProfileViewState {
	if (panel.loading) return { kind: "loading" };
	if (panel.panelError) return { kind: "error", message: panel.panelError };
	if (panel.profiles.length === 0) return { kind: "empty" };
	return {
		kind: "list",
		profiles: panel.profiles,
		usedBy: usedByMap(panel.graphs, panel.scope),
	};
}

function applySnapshot(snapshot: PanelSnapshot, set: PanelSetters): void {
	set.setHealth(snapshot.health);
	set.setProfiles(snapshot.profiles);
	set.setGraphs(snapshot.graphs);
	set.setGraphsError(snapshot.graphsError);
	set.setPanelError(snapshot.panelError);
	set.setLoading(false);
}

function deleteErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : "Failed to delete profile";
}

async function confirmProfileDelete(args: {
	pending: Profile | null;
	deleteBusy: boolean;
	forceRequired: boolean;
	graphs: Graph[];
	scope: RuneScope;
	set: PanelSetters;
	setPending: (value: Profile | null) => void;
	setDeleteError: (value: string | null) => void;
	setDeleteBusy: (value: boolean) => void;
	setForceRequired: (value: boolean) => void;
}): Promise<void> {
	const { pending, deleteBusy, forceRequired, graphs, scope, set } = args;
	if (!pending || deleteBusy) return;
	const graphIds = usedByMap(graphs, scope)[pending.id] ?? [];
	const force = forceRequired || graphIds.length > 0;
	args.setDeleteBusy(true);
	args.setDeleteError(null);
	try {
		await client.deleteProfile(pending.id, {
			scope,
			force: force ? true : undefined,
		});
		args.setPending(null);
		args.setDeleteError(null);
		args.setForceRequired(false);
		args.setDeleteBusy(false);
		applySnapshot(await loadPanel(scope), set);
	} catch (err) {
		args.setDeleteBusy(false);
		const message = deleteErrorMessage(err);
		args.setDeleteError(message);
		if (!force && message.includes("pass force to delete")) {
			args.setForceRequired(true);
		}
	}
}

function useDeleteDialog(graphs: Graph[], scope: RuneScope, set: PanelSetters) {
	const [pending, setPending] = useState<Profile | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [deleteBusy, setDeleteBusy] = useState(false);
	const [forceRequired, setForceRequired] = useState(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on scope change
	useEffect(() => {
		setPending(null);
		setDeleteError(null);
		setForceRequired(false);
	}, [scope]);

	return {
		pending,
		deleteError,
		deleteBusy,
		forceRequired,
		openDelete: (profile: Profile) => {
			setPending(profile);
			setDeleteError(null);
			setForceRequired(false);
			setDeleteBusy(false);
		},
		cancelDelete: () => {
			if (deleteBusy) return;
			setPending(null);
			setDeleteError(null);
			setForceRequired(false);
		},
		confirmDelete: () =>
			confirmProfileDelete({
				pending,
				deleteBusy,
				forceRequired,
				graphs,
				scope,
				set,
				setPending,
				setDeleteError,
				setDeleteBusy,
				setForceRequired,
			}),
	};
}

interface AppChromeProps {
	scope: RuneScope;
	healthOk: boolean;
	healthLabel: string;
	profileCount: number | null;
	pipelineCount: number | null;
	viewState: ProfileViewState;
	graphs: Graph[];
	pending: Profile | null;
	forceRequired: boolean;
	deleteError: string | null;
	deleteBusy: boolean;
	openDelete: (profile: Profile) => void;
	cancelDelete: () => void;
	confirmDelete: () => void;
	onToggleScope: () => void;
}

function AppChrome(props: AppChromeProps) {
	const graphIds = props.pending
		? (usedByMap(props.graphs, props.scope)[props.pending.id] ?? [])
		: [];

	return (
		<div className="shell">
			<ShellHeader
				scope={props.scope}
				healthOk={props.healthOk}
				healthLabel={props.healthLabel}
				profileCount={props.profileCount}
			/>
			<ProfileSection
				state={props.viewState}
				scope={props.scope}
				selectedId={props.pending?.id ?? null}
				onDelete={props.openDelete}
			/>
			<ShellFooter
				profileCount={props.profileCount}
				pipelineCount={props.pipelineCount}
				scope={props.scope}
				onToggleScope={props.onToggleScope}
				enginesOk={props.healthOk}
			/>
			{props.pending ? (
				<ProfileDeleteDialog
					profileId={props.pending.id}
					graphIds={graphIds}
					forceRequired={props.forceRequired}
					error={props.deleteError}
					busy={props.deleteBusy}
					onCancel={props.cancelDelete}
					onConfirm={props.confirmDelete}
				/>
			) : null}
		</div>
	);
}

function usePanel() {
	const [scope, setScope] = useState<RuneScope>("project");
	const [health, setHealth] = useState<HealthResponse | null>(null);
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [graphs, setGraphs] = useState<Graph[]>([]);
	const [graphsError, setGraphsError] = useState(false);
	const [panelError, setPanelError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		setPanelError(null);
		setProfiles([]);
		void loadPanel(scope).then((snapshot) =>
			applySnapshot(snapshot, {
				setHealth,
				setProfiles,
				setGraphs,
				setGraphsError,
				setPanelError,
				setLoading,
			}),
		);
	}, [scope]);

	return {
		scope,
		setScope,
		health,
		profiles,
		graphs,
		graphsError,
		panelError,
		loading,
		set: {
			setHealth,
			setProfiles,
			setGraphs,
			setGraphsError,
			setPanelError,
			setLoading,
		},
	};
}

export function App() {
	const panel = usePanel();
	const dialog = useDeleteDialog(panel.graphs, panel.scope, panel.set);
	const healthOk = panel.health !== null;
	return (
		<AppChrome
			scope={panel.scope}
			healthOk={healthOk}
			healthLabel={
				healthOk
					? `${panel.health.service} v${panel.health.version} · ${panel.scope}`
					: "api offline"
			}
			profileCount={
				panel.loading || panel.panelError ? null : panel.profiles.length
			}
			pipelineCount={
				panel.graphsError || panel.loading ? null : panel.graphs.length
			}
			viewState={viewStateFromPanel({
				loading: panel.loading,
				panelError: panel.panelError,
				profiles: panel.profiles,
				graphs: panel.graphs,
				scope: panel.scope,
			})}
			graphs={panel.graphs}
			pending={dialog.pending}
			forceRequired={dialog.forceRequired}
			deleteError={dialog.deleteError}
			deleteBusy={dialog.deleteBusy}
			openDelete={dialog.openDelete}
			cancelDelete={dialog.cancelDelete}
			confirmDelete={() => void dialog.confirmDelete()}
			onToggleScope={() =>
				panel.setScope((current) =>
					current === "project" ? "user" : "project",
				)
			}
		/>
	);
}
