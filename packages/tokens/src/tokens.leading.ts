/** Line-height tokens from Paper (Rune). */
export const leading = {
	label: "16px",
	body: "26px",
	heading: "40px",
	display: "76px",
} as const;

export type LeadingToken = keyof typeof leading;
