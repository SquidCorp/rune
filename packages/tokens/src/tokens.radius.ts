/** Border-radius tokens from Paper (Rune). */
export const radius = {
	sm: "4px",
	md: "8px",
	lg: "14px",
	xl: "24px",
	full: "999px",
} as const;

export type RadiusToken = keyof typeof radius;
