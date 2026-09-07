# E — Retarget links → graph edges

**Epic:** Linear prompt-chain graphs  
**Depends on:** B (edges live in graph TOML). Prefer after C so topology UX is graph-check, not global links. Can land after D.  
**Unblocks:** single topology model (graph-local edges only)

## Goal

Remove the **global** profile↔profile link surface. A **link/edge** exists only as `[[edges]]` inside a graph file. No parallel `.rune/links.json`.

## Locked product decisions

| Before | After |
|---|---|
| `.rune/links.json` array of `{ id, from, to, label? }` (profile ids) | Gone |
| `rune link list` / `rune link create` | Gone (help text removed) |
| `GET/POST /links` | Gone |
| Web link section calling link API | Stub, hide, or remove so it does not call dead endpoints |
| Graph `[[edges]]` | Sole topology |

Edges reference **node ids**, not profile ids (profiles hang off nodes).

## Architecture / packages — clean cutover

No shims, no deprecated aliases (repo rule).

| Package | Work |
|---|---|
| `packages/api` | Delete `modules/link` (store, http, facade). Unregister routes in `app.ts`. Drop any profile-delete coupling that only existed for link cleanup **or** re-read profile delete and remove link scrubbing |
| `packages/sdk` | Delete `modules/link` types; remove `listLinks` / `createLink` from `RuneClient`; remove exports from `src/index.ts` |
| `packages/cli` | Delete `modules/link`; remove `link` branch + help lines from `cli.ts` |
| `apps/web` | Remove or disable link UI (`link.section.tsx` and any App wiring). Do not leave fetch-to-404. |
| `apps/docs` | Drop link CLI docs if present; graph docs only if already added |
| `README.md` | Remove `links.json` from data tree and `rune link` examples; document graphs as workflow topology |

### Profile delete interaction

Today profile delete may refuse or scrub links (`force`, link store). After cutover:

- Delete must **not** read `links.json`.
- Optional hardening (nice-to-have, not blocking): refuse profile delete if any graph node references that profile unless `--force` — only if cheap via listGraphs; otherwise leave for follow-up and note in PR.

## Out of scope

- Graph authoring UI / canvas rewrite beyond stopping dead link calls
- Migrating old `links.json` files automatically (document: delete manually or ignore)
- Changing graph TOML schema

## Acceptance

1. No `links.json` read/write anywhere in repo source.
2. `rune link …` unknown command (help no longer lists it).
3. HTTP `/links` returns not handled / 404 via main router (no route).
4. sdk no longer exports `Link` / `CreateLinkInput` / client link methods.
5. Web build does not reference link client APIs.
6. README + CLI help match graph-only topology story.
7. Existing profile CRUD + graph B/C/D paths still work.
8. Quality gate: format → lint → check → test.

## Implementation notes

- Grep for `listLinks`, `createLink`, `links.json`, `runLinkCommand`, `/links`, `CreateLinkInput` after deletion.
- `lsp` / project references: remove all callsites in the same change series.
- If web has empty gap after removing link section, a short placeholder (“Links moved into graphs”) is enough — no new feature work.
- User data: existing `.rune/links.json` on disk may remain orphaned; do not write migration code unless trivial delete-on-serve — prefer document in README changelog blurb.

## Handoff checklist

- [ ] api link module + routes removed; profile store decoupled
- [ ] sdk types + client methods removed
- [ ] cli link module + help removed
- [ ] web link surface neutralized
- [ ] README / docs updated
- [ ] repo-wide grep clean for old link API
