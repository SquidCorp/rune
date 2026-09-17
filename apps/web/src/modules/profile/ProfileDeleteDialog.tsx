import { useEffect } from "react";

export interface ProfileDeleteDialogProps {
	profileId: string;
	graphIds: string[];
	forceRequired: boolean;
	error: string | null;
	busy: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}

function DeleteWarning({
	error,
	inUse,
	profileId,
	graphIds,
}: {
	error: string | null;
	inUse: boolean;
	profileId: string;
	graphIds: string[];
}) {
	if (error) {
		return <p className="dialog-warning-body-error">{error}</p>;
	}
	if (inUse) {
		return (
			<>
				{graphIds.length > 0 ? (
					<p className="dialog-warning-body">
						Profile “{profileId}” is used by graph(s): {graphIds.join(", ")}.
					</p>
				) : null}
				<p className="dialog-warning-note">Force required.</p>
			</>
		);
	}
	return (
		<p className="dialog-warning-body">
			This removes profile “{profileId}” from disk. This cannot be undone.
		</p>
	);
}

export function ProfileDeleteDialog({
	profileId,
	graphIds,
	forceRequired,
	error,
	busy,
	onCancel,
	onConfirm,
}: ProfileDeleteDialogProps) {
	const inUse = forceRequired || graphIds.length > 0;

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
				className="dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="profile-delete-title"
			>
				<div className="dialog-header">
					<p className="dialog-eyebrow">Destructive</p>
					<h2 className="dialog-title" id="profile-delete-title">
						Delete {profileId}?
					</h2>
				</div>
				<div className="dialog-warning">
					<DeleteWarning
						error={error}
						inUse={inUse}
						profileId={profileId}
						graphIds={graphIds}
					/>
				</div>
				<div className="dialog-actions">
					<button
						type="button"
						className="dialog-btn dialog-btn-cancel"
						// biome-ignore lint/a11y/noAutofocus: Cancel is the safe default
						autoFocus={true}
						disabled={busy}
						onClick={onCancel}
					>
						Cancel
					</button>
					<button
						type="button"
						className="dialog-btn dialog-btn-destroy"
						disabled={busy}
						onClick={onConfirm}
					>
						{inUse ? "Delete anyway" : "Delete"}
					</button>
				</div>
			</div>
		</div>
	);
}
