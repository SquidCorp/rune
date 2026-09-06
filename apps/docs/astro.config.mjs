import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	srcDir: "src",
	outDir: "dist",
	server: {
		port: 4321,
	},
	vite: {
		resolve: {
			alias: {
				"@": path.resolve(rootDir, "src"),
			},
		},
	},
});
