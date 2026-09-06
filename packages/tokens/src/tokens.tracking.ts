/** Letter-spacing tokens from Paper (Rune). */
export const tracking = {
	tight: "-0.02em",
	normal: "0em",
	wide: "0.06em",
	wider: "0.12em",
} as const;

export type TrackingToken = keyof typeof tracking;
