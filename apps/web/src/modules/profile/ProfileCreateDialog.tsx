import {
	type CreateProfileInput,
	RUNE_SCOPES,
	type RuneScope,
	THINKING_LEVELS,
	type ThinkingLevel,
} from "@rune/sdk";
import { type ReactNode, useEffect, useRef, useState } from "react";

export interface ProfileCreateDialogProps {
	scope: RuneScope;
	error: string | null;
	busy: boolean;
	onCancel: () => void;
	onSubmit: (input: CreateProfileInput, scope: RuneScope) => void;
}

interface CreateFieldState {
	scope: RuneScope;
	id: string;
	name: string;
	model: string;
	thinkingLevel: "" | ThinkingLevel;
	systemPrompt: string;
}

type CreateStep = 1 | 2;

function toCreateInput(
	fields: CreateFieldState,
	includePrompt: boolean,
): CreateProfileInput {
	return {
		id: fields.id.trim(),
		name: fields.name.trim() || undefined,
		model: fields.model.trim() || undefined,
		thinkingLevel:
			fields.thinkingLevel === "" ? undefined : fields.thinkingLevel,
		systemPrompt: includePrompt
			? fields.systemPrompt.trim() || undefined
			: undefined,
	};
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

function ScopeField({
	busy,
	scope,
	onChange,
}: {
	busy: boolean;
	scope: RuneScope;
	onChange: (scope: RuneScope) => void;
}) {
	return (
		<Field label="Scope">
			<div className="dialog-select-wrap">
				<select
					className="dialog-select"
					disabled={busy}
					value={scope}
					onChange={(event) => onChange(event.target.value as RuneScope)}
				>
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
	onChange: (patch: Partial<CreateFieldState>) => void;
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

function IdentityFields({
	busy,
	fields,
	onChange,
}: {
	busy: boolean;
	fields: CreateFieldState;
	onChange: (patch: Partial<CreateFieldState>) => void;
}) {
	return (
		<div className="dialog-fields">
			<ScopeField
				busy={busy}
				scope={fields.scope}
				onChange={(scope) => onChange({ scope })}
			/>
			<Field label="Id">
				<input
					className="dialog-input dialog-input-id"
					// biome-ignore lint/a11y/noAutofocus: Id is the first field
					autoFocus={true}
					disabled={busy}
					placeholder="researcher"
					value={fields.id}
					onChange={(event) => onChange({ id: event.target.value })}
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

function PromptStep({
	busy,
	importedName,
	systemPrompt,
	onChange,
	onImported,
}: {
	busy: boolean;
	importedName: string | null;
	systemPrompt: string;
	onChange: (value: string) => void;
	onImported: (name: string, text: string) => void;
}) {
	const fileRef = useRef<HTMLInputElement>(null);

	return (
		<div className="dialog-fields dialog-fields-fill">
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
			<div className="dialog-field dialog-field-fill">
				<textarea
					className="dialog-textarea dialog-textarea-fill"
					// biome-ignore lint/a11y/noAutofocus: Prompt is the step-2 field
					autoFocus={true}
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

function CreateHeader({ step }: { step: CreateStep }) {
	return (
		<div className="dialog-header">
			<p className="dialog-eyebrow dialog-eyebrow-muted">
				New profile · {step} of 2
			</p>
			<h2 className="dialog-title" id="profile-create-title">
				{step === 1 ? "Create a new profile" : "Add a system prompt"}
			</h2>
			<p className="dialog-lede">
				{step === 1
					? "Choose user or project scope. Graphs cannot see user profiles."
					: "Optional. Type below or import a .txt or .md file."}
			</p>
		</div>
	);
}

function Step1Actions({
	busy,
	canAdvance,
	onCancel,
}: {
	busy: boolean;
	canAdvance: boolean;
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
				disabled={!canAdvance}
			>
				Next
			</button>
		</div>
	);
}

function Step2Actions({
	busy,
	canAdvance,
	onBack,
	onSkip,
}: {
	busy: boolean;
	canAdvance: boolean;
	onBack: () => void;
	onSkip: () => void;
}) {
	return (
		<div className="dialog-actions dialog-actions-spread">
			<button
				type="button"
				className="dialog-btn dialog-btn-cancel"
				disabled={busy}
				onClick={onBack}
			>
				Back
			</button>
			<div className="dialog-actions-trailing">
				<button
					type="button"
					className="dialog-btn dialog-btn-cancel"
					disabled={!canAdvance}
					onClick={onSkip}
				>
					Skip
				</button>
				<button
					type="submit"
					className="dialog-btn dialog-btn-create"
					disabled={!canAdvance}
				>
					Save prompt
				</button>
			</div>
		</div>
	);
}

function CreateForm({
	busy,
	canAdvance,
	error,
	fields,
	importedName,
	step,
	onBack,
	onCancel,
	onChange,
	onImported,
	onNext,
	onSkip,
	onSubmit,
}: {
	busy: boolean;
	canAdvance: boolean;
	error: string | null;
	fields: CreateFieldState;
	importedName: string | null;
	step: CreateStep;
	onBack: () => void;
	onCancel: () => void;
	onChange: (patch: Partial<CreateFieldState>) => void;
	onImported: (name: string, text: string) => void;
	onNext: () => void;
	onSkip: () => void;
	onSubmit: (input: CreateProfileInput, scope: RuneScope) => void;
}) {
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				if (!canAdvance) return;
				if (step === 1) {
					onNext();
					return;
				}
				onSubmit(toCreateInput(fields, true), fields.scope);
			}}
		>
			{step === 1 ? (
				<IdentityFields busy={busy} fields={fields} onChange={onChange} />
			) : (
				<PromptStep
					busy={busy}
					importedName={importedName}
					systemPrompt={fields.systemPrompt}
					onChange={(value) => onChange({ systemPrompt: value })}
					onImported={onImported}
				/>
			)}
			{error ? (
				<div className="dialog-warning">
					<p className="dialog-warning-body-error">{error}</p>
				</div>
			) : null}
			{step === 1 ? (
				<Step1Actions busy={busy} canAdvance={canAdvance} onCancel={onCancel} />
			) : (
				<Step2Actions
					busy={busy}
					canAdvance={canAdvance}
					onBack={onBack}
					onSkip={onSkip}
				/>
			)}
		</form>
	);
}

export function ProfileCreateDialog({
	scope,
	error,
	busy,
	onCancel,
	onSubmit,
}: ProfileCreateDialogProps) {
	const [step, setStep] = useState<CreateStep>(1);
	const [importedName, setImportedName] = useState<string | null>(null);
	const [fields, setFields] = useState<CreateFieldState>({
		scope,
		id: "",
		name: "",
		model: "",
		thinkingLevel: "",
		systemPrompt: "",
	});
	const canAdvance = fields.id.trim().length > 0 && !busy;

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
			<div
				className="dialog dialog-create"
				role="dialog"
				aria-modal="true"
				aria-labelledby="profile-create-title"
			>
				<CreateHeader step={step} />
				<CreateForm
					busy={busy}
					canAdvance={canAdvance}
					error={error}
					fields={fields}
					importedName={importedName}
					step={step}
					onBack={() => setStep(1)}
					onCancel={onCancel}
					onChange={(patch) =>
						setFields((current) => ({ ...current, ...patch }))
					}
					onImported={(name, text) => {
						setImportedName(name);
						setFields((current) => ({ ...current, systemPrompt: text }));
					}}
					onNext={() => setStep(2)}
					onSkip={() => onSubmit(toCreateInput(fields, false), fields.scope)}
					onSubmit={onSubmit}
				/>
			</div>
		</div>
	);
}
