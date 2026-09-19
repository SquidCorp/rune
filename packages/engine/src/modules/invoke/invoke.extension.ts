import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";

/** Figlet-style wordmark. Width is the longest line; keep lines equal. */
const RUNE_ART = [
	"██████╗ ██╗   ██╗███╗   ██╗███████╗",
	"██╔══██╗██║   ██║████╗  ██║██╔════╝",
	"██████╔╝██║   ██║██╔██╗ ██║█████╗  ",
	"██╔══██╗██║   ██║██║╚██╗██║██╔══╝  ",
	"██║  ██║╚██████╔╝██║ ╚████║███████╗",
	"╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝",
] as const;

const RUNE_ART_WIDTH = RUNE_ART[0].length;

export type RuneHeaderTheme = Pick<Theme, "fg" | "bold">;

export function renderRuneHeader(
	theme: RuneHeaderTheme,
	width: number,
): string[] {
	if (width < RUNE_ART_WIDTH) {
		return [theme.bold(theme.fg("accent", "RUNE"))];
	}
	return RUNE_ART.map((line) => theme.fg("accent", line));
}

/** Replaces Pi’s startup header (logo + keybinding hints) with a RUNE wordmark. */
export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setHeader((_tui, theme) => ({
			render(width: number): string[] {
				return renderRuneHeader(theme, width);
			},
			invalidate() {},
		}));
	});
}
