/** Design color tokens from Paper (Rune). */
export const colors = {
	/** Page background — obsidian basalt */
	void: "#090A0D",
	/** Card / section surface */
	panel: "#12141B",
	/** Raised surface, e.g. terminal window, inputs */
	"panel-raised": "#171A24",
	/** Default hairline border / grid */
	line: "#242833",
	/** Stronger border, hover / active outline */
	"line-strong": "#343A4A",
	/** Secondary text, captions, placeholder */
	muted: "#7C8394",
	/** Secondary heading / de-emphasized ink */
	"ink-dim": "#C7CAD4",
	/** Primary text — bone chalk white */
	ink: "#EDEEF2",
	/** Amethyst-tinted panel fill / subtle glow background */
	"accent-dim": "#241C42",
	/** Primary accent — amethyst rune-glow. CTAs, active states, glyph strokes */
	accent: "#7B5CFA",
	/** Accent hover / glow highlight */
	"accent-bright": "#B9A6FF",
	/** Verdigris — running / online status */
	"status-positive": "#5FBF8F",
	/** Torchlight amber — idle / warning status */
	"status-warning": "#E8A33D",
	/** Rusted iron — error status */
	"status-error": "#D1503A",
} as const;

export type ColorToken = keyof typeof colors;
