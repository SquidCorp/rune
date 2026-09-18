export interface NewProfileButtonProps {
	onClick: () => void;
}

export function NewProfileButton({ onClick }: NewProfileButtonProps) {
	return (
		<button type="button" className="btn-new-profile" onClick={onClick}>
			New profile
		</button>
	);
}
