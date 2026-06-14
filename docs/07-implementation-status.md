# Implementation Status & Handoff

Snapshot date: 2026-06-14. This is the "where we stopped" document so any agent
(Claude, Antigravity CLI / `agy`, Codex, etc.) can continue without re-deriving
context. Read this first, then `01-architecture-spec.md` and
`04-provider-adapter-contract.md`.

## TL;DR

The broker (MCP server routing Claude workflow agents to local coding CLIs) is fully functional, written in strict **TypeScript**, and enforces a **declarative provider-capability contract**. All tests are green.

- Run tests: `npm test` (`node --import tsx --test`)
- Type-check: `npm run typecheck` (`tsc --noEmit`)
- Smoke (dry-run): `npm run smoke`
- Smoke (live): `npm run smoke:live -- <provider>`
- Live provider validation: `npm run live:validate` or `npm run live:validate:<provider>`
- Provider+model matrix: `npm run live:matrix -- <provider> "<model>" [timeoutMs]`

## Architectural direction (decided)

JavaScript/TypeScript is the standard for this project. The workload is I/O and subprocess bound (dominated by LLM latency), meaning a systems language is not necessary, while maintaining JS ecosystem compatibility (MCP SDK, Codex plugins) is crucial. Key elements implemented:

1. **TypeScript** — All source files have been fully migrated to TypeScript with strict type checking.
2. **Declarative provider capabilities** — CLI capabilities are modeled as data, allowing the broker to enforce them uniformly and fail fast before executing subprocesses.
3. **Wire contract** — The JSON request/response envelope is frozen to ensure compatibility across clients.

## TypeScript migration — current state

The codebase is fully written in strict TypeScript. Node 20.19.4 is supported via `tsx` execution wrappers at runtime for scripts and MCP server startup.

Migrated to `.ts` (all waves complete):

- `src/types.ts` — domain types: `AgentInput`, `ResolvedRequest`, `Envelope`, `Route`, `BridgeConfig`.
- `src/adapters/contract.ts` — `ProviderCapabilities`, `ProviderAdapter`, `requiredCapabilities(request)`.
- `src/broker/`: `routing.ts`, `errors.ts`, `schema-validation.ts`, `run-agent.ts`
- `src/claude/`: `agent-loader.ts`, `prompt-assembler.ts`
- `src/config/load-config.ts`
- `src/mcp/create-server.ts`, `src/mcp-server.ts` (entry), `src/index.ts`
- `src/adapters/`: `common.ts`, `process-runner.ts`, `claude.ts`, `codex.ts`, `gemini.ts`, `opencode.ts`, `agy.ts`, `registry.ts`

There are no remaining `.mjs` files in `src/`. All imports use explicit extensions, typecheck is clean with no bypasses.

Import convention during migration: migrated files are referenced with an
explicit `.ts` extension (allowed by `allowImportingTsExtensions`); unmigrated
files keep their `.mjs` specifiers. A `.mjs` file may import a `.ts` file and
vice-versa — `tsx` resolves both. The entry points moved too, so
`.mcp.json`, `package.json`'s `mcp` script, and `scripts/*.mjs` now reference
`src/mcp-server.ts` / `src/index.ts`.

### Migration boundary (resolved — Wave 4 complete)

The adapters shared `common.mjs` (whose `normalizeSuccess` previously widened
`ok` to `boolean`, requiring a `as Envelope` cast in `run-agent.ts`'s dry-run
branch). That cast has been removed: `common.ts` now types `normalizeSuccess` to
return `SuccessEnvelope` directly, and `run-agent.ts` no longer needs the cast.

## Capability enforcement (Wave 3) — done

Each adapter now also exports a `ProviderAdapter` object `{ capabilities, run }`
(the `runX` functions are kept for the adapter arg unit tests). The registry maps
`name → ProviderAdapter`. The broker (`run-agent.ts`):

- resolves the adapter, accepting both the object shape and a bare function
  (legacy / test mocks → treated as fully permissive, enforcement opted out);
- calls `requiredCapabilities(request)` and rejects any unmet capability **before
  dispatch** via `assertProviderSupports`, mapping each to a precise code
  (`structuredOutput→UNSUPPORTED_SCHEMA`, `images→UNSUPPORTED_ATTACHMENT`,
  `sandbox→UNSUPPORTED_SANDBOX`, `skipPermissions→PERMISSION_DENIED`);
- then calls `adapter.run(request)`.

The per-adapter `if (request.schema) throw UNSUPPORTED_SCHEMA` in `agy.mjs` was
removed — it is now expressed declaratively as `structuredOutput: false`.

Declared capabilities (honest to what each adapter wires today):

| Provider | structuredOutput | images | sandbox | skipPermissions |
|----------|:---:|:---:|:---:|:---:|
| claude | ✅ | ❌ | ❌ | ✅ |
| codex | ✅ | ✅ | ✅ | ✅ |
| gemini | ✅ | ❌ | ❌ | ❌ (`--yolo` not wired) |
| opencode | ✅ | ✅ | ❌ | ✅ |
| agy | ❌ | ❌ | ✅ | ✅ |

Tests: 50 passing (`npm test`), `tsc --noEmit` clean.

## Next steps (ordered)

Waves 2, 3, and 4 are **done**. The TypeScript migration is complete — no `.mjs`
files remain under `src/`.

Remaining post-migration cleanup:
- Delete `allowJs` from `tsconfig.json` and enable strict-mode coverage across the whole tree. (**Done** - strict TypeScript type-checking is now enforced across all source files).
- Wire the unused `rawOutputPath` / structured audit logging (`audit-log` in the original plan) for observability.

## Provider / CLI status

All five CLIs are installed locally. `--model` validated for one representative
model per working provider (not the full model list — same code path, just a
different `--model` string, covered by adapter arg unit tests).

| Provider | CLI | Live smoke | Notes |
|----------|-----|-----------|-------|
| claude | `claude -p` | OK (direct + via MCP) | primary; `--dangerously-skip-permissions` |
| opencode | `opencode run --format json` | OK | JSONL output; text is in `part.text` (parser fixed) |
| codex | `codex exec` | blocked | needs `--skip-git-repo-check` (added); failed on OpenAI usage quota, not our code |
| agy | **Antigravity CLI** `agy --print` | mechanically OK | multi-model gateway (Gemini / Claude 4.6 / GPT-OSS); text-only, no JSON schema → `UNSUPPORTED_SCHEMA`; **agentic** — explores workspace on vague prompts, so not a quick Q&A provider |
| gemini | `gemini -p` | not tested | being discontinued; uses `--yolo` (not `--dangerously-skip-permissions`) |

### Unattended-execution flag (resolved this session)

The "skip tool-approval prompts" concept is now a single normalized request
field `dangerouslySkipPermissions`, resolved once by the broker
(`input → server options → false`), and each adapter translates it to its own
CLI flag:

- codex: `--dangerously-bypass-approvals-and-sandbox`
- opencode / agy / claude: `--dangerously-skip-permissions`
- gemini: `--yolo` (not yet wired; deprecated)

This is opt-in per request, set by the caller (the bridge is unattended, so the
caller declares it) — not hardcoded in any adapter.

## Known gotchas / blockers

- **The MCP server connected to a running Claude session is stale.** It is
  started once at session start, so code changes (e.g. the new `agy` provider)
  are not reflected until the MCP server is restarted. `providers` listing
  without `agy` is the tell.
- **codex live is quota-blocked** (OpenAI usage limit) — cannot validate codex
  success live until quota resets / a different account.
- **agy/Antigravity is a full agent, not a completion endpoint.** With
  `--add-dir <cwd>` it will explore the repo on a vague prompt and can exceed a
  short timeout. Give it generous `route.timeoutMs` and expect agentic behavior.
- Tests run under `tsx`; plain `node --test` will fail once any file in the
  graph is `.ts`. Always use `npm test`.

## Helper scripts (not shipped, for validation)

- `scripts/smoke.mjs` — dry-run by default, `--live <provider>` for a real run.
- `scripts/live-validations.mjs` — live validation across all registered CLIs
  or a selected subset, with environment failure classification (`session-limit`,
  `quota-or-rate-limit`, `auth`, `cli-unavailable`, `timeout`, etc.).
  Provider probes can differ: `agy` uses `agy --version` so the smoke check does
  not trigger its agentic `--print` behavior.
- `scripts/validate-matrix.mjs` — `<provider> <model> [timeoutMs]`, prints a
  one-line ok/text/err result. Used for the provider+model matrix above.
