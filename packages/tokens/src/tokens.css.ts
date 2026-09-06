import { colors } from "./tokens.colors.ts";
import { font } from "./tokens.font.ts";
import { fontWeight } from "./tokens.font-weight.ts";
import { leading } from "./tokens.leading.ts";
import { radius } from "./tokens.radius.ts";
import { spacing } from "./tokens.spacing.ts";
import { text } from "./tokens.text.ts";
import { tracking } from "./tokens.tracking.ts";

type TokenRecord = Record<string, string>;

const asTokenRecord = (tokens: object): TokenRecord =>
	Object.fromEntries(
		Object.entries(tokens).map(([key, value]) => [key, String(value)]),
	);

const prefixEntries = (
	prefix: string,
	tokens: object,
): Array<[string, string]> =>
	Object.entries(asTokenRecord(tokens)).map(([key, value]) => [
		`--${prefix}-${key}`,
		value,
	]);

const quoteFont = (value: string): string =>
	value.includes(" ") ? `"${value}"` : value;

const fontCss = Object.fromEntries(
	Object.entries(font).map(([key, value]) => [key, quoteFont(value)]),
) as TokenRecord;

/** CSS custom properties matching Paper token names. */
export const cssVariables: Record<string, string> = Object.fromEntries([
	...prefixEntries("color", colors),
	...prefixEntries("font", fontCss),
	...prefixEntries("text", text),
	...prefixEntries("font-weight", fontWeight),
	...prefixEntries("tracking", tracking),
	...prefixEntries("leading", leading),
	...prefixEntries("spacing", spacing),
	...prefixEntries("radius", radius),
]);

/** `:root { … }` stylesheet of all design tokens. */
export const tokensStyle = [
	":root {",
	...Object.entries(cssVariables).map(
		([name, value]) => `\t${name}: ${value};`,
	),
	"}",
].join("\n");
