import {
	type Profile,
	RUNE_SCOPES,
	type RuneScope,
	THINKING_LEVELS,
	type ThinkingLevel,
	type UpdateProfileInput,
} from "@rune/sdk";
import { type ReactNode, useEffect, useRef, useState } from "react";

export interface ProfileEditDialogProps {
	profile: Profile;
	scope: RuneScope;
	error: string | null;
	busy: boolean;
	onCancel: () => void;
	onSubmit: (id: string, input: UpdateProfileInput) => void;
}

interface EditFieldState {
	name: string;
	model: string;
	thinkingLevel: "" | ThinkingLevel;
	systemPrompt: string;
}

type EditTab = "properties" | "prompt";

function toUpdateInput(fields: {
	name: string;
	model: string;
	thinkingLevel: "" | ThinkingLevel;
	systemPrompt: string;
}): UpdateProfileInput {
	const input: UpdateProfileInput = {};
	const name = fields.name.trim();
	const model = fields.model.trim();
	const prompt = fields.systemPrompt.trim();
	if (name) input.name = name;
	if (model) input.model = model;
	if (fields.thinkingLevel !== "") input.thinkingLevel = fields.thinkingLevel;
	if (prompt) input.systemPrompt = prompt;
	return input;
}

function isPromptFile(file: File): boolean {
	const name = file.name.toLowerCase();
	return name.endsWith(".txt") || name.endsWith(".md");
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="dialog-field">
			<p className="dialog-label">{label}</p>
			{children}
		</div>
	);
}

function ChevronIcon() {
	return (
		<svg
			className="dialog-select-chevron"
			width="12"
			height="12"
			viewBox="0 0 12 12"
			aria-hidden="true"
		>
			<path
				d="M2.5 4.5L6 8L9.5 4.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ImportIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
			<path
				d="M7 2.5V9.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
			<path
				d="M4.5 5L7 2.5L9.5 5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M2.5 10.5V11.5H11.5V10.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function ScopeField({ scope }: { scope: RuneScope }) {
	return (
		<Field label="Scope">
			<div className="dialog-select-wrap">
				<select className="dialog-select" disabled={true} value={scope}>
					{RUNE_SCOPES.map((value) => (
						<option key={value} value={value}>
							{value}
						</option>
					))}
				</select>
				<ChevronIcon />
			</div>
		</Field>
	);
}

function ModelThinkRow({
	busy,
	model,
	thinkingLevel,
	onChange,
}: {
	busy: boolean;
	model: string;
	thinkingLevel: "" | ThinkingLevel;
	onChange: (patch: Partial<EditFieldState>) => void;
}) {
	return (
		<div className="dialog-field-row">
			<div className="dialog-field dialog-field-model">
				<p className="dialog-label">Model</p>
				<input
					className="dialog-input dialog-input-model"
					disabled={busy}
					placeholder="anthropic/claude-sonnet-4-5"
					value={model}
					onChange={(event) => onChange({ model: event.target.value })}
				/>
			</div>
			<div className="dialog-field dialog-field-think">
				<p className="dialog-label">Think</p>
				<select
					className="dialog-select"
					disabled={busy}
					value={thinkingLevel}
					onChange={(event) =>
						onChange({
							thinkingLevel: event.target.value as "" | ThinkingLevel,
						})
					}
				>
					<option value="">—</option>
					{THINKING_LEVELS.map((level) => (
						<option key={level} value={level}>
							{level}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}

function PropertiesPanel({
	busy,
	scope,
	profileId,
	fields,
	onChange,
}: {
	busy: boolean;
	scope: RuneScope;
	profileId: string;
	fields: EditFieldState;
	onChange: (patch: Partial<EditFieldState>) => void;
}) {
	return (
		<div className="dialog-fields" role="tabpanel">
			<ScopeField scope={scope} />
			<Field label="Id">
				<input
					className="dialog-input dialog-input-id"
					disabled={true}
					value={profileId}
				/>
			</Field>
			<Field label="Display name">
				<input
					className="dialog-input dialog-input-name"
					disabled={busy}
					placeholder="Researcher"
					value={fields.name}
					onChange={(event) => onChange({ name: event.target.value })}
				/>
			</Field>
			<ModelThinkRow
				busy={busy}
				model={fields.model}
				thinkingLevel={fields.thinkingLevel}
				onChange={onChange}
			/>
		</div>
	);
}

function ImportRow({
	busy,
	onImported,
}: {
	busy: boolean;
	onImported: (name: string, text: string) => void;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	return (
		<div className="dialog-import-row">
			<p className="dialog-label">System prompt</p>
			<button
				type="button"
				className="dialog-btn-import"
				disabled={busy}
				onClick={() => fileRef.current?.click()}
			>
				<ImportIcon />
				Import file
			</button>
			<input
				ref={fileRef}
				type="file"
				hidden={true}
				accept=".txt,.md,text/plain,text/markdown"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (!file || !isPromptFile(file)) return;
					void file.text().then((text) => onImported(file.name, text));
				}}
			/>
		</div>
	);
}

function PromptPanel({
	busy,
	tab,
	importedName,
	systemPrompt,
	onChange,
	onImported,
}: {
	busy: boolean;
	tab: EditTab;
	importedName: string | null;
	systemPrompt: string;
	onChange: (value: string) => void;
	onImported: (name: string, text: string) => void;
}) {
	return (
		<div className="dialog-fields dialog-fields-fill" role="tabpanel">
			<ImportRow busy={busy} onImported={onImported} />
			<div className="dialog-field dialog-field-fill">
				<textarea
					className="dialog-textarea dialog-textarea-fill"
					// biome-ignore lint/a11y/noAutofocus: Prompt is the active tab field
					autoFocus={tab === "prompt"}
					disabled={busy}
					placeholder="You review drafts for factual errors. Return only the corrected article."
					value={systemPrompt}
					onChange={(event) => onChange(event.target.value)}
				/>
				{importedName ? (
					<p className="dialog-import-name">{importedName}</p>
				) : null}
			</div>
		</div>
	);
}

function EditHeader({
	profileId,
	scope,
}: {
	profileId: string;
	scope: RuneScope;
}) {
	return (
		<div className="dialog-header">
			<p className="dialog-eyebrow dialog-eyebrow-muted">Edit profile</p>
			<h2 className="dialog-title" id="profile-edit-title">
				Edit {profileId}
			</h2>
			<p className="dialog-lede">
				Updates apply in {scope} scope. Id and scope cannot change.
			</p>
		</div>
	);
}

function EditTabButton({
	current,
	id,
	label,
	busy,
	onTab,
}: {
	current: EditTab;
	id: EditTab;
	label: string;
	busy: boolean;
	onTab: (tab: EditTab) => void;
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={current === id}
			className={current === id ? "dialog-tab dialog-tab-active" : "dialog-tab"}
			disabled={busy}
			onClick={() => onTab(id)}
		>
			{label}
		</button>
	);
}

function EditTabs({
	tab,
	busy,
	onTab,
}: {
	tab: EditTab;
	busy: boolean;
	onTab: (tab: EditTab) => void;
}) {
	return (
		<div className="dialog-tabs" role="tablist">
			<EditTabButton
				current={tab}
				id="properties"
				label="Properties"
				busy={busy}
				onTab={onTab}
			/>
			<EditTabButton
				current={tab}
				id="prompt"
				label="System prompt"
				busy={busy}
				onTab={onTab}
			/>
		</div>
	);
}

function EditActions({
	busy,
	canSubmit,
	onCancel,
}: {
	busy: boolean;
	canSubmit: boolean;
	onCancel: () => void;
}) {
	return (
		<div className="dialog-actions">
			<button
				type="button"
				className="dialog-btn dialog-btn-cancel"
				disabled={busy}
				onClick={onCancel}
			>
				Cancel
			</button>
			<button
				type="submit"
				className="dialog-btn dialog-btn-create"
				disabled={!canSubmit}
			>
				Save
			</button>
		</div>
	);
}

interface EditFormProps {
	busy: boolean;
	canSubmit: boolean;
	error: string | null;
	fields: EditFieldState;
	importedName: string | null;
	profileId: string;
	scope: RuneScope;
	tab: EditTab;
	onCancel: () => void;
	onChange: (patch: Partial<EditFieldState>) => void;
	onImported: (name: string, text: string) => void;
	onSubmit: (id: string, input: UpdateProfileInput) => void;
	onTab: (tab: EditTab) => void;
}

function EditForm(props: EditFormProps) {
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				if (!props.canSubmit) return;
				props.onSubmit(props.profileId, toUpdateInput(props.fields));
			}}
		>
			<EditTabs tab={props.tab} busy={props.busy} onTab={props.onTab} />
			{props.tab === "properties" ? (
				<PropertiesPanel
					busy={props.busy}
					scope={props.scope}
					profileId={props.profileId}
					fields={props.fields}
					onChange={props.onChange}
				/>
			) : (
				<PromptPanel
					busy={props.busy}
					tab={props.tab}
					importedName={props.importedName}
					systemPrompt={props.fields.systemPrompt}
					onChange={(value) => props.onChange({ systemPrompt: value })}
					onImported={props.onImported}
				/>
			)}
			{props.error ? (
				<div className="dialog-warning">
					<p className="dialog-warning-body-error">{props.error}</p>
				</div>
			) : null}
			<EditActions
				busy={props.busy}
				canSubmit={props.canSubmit}
				onCancel={props.onCancel}
			/>
		</form>
	);
}

function EditDialogCard({
	profile,
	scope,
	error,
	busy,
	onCancel,
	onSubmit,
}: ProfileEditDialogProps) {
	const [tab, setTab] = useState<EditTab>("properties");
	const [importedName, setImportedName] = useState<string | null>(null);
	const [fields, setFields] = useState<EditFieldState>({
		name: profile.meta.name ?? "",
		model: profile.meta.model ?? "",
		thinkingLevel: profile.meta.thinkingLevel ?? "",
		systemPrompt: profile.systemPrompt ?? "",
	});
	return (
		<div
			className="dialog dialog-create"
			role="dialog"
			aria-modal="true"
			aria-labelledby="profile-edit-title"
		>
			<EditHeader profileId={profile.id} scope={scope} />
			<EditForm
				busy={busy}
				canSubmit={!busy}
				error={error}
				fields={fields}
				importedName={importedName}
				profileId={profile.id}
				scope={scope}
				tab={tab}
				onCancel={onCancel}
				onChange={(patch) => setFields((current) => ({ ...current, ...patch }))}
				onImported={(name, text) => {
					setImportedName(name);
					setFields((current) => ({ ...current, systemPrompt: text }));
				}}
				onSubmit={onSubmit}
				onTab={setTab}
			/>
		</div>
	);
}

export function ProfileEditDialog(props: ProfileEditDialogProps) {
	const { busy, onCancel } = props;
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !busy) onCancel();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [busy, onCancel]);

	return (
		// Overlay scrim: click outside dismisses. Escape is bound on window.
		// biome-ignore lint/a11y/noStaticElementInteractions: dialog scrim
		// biome-ignore lint/a11y/useKeyWithClickEvents: Escape on window
		<div
			className="dialog-overlay"
			onClick={(event) => {
				if (!busy && event.target === event.currentTarget) onCancel();
			}}
		>
			<EditDialogCard {...props} />
		</div>
	);
}
