# D — `rune graph run`

**Epic:** Linear prompt-chain graphs  
**Depends on:** B (load), C (validate + path order)  
**Unblocks:** full E2E demo; E can ship after or in parallel once APIs stable

## Goal

Execute a validated linear graph: each node runs under its profile; prompt **inherits** prior final assistant text with optional per-node `insert` / `append`. CLI gets final answer on stdout; optional JSON log file and verbose stderr.

## Locked product decisions

### CLI

```text
rune graph run <graph-id> --prompt <string>
rune graph run <graph-id> --prompt-file <path>
                     [--log <path>] [--verbose]
```

| Flag | Behavior |
|---|---|
| `--prompt` / `--prompt-file` | Exactly one required (same mutual exclusion pattern as profile prompt flags) |
| default | Intermediates silent; **final sink output only** on stdout |
| `--log <path>` | Write full JSON run record to path; final still on stdout |
| `--verbose` | Per-node progress on **stderr**; stdout remains final-only |

- Always run **C’s validation first**; on failure, no model calls (or no further calls), non-zero exit.
- Errors: non-zero exit; message via existing CLI error path.

### Prompt contract

For node at path index `i`:

```text
userMessage = (insert ?? "") + inherited + (append ?? "")
```

| Node | `inherited` |
|---|---|
| Source (first) | CLI prompt string |
| Later | **Final assistant text** from previous node |

No other template language in v1.

### Run log JSON

```json
{
  "graphId": "draft",
  "startedAt": "ISO-8601",
  "finishedAt": "ISO-8601",
  "status": "ok",
  "initialPrompt": "...",
  "steps": [
    {
      "nodeId": "plan",
      "profile": "planner",
      "input": "...",
      "output": "...",
      "status": "ok",
      "startedAt": "...",
      "finishedAt": "..."
    }
  ],
  "final": "..."
}
```

On failure mid-chain: `status: "error"`, completed steps retained, failed step `status: "error"` + error message field; still write `--log` if requested.

## Architecture / packages

| Package | Work |
|---|---|
| `packages/sdk` | `GraphRunRequest`, `GraphRunResult`, `GraphRunStep` types; `client.runGraph(id, body)` |
| `packages/engine` | Executor: given ordered nodes + initial prompt + cwd → run steps with profile isolation; build user messages |
| `packages/api` | `POST /graphs/:id/run` body `{ prompt: string }`; loads graph, validates, calls engine, returns result (CLI writes log file from result — **or** API accepts optional log path only if cwd-local; prefer **return result, CLI writes `--log`**) |
| `packages/cli` | `graph run` parsing flags, print final, write log, verbose on stderr |

**Rule:** CLI → RuneClient → API → engine. CLI never imports engine.

### Execution notes (implementer choice, prefer correctness)

- **Profile isolation over cleverness:** safe default = new session (or clean profile apply) per node so system prompt / model / skills match that profile.
- Reuse `createRuneSession` + profile activation semantics from `packages/engine` profile extension (same as interactive `--profile` / `/profile`).
- Capture **final assistant text only** as node output (not tool traces) unless engine makes full transcript trivial — document what “final” means in code comments.
- API request should be long-timeout friendly; document that run is synchronous HTTP for v1 (no job queue).

### HTTP sketch

```http
POST /graphs/:id/run
{ "prompt": "Write about runes" }

→ 200 GraphRunResult
→ 400 validation issues (same shape as check) or run error
→ 404 unknown graph
```

## Out of scope

- Streaming tokens to client
- Parallel / DAG execution
- Persisted run history under `.rune/` (only optional CLI `--log` file)
- Web canvas live view
- Retiring links (→ E)

## Acceptance

1. 2–3 node chain with real profiles; sink text printed alone on stdout.
2. Node2 input equals node1 output wrapped with node2 insert/append as specified.
3. `--verbose` lines appear on stderr only; stdout still final-only.
4. `--log out.json` writes steps with input/output; file matches result.
5. Invalid graph → fail before models; same class of errors as `check`.
6. Missing `--prompt` and `--prompt-file` → usage error.
7. Mid-chain model/session failure → non-zero; partial steps in log when `--log` set.
8. Quality gate: format → lint → check → test.

## Implementation notes

- Mirror profile CLI flag parsing for `--prompt` / `--prompt-file`.
- Verbose format suggestion: `[graph] plan (planner) start` / `[graph] plan ok (N chars)`.
- Do not print intermediate assistant payloads on stdout.
- Keep check + run sharing one validator (no duplicated linearity rules).

## Handoff checklist

- [ ] engine chain executor + message builder (`insert`/`append`)
- [ ] API `POST /graphs/:id/run`
- [ ] sdk types + `runGraph`
- [ ] CLI `rune graph run` with three output modes
- [ ] E2E smoke with temp profiles + graph (mock or real model — if no API keys, mock session boundary behind a test double **only if** existing patterns allow; otherwise document manual smoke)
