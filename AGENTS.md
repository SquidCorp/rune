# AGENTS guidance

## Deep-module rule (convention — no boundary lint yet)

Every app and package is organized as **domain deep modules**.

1. **Module = domain** under `src/modules/<domain>/`.
2. **Sole public surface** of a domain: `src/modules/<domain>/index.ts`.
3. **Internals** use `domain.responsibility.ts` (two segments, dot-separated). Allowed responsibilities in this repo:
   - `types` — types + domain constants
   - `store` — filesystem/persistence
   - `http` — HTTP route handlers or HTTP client implementation
   - `commands` — CLI subcommands
   - `extension` — pi extension factory
   - `factory` — session/object factories
   - `resolve` — path resolution
   - `section` / `form` — web UI feature sections/forms
   - `content` — docs content fragments
   - `placeholder` — temporary UI stubs
   - `constants` - all constants of a module
4. **Role exceptions (not `domain.responsibility`):**
   - `index.ts` — module or package facade
   - Composition roots: `src/app.ts` (api), `src/cli.ts` (cli), `src/app/**` (web), `src/main.tsx` (web bootstrap), `src/bin.ts` (cli process entry), `src/pages/**` (Astro routes)
   - Package facade: `src/index.ts` re-exports only from `./app`, `./cli`, or `@/modules/*` facades
   - Tests: `domain.responsibility.test.ts` (or co-located `*.test.ts`)
   - Pure presentational React leaves only: `PascalCase.tsx` inside a module (e.g. `ProfileCard.tsx`)
5. **Imports:**
   - Composition roots and package `index.ts` import domains **only** via `@/modules/<domain>` (never deep paths like `@/modules/profile/profile.store`).
   - Module internals import only `./…` (same module) or `@/modules/<other>` (other domain **facade** only).
   - **Never** `../` that leaves a module directory.
   - **Never** global `controllers/`, `services/`, `components/`, `utils/` trees beside `modules/`.
6. **Cross-domain use:** depend on the other module’s facade (`@/modules/profile`), or accept injected deps from the composition root. Do not reach into siblings’ files.
7. **Boundary lint:** convention-only until a later pass. Do not bypass the structure because lint is deferred.

Wire **`@/*` → `src/*`** in every package/app `tsconfig.json` (`baseUrl: "."`, `paths`). For web, mirror in `apps/web/vite.config.ts` `resolve.alias`. Do **not** add shared path aliases in `tsconfig.base.json`.

## Quality Gate

Before saying your done always run, if relevant, those commands in this order:

0- `bun outdated <new-package>` when you add a new package to be sure you got the latest version.
1- `bun run format`
2- `bun run lint`
3- `bun run check`
4- `bun run test`

Do not pass to the next step until current step has errors.
