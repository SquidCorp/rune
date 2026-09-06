# Rune

Rune is a multi-profile agent runtime. You define specialized agents as **profiles** (system prompt, model, skills, tools), **link** them into workflows, and run them through a single engine.

Configure everything from the **CLI** or the **web UI**. The web app is also where you will follow agentic flows live on a canvas. Product docs ship as an Astro site in the same monorepo.

Under the hood, Rune is built on the [pi](https://github.com/earendil-works/pi-coding-agent) coding-agent SDK, with a first-party profile system and an HTTP control plane so CLI and UI share one API.

**In short:** create profiles → link agents → run and observe the flow — all configurable, all local under `.rune/`.

## Packages

| Path | Name | Role |
|---|---|---|
| `packages/engine` | `@rune/engine` | Domain: sessions, profile extension |
| `packages/api` | `@rune/api` | HTTP gateway (embeds engine paths/store) |
| `packages/sdk` | `@rune/sdk` | Shared types + HTTP client |
| `packages/tokens` | `@rune/tokens` | Design tokens (colors, type, space, radius) |
| `packages/cli` | `@rune/cli` | `rune` binary (`serve`, profile/link commands) |
| `apps/web` | `@rune/web` | React SPA — config UI (+ canvas later) |
| `apps/docs` | `@rune/docs` | Astro documentation site |

## Data root

All runtime data lives under **`.rune/`** (cwd-relative):

```text
.rune/
  profiles/<id>/
    profile.json
    SYSTEM.md
    skills/ prompts/ themes/ extensions/
  links.json
  # plus pi agent session/resource files
```

## Develop

```bash
bun install

# API gateway
bun run rune serve
# or: bun run dev:api

# Web UI (proxies /api → :8787)
bun run dev:web

# Docs
bun run dev:docs
```

### CLI

```bash
bun run rune serve
bun run rune profile create researcher --name Researcher
bun run rune profile list
bun run rune profile show researcher
bun run rune profile set researcher --model anthropic/claude-sonnet-4-5
bun run rune profile delete researcher
bun run rune link create researcher writer
bun run rune health
```

### Programmatic session

```ts
import { createRuneSession } from "@rune/engine";

const { session } = await createRuneSession();
await session.prompt("Hello from Rune");
```

## Architecture

```text
engine  ←  api  ←  cli (serve embeds api; other cmds use sdk)
             ↑
            sdk  ←  web
docs (standalone)
```

In-package code lives under `src/modules/<domain>` with a single facade per domain.

Web and CLI never import `@rune/engine`. Only the API (and engine internals) touch `.rune` on disk.
