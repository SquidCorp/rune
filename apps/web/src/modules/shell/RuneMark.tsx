export function RuneMark() {
	return (
		<span className="rune-mark">
			<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
				<circle
					cx="20"
					cy="20"
					r="18.25"
					fill="var(--color-panel-raised)"
					stroke="var(--color-accent)"
					strokeWidth="1.5"
				/>
				<circle
					cx="20"
					cy="20"
					r="13.25"
					fill="none"
					stroke="var(--color-accent-dim)"
				/>
				<path
					d="M20 1.75V5.75 M20 34.25V38.25 M1.75 20H5.75 M34.25 20H38.25"
					fill="none"
					stroke="var(--color-accent-bright)"
					strokeWidth="1.6"
					strokeLinecap="square"
				/>
			</svg>
			<span className="rune-mark-glyph">ᚱ</span>
		</span>
	);
}
