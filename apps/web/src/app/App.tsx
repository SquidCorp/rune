import {
	type CreateProfileInput,
	type Graph,
	type HealthResponse,
	type Profile,
	RuneClient,
	type RuneScope,
	type UpdateProfileInput,
} from "@rune/sdk";
import { useEffect, useState } from "react";

import {
	ProfileCreateDialog,
	ProfileDeleteDialog,
	ProfileEditDialog,
	ProfileSection,
	type ProfileViewState,
} from "@/modules/profile";
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
		forceRequired,
		error: deleteError,
		busy: deleteBusy,
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

async function submitProfileCreate(args: {
	input: CreateProfileInput;
	busy: boolean;
	scope: RuneScope;
	createScope: RuneScope;
	set: PanelSetters;
	setScope: (scope: RuneScope) => void;
	setOpen: (value: boolean) => void;
	setError: (value: string | null) => void;
	setBusy: (value: boolean) => void;
}): Promise<void> {
	if (args.busy || !args.input.id.trim()) return;
	args.setBusy(true);
	args.setError(null);
	try {
		await client.createProfile(args.input, { scope: args.createScope });
		args.setOpen(false);
		args.setError(null);
		args.setBusy(false);
		if (args.createScope === args.scope) {
			applySnapshot(await loadPanel(args.createScope), args.set);
			return;
		}
		args.setScope(args.createScope);
	} catch (err) {
		args.setBusy(false);
		args.setError(
			err instanceof Error ? err.message : "Failed to create profile",
		);
	}
}

function useCreateDialog(
	scope: RuneScope,
	set: PanelSetters,
	setScope: (scope: RuneScope) => void,
) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on scope change
	useEffect(() => {
		setOpen(false);
		setError(null);
	}, [scope]);

	return {
		open,
		error,
		busy,
		openCreate: () => {
			setOpen(true);
			setError(null);
			setBusy(false);
		},
		cancelCreate: () => {
			if (busy) return;
			setOpen(false);
			setError(null);
		},
		submitCreate: (input: CreateProfileInput, createScope: RuneScope) =>
			submitProfileCreate({
				input,
				busy,
				scope,
				createScope,
				set,
				setScope,
				setOpen,
				setError,
				setBusy,
			}),
	};
}

async function submitProfileUpdate(args: {
	id: string;
	input: UpdateProfileInput;
	busy: boolean;
	scope: RuneScope;
	set: PanelSetters;
	setPending: (value: Profile | null) => void;
	setError: (value: string | null) => void;
	setBusy: (value: boolean) => void;
}): Promise<void> {
	if (args.busy || !args.id.trim()) return;
	args.setBusy(true);
	args.setError(null);
	try {
		await client.updateProfile(args.id, args.input, { scope: args.scope });
		args.setPending(null);
		args.setError(null);
		args.setBusy(false);
		applySnapshot(await loadPanel(args.scope), args.set);
	} catch (err) {
		args.setBusy(false);
		args.setError(
			err instanceof Error ? err.message : "Failed to update profile",
		);
	}
}

function useEditDialog(scope: RuneScope, set: PanelSetters) {
	const [pending, setPending] = useState<Profile | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on scope change
	useEffect(() => {
		setPending(null);
		setError(null);
	}, [scope]);

	return {
		pending,
		error,
		busy,
		openEdit: (profile: Profile) => {
			setPending(profile);
			setError(null);
			setBusy(false);
		},
		cancelEdit: () => {
			if (busy) return;
			setPending(null);
			setError(null);
		},
		submitEdit: (id: string, input: UpdateProfileInput) =>
			submitProfileUpdate({
				id,
				input,
				busy,
				scope,
				set,
				setPending,
				setError,
				setBusy,
			}),
	};
}

function exclusiveDialogOpeners(args: {
	create: AppChromeProps["createDialog"];
	edit: AppChromeProps["editDialog"];
	dialog: AppChromeProps["deleteDialog"];
}): {
	createDialog: AppChromeProps["createDialog"];
	editDialog: AppChromeProps["editDialog"];
	deleteDialog: AppChromeProps["deleteDialog"];
} {
	const { create, edit, dialog } = args;
	return {
		createDialog: {
			...create,
			openCreate: () => {
				if (edit.busy || dialog.busy) return;
				edit.cancelEdit();
				dialog.cancelDelete();
				create.openCreate();
			},
		},
		editDialog: {
			...edit,
			openEdit: (profile: Profile) => {
				if (dialog.busy) return;
				dialog.cancelDelete();
				edit.openEdit(profile);
			},
		},
		deleteDialog: {
			...dialog,
			openDelete: (profile: Profile) => {
				if (edit.busy) return;
				edit.cancelEdit();
				dialog.openDelete(profile);
			},
		},
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
	onToggleScope: () => void;
	deleteDialog: {
		pending: Profile | null;
		forceRequired: boolean;
		error: string | null;
		busy: boolean;
		openDelete: (profile: Profile) => void;
		cancelDelete: () => void;
		confirmDelete: () => void;
	};
	createDialog: {
		open: boolean;
		error: string | null;
		busy: boolean;
		openCreate: () => void;
		cancelCreate: () => void;
		submitCreate: (input: CreateProfileInput, scope: RuneScope) => void;
	};
	editDialog: {
		pending: Profile | null;
		error: string | null;
		busy: boolean;
		openEdit: (profile: Profile) => void;
		cancelEdit: () => void;
		submitEdit: (id: string, input: UpdateProfileInput) => void;
	};
}

interface AppDialogsProps {
	scope: RuneScope;
	graphs: Graph[];
	deleteDialog: AppChromeProps["deleteDialog"];
	createDialog: AppChromeProps["createDialog"];
	editDialog: AppChromeProps["editDialog"];
}

function AppDialogs({
	scope,
	graphs,
	deleteDialog,
	createDialog,
	editDialog,
}: AppDialogsProps) {
	if (createDialog.open) {
		return (
			<ProfileCreateDialog
				scope={scope}
				error={createDialog.error}
				busy={createDialog.busy}
				onCancel={createDialog.cancelCreate}
				onSubmit={(input, createScope) =>
					void createDialog.submitCreate(input, createScope)
				}
			/>
		);
	}
	if (editDialog.pending) {
		return (
			<ProfileEditDialog
				profile={editDialog.pending}
				scope={scope}
				error={editDialog.error}
				busy={editDialog.busy}
				onCancel={editDialog.cancelEdit}
				onSubmit={(id, input) => void editDialog.submitEdit(id, input)}
			/>
		);
	}
	if (!deleteDialog.pending) return null;
	const pending = deleteDialog.pending;
	const graphIds = usedByMap(graphs, scope)[pending.id] ?? [];
	return (
		<ProfileDeleteDialog
			profileId={pending.id}
			graphIds={graphIds}
			forceRequired={deleteDialog.forceRequired}
			error={deleteDialog.error}
			busy={deleteDialog.busy}
			onCancel={deleteDialog.cancelDelete}
			onConfirm={() => void deleteDialog.confirmDelete()}
		/>
	);
}

function AppChrome(props: AppChromeProps) {
	return (
		<div className="shell">
			<ShellHeader
				scope={props.scope}
				healthOk={props.healthOk}
				healthLabel={props.healthLabel}
				profileCount={props.profileCount}
				onCreate={props.createDialog.openCreate}
			/>
			<ProfileSection
				state={props.viewState}
				scope={props.scope}
				selectedId={
					props.editDialog.pending?.id ?? props.deleteDialog.pending?.id ?? null
				}
				onDelete={props.deleteDialog.openDelete}
				onCreate={props.createDialog.openCreate}
				onEdit={props.editDialog.openEdit}
			/>
			<ShellFooter
				profileCount={props.profileCount}
				pipelineCount={props.pipelineCount}
				scope={props.scope}
				onToggleScope={props.onToggleScope}
				enginesOk={props.healthOk}
			/>
			<AppDialogs
				scope={props.scope}
				graphs={props.graphs}
				deleteDialog={props.deleteDialog}
				createDialog={props.createDialog}
				editDialog={props.editDialog}
			/>
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
	const create = useCreateDialog(panel.scope, panel.set, panel.setScope);
	const edit = useEditDialog(panel.scope, panel.set);
	const healthOk = panel.health !== null;
	const openers = exclusiveDialogOpeners({ create, edit, dialog });
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
			deleteDialog={openers.deleteDialog}
			createDialog={openers.createDialog}
			editDialog={openers.editDialog}
			onToggleScope={() =>
				panel.setScope((current) =>
					current === "project" ? "user" : "project",
				)
			}
		/>
	);
}
