# B — Graph definition on disk

**Epic:** Linear prompt-chain graphs  
**Depends on:** profiles (done)  
**Unblocks:** C (check), D (run), E (retarget links)

## Goal

Load hand-authored graph TOML from `.rune/graphs/<graph-id>.toml` into typed `Graph` values. No validate-beyond-parse, no CLI run yet (list/show optional if cheap once store exists).

## Locked product decisions

| Item | Choice |
|---|---|
| Location | `.rune/graphs/<graph-id>.toml` (sibling of `profiles/`) |
| Id | Filename stem; same safe-id rules as profiles |
| Shape | `[[nodes]]` + `[[edges]]` |
| Node fields | `id`, `profile`, optional `insert`, optional `append` |
| Edge fields | `from`, `to` (node ids) |
| Metadata | optional top-level `name`, `description` |
| Links | Global `links.json` untouched in this ticket |

### Prompt modifiers (schema only here)

User message at runtime (implemented in D):

```text
[insert?] + inherited + [append?]
```

Ticket B only stores the strings.

### Example TOML

```toml
name = "Research → Write"
description = "Plan, research, then draft"

[[nodes]]
id = "plan"
profile = "planner"
insert = "Produce a short plan for:"
append = "Output only the plan."

[[nodes]]
id = "research"
profile = "researcher"
insert = "Execute this plan with cited notes:"

[[nodes]]
id = "write"
profile = "writer"
append = "Return the final article only."

[[edges]]
from = "plan"
to = "research"

[[edges]]
from = "research"
to = "write"
```

## Architecture / packages

Follow deep-module rules (`src/modules/<domain>/`, facade `index.ts` only).

| Package | Work |
|---|---|
| `packages/engine` | `graphsRoot(cwd)`, `graphPath(id, cwd)` in paths module; export from engine facade |
| `packages/sdk` | New `graph` module: types only |
| `packages/api` | New `graph` module: store load/list from disk (TOML parse) |
| `packages/cli` | Optional: none required; prefer defer list/show to C |
| `README.md` | Update `.rune/` tree to include `graphs/<id>.toml` |

**Do not** import engine from CLI/web. API may use engine paths + local store.

### Suggested types (`@rune/sdk`)

```ts
export interface GraphNode {
  id: string;
  profile: string;
  insert?: string;
  append?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface Graph {
  id: string; // filename stem
  name?: string;
  description?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  path: string; // absolute or cwd-relative file path
}
```

### Store API sketch (`@rune/api` graph module)

- `listGraphs(cwd?): Graph[]` — skip invalid files or surface soft errors; prefer skip + continue for list, strict load for get
- `getGraph(id, cwd?): Graph | undefined` — missing file → undefined; **malformed TOML → throw** with clear message
- Parse with a maintained TOML library (add dep only after `bun outdated <pkg>`; pick latest)

### Path helpers (`@rune/engine` paths)

```ts
graphsRoot(cwd?) => join(runeDir(cwd), "graphs")
graphPath(id, cwd?) => join(graphsRoot(cwd), `${id}.toml`)
```

Mirror `isSafeProfileId` for graph ids (no path sep, no `default` reservation unless needed, no leading `.`).

## Out of scope

- Linearity / profile-existence validation (→ C)
- Execute / run log (→ D)
- Removing `link` module (→ E)
- `rune graph create` wizard
- Web UI

## Acceptance

1. Hand-written `.rune/graphs/draft.toml` (as in example) loads via `getGraph("draft")` with correct nodes/edges/insert/append.
2. `listGraphs` returns the graph when the file exists.
3. `graphsRoot()` resolves to `<cwd>/.rune/graphs`.
4. README data-root documents `graphs/<id>.toml`.
5. Malformed TOML fails with an actionable error (not a silent empty graph).
6. Quality gate if you touch packages: `bun run format` → `lint` → `check` → `test`.

## Implementation notes

- Reuse profile safe-id rules; do not invent a second id dialect.
- Keep parse logic in api store (or engine if you need shared pure parse for C/D — if shared, put pure `parseGraphToml(text, id, path)` in engine `graph` module and call from api). Prefer **one** parser.
- No HTTP routes strictly required for B; if you add `GET /graphs` and `GET /graphs/:id` early, C/D will thank you — allowed but not mandatory.

## Handoff checklist

- [ ] sdk graph types + facade export
- [ ] engine `graphsRoot` / `graphPath` + exports
- [ ] TOML dependency + parse
- [ ] api `listGraphs` / `getGraph`
- [ ] README tree
- [ ] Fixture or smoke: load example file in a temp cwd
