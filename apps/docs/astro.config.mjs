import { defineConfig } from "astro/config";

export default defineConfig({
	srcDir: "src",
	outDir: "dist",
	server: {
		port: 4321,
	},
});
