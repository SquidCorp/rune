/** Font family tokens from Paper (Rune). */
export const font = {
	/** Headlines, hero numerals, logo mark */
	display: "Space Grotesk",
	/** Labels, nav, telemetry, code */
	mono: "JetBrains Mono",
	/** Body copy, longform */
	body: "Inter",
} as const;

export type FontToken = keyof typeof font;
