# C — `rune graph check`

**Epic:** Linear prompt-chain graphs  
**Depends on:** B (load TOML → `Graph`)  
**Unblocks:** D (run always checks first)

## Goal

Validate a graph file end-to-end from CLI through API: parse OK, schema OK, profiles exist, topology is a **single linear path**. No model calls.

## Locked product decisions

### CLI

```text
rune graph list
rune graph show <graph-id>
rune graph check <graph-id>
```

- `list` / `show` ship here if not done in B (needed for operability).
- `check` exit **0** if valid, **non-zero** if not.
- Human-readable errors on stderr or stdout (match existing CLI error style: throw → `bin.ts` prints message, exit 1).

### Validation rules (all must pass)

1. File exists under `.rune/graphs/<id>.toml` and parses.
2. ≥1 node; every `nodes.id` unique and safe.
3. Every `nodes.profile` exists via existing profile store (`getProfile`).
4. Every edge `from` / `to` references a declared node; no self-edges.
5. **Linear path only:**
   - exactly one source (in-degree 0)
   - exactly one sink (out-degree 0)
   - each node in-degree ≤ 1 and out-degree ≤ 1
   - all nodes lie on the unique path source→sink (no isolates, no extra components)
   - no cycles
6. Fail closed with **actionable** messages (include node id, missing profile id, offending edge).

### Prompt fields

`insert` / `append` are optional strings; no further validation beyond type/string presence after parse.

## Architecture / packages

| Package | Work |
|---|---|
| `packages/sdk` | `GraphValidationIssue`, `GraphCheckResult` types; client `listGraphs`, `getGraph`, `checkGraph(id)` |
| `packages/engine` or `packages/api` | Pure `validateGraph(graph, ctx)` where `ctx.profileExists(id)`; keep pure topology in one place |
| `packages/api` | HTTP: `GET /graphs`, `GET /graphs/:id`, `POST /graphs/:id/check` (or `GET .../check` — pick one, document in ticket implementer notes). Wire in `app.ts` like profile/link |
| `packages/cli` | `modules/graph/graph.commands.ts` + facade; register `graph` in `cli.ts` help + dispatcher |

**Rule:** CLI uses `RuneClient` only (no engine import).

### Result shape sketch

```ts
export interface GraphValidationIssue {
  code: string; // e.g. "missing_profile", "cycle", "branch"
  message: string;
  nodeId?: string;
  edge?: { from: string; to: string };
  profile?: string;
}

export interface GraphCheckResult {
  graphId: string;
  ok: boolean;
  issues: GraphValidationIssue[];
  /** Present when ok: ordered node ids source→sink */
  path?: string[];
}
```

### CLI output sketch

```text
# ok
Graph "draft" OK
path: plan -> research -> write

# fail
Graph "draft" invalid:
  - missing_profile: node "plan" references profile "planner" (not found)
  - branch: node "research" has out-degree 2
```

## Out of scope

- Running agents / sessions
- `--log` / `--verbose`
- Deleting global links (→ E)
- Web UI

## Acceptance

1. Valid linear example → `rune graph check draft` exit 0, prints path.
2. Node `profile = "nope"` when profile missing → non-zero, message names profile + node.
3. Two outgoing edges from one node → non-zero, linearity error.
4. Cycle → non-zero.
5. Unknown graph id → non-zero, clear not-found.
6. `list` / `show` work against API.
7. Quality gate: format → lint → check → test.

## Implementation notes

- Reuse profile existence from `@/modules/profile` facade inside api (same pattern as `createLink` today).
- Prefer implementing topology validation as a pure function with unit-worthy cases (even if only smoke-tested): empty edges single node; 3-node line; diamond; fork; isolate; cycle.
- `check` must not create sessions or touch models.
- Help text in `cli.ts` must include the new graph commands.

## Handoff checklist

- [ ] `validateGraph` pure rules + path order
- [ ] API routes list/get/check
- [ ] sdk client methods + types
- [ ] `rune graph list|show|check`
- [ ] Smoke: temp cwd with profiles + toml
