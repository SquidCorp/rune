/** Font size tokens from Paper (Rune). */
export const text = {
	xs: "12px",
	sm: "14px",
	base: "16px",
	md: "18px",
	lg: "22px",
	xl: "28px",
	"2xl": "36px",
	"3xl": "48px",
	"4xl": "64px",
	"5xl": "88px",
} as const;

export type TextToken = keyof typeof text;
