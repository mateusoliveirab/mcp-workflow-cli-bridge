# Gotchas And Non-Goals

## Gotcha: `agent()` is not publicly swappable

Claude Dynamic Workflows call Claude's internal `agent()` runtime. There is no
verified public hook that replaces `agent()` with another provider inside the
native workflow VM.

Design implication:

Use Claude subagents as proxy agents that call MCP tools. Do not build on an
assumption that native `agent()` can be monkey-patched.

## Gotcha: external execution is not native workflow execution

Running `.claude/workflows/*.js` in our own Node runtime is possible for a
subset, but it is not equivalent to Claude's native runtime.

Missing native behavior would include:

- workflow UI
- resume snapshots
- internal deterministic VM rules
- structured output tool nudging
- agent permission UX
- cloud/remote isolation behavior

Design implication:

Treat an external runner as a secondary tool for CI/testing, not the primary
bridge.

## Gotcha: JSON output is not JSON Schema output

Different CLIs use "JSON" to mean different things:

- event stream JSON
- final response envelope
- assistant text containing JSON
- actual schema-validated payload

Design implication:

The broker must distinguish:

- provider-native schema enforcement
- wrapper-enforced schema validation
- no schema support

Schema phases must fail closed after bounded retries.

## Gotcha: images and attachments are provider-specific

The inspected workflow asks a critic to read an image path. Some CLIs support
explicit image/file attachments; others rely on tools reading paths from the
workspace.

Design implication:

The broker should detect attachments explicitly and pass them through provider
features when available. If a provider cannot support an attachment, routing
should fail before execution.

## Gotcha: shell permissions differ across CLIs

Workflow phases may require file writes, shell execution, or network access.
Each CLI has different permission controls.

Design implication:

Permission policy belongs in route config, not in prompts.

## Gotcha: provider auth and environment are sensitive

Passing the full environment to local CLIs risks leaking unrelated secrets.

Design implication:

Adapters should use env allowlists by default and document required variables,
for example `GEMINI_API_KEY` for image generation.

## Gotcha: concurrency can break files and rate limits

Workflow loops and future `parallel()` usage can launch multiple expensive
agents or multiple writers.

Design implication:

The broker needs:

- per-provider concurrency limits
- per-workspace write locks
- per-target-file locks
- cancellation support
- max duration per phase

## Gotcha: prompts are not stable APIs

If the proxy subagent has to parse natural language to determine routing, it
will be fragile.

Design implication:

Use explicit structured MCP arguments. Avoid asking the model to infer provider,
schema, or permission policy from prose.

## Gotcha: model aliases are not portable

Claude aliases like `haiku` and `sonnet` do not map cleanly to Codex, Gemini,
or OpenCode providers.

Design implication:

Route by role and capability first, model second. Keep a model alias mapping in
config, not workflow source.

## Non-goals for initial version

- full clone of Claude Dynamic Workflow runtime
- replacing Claude's native `agent()` implementation
- cross-provider memory/session continuity
- full UI integration outside Claude
- automatic migration of workflows into skills
- universal support for every CLI flag
- background daemon management beyond the MCP broker

## Paths explicitly avoided

### Direct Bash wrapper in prompts

This is easy but brittle. It makes the model responsible for command assembly,
stdout parsing, and error handling.

### Workflow file conversion

Converting workflow JS into another format loses the user's source-of-truth
requirement.

### Private runtime hooks

Relying on private Claude internals would be fragile and likely to break on
updates.

