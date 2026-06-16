# Architecture Spec

## Problem

Claude Code Dynamic Workflows are useful because they provide procedural
orchestration around agents. Other local CLIs can be stronger or cheaper for
some work, but they do not run inside Claude's workflow runtime.

We need a bridge that lets a Claude workflow delegate selected work to other
local CLIs while preserving the `.claude/workflows/*.js` file as the source of
truth.

## Non-negotiable constraints

1. Do not migrate workflow files to another format.
2. Do not depend on private Claude runtime internals.
3. Keep provider-specific behavior behind adapters.
4. Enforce structured output with validation, retries, and audit logs.
5. Keep file and shell permissions explicit per phase/provider.
6. Keep the design usable from inside native Claude workflows.

## Recommended architecture

Use Claude's native workflow runtime as the orchestration layer and expose other
CLIs through a local MCP broker.

```txt
.claude/workflows/generate-blog-image.js
  calls agent(...)

.claude/agents/workflow-cli-router.md
  calls MCP tool: clibridge.run_agent(...)

clibridge MCP server
  validates request
  loads routing config
  loads agent prompts
  chooses provider adapter
  executes CLI
  validates output
  writes audit log
  returns structured result

provider adapters
  codex
  opencode
  gemini
  claude
```

## Why this is the primary architecture

Claude already owns the workflow semantics: phases, resume behavior,
background execution, snapshots, agent limits, and user-facing workflow UI.

MCP is the stable extension boundary for connecting Claude to local tools. A
broker exposed through MCP can be called by Claude subagents today and reused by
other surfaces later.

Adapters isolate CLI churn. If Codex, Gemini, or OpenCode changes flags or
output shape, the workflow remains unchanged.

## Secondary architecture

An external workflow executor can be built later:

```txt
bridge run .claude/workflows/generate-blog-image.js --args ...
```

This executor would emulate a subset of the Claude workflow globals:

- `args`
- `phase()`
- `log()`
- `agent()`
- eventually `parallel()` and `pipeline()`

This is useful for CI, dry-runs, tests, or running outside Claude. It should not
be the first production architecture because it duplicates Claude runtime
semantics and will always lag behind native workflow behavior.

## Core broker responsibilities

The broker owns:

- provider routing
- schema validation
- prompt assembly
- `.claude/agents/*.md` parsing
- attachments
- sandbox/permission policy
- timeout policy
- retry policy
- output normalization
- failure classification

Planned (not yet implemented):

- concurrency limits
- audit logs

The broker does not own:

- Claude workflow parsing in the primary path
- Claude workflow UI
- Claude resume/snapshot behavior
- arbitrary prompt rewriting
- secret management beyond safe environment scoping

## Routing dimensions

Routing can be selected by:

- workflow name
- phase
- agent label
- `agentType`
- requested model alias
- schema presence
- attachment presence
- write permissions needed

Example:

```json
{
  "defaultProvider": "codex",
  "routes": [
    { "phase": "Extract", "provider": "codex", "sandbox": "read-only" },
    { "agentType": "vastitas-creator", "provider": "opencode" },
    { "phase": "Critique", "provider": "codex", "requiresImages": true },
    { "phase": "Generate", "provider": "codex", "sandbox": "workspace-write" },
    { "phase": "Save", "provider": "claude", "sandbox": "workspace-write" }
  ]
}
```

## Output contract

Every provider returns a normalized envelope:

```json
{
  "ok": true,
  "provider": "codex",
  "model": "gpt-5.2-codex",
  "label": "create:iter1",
  "phase": "Create",
  "durationMs": 12345,
  "attempts": 1,
  "structured": true,
  "data": {},
  "text": "",
  "usage": {},
  "artifacts": [],
  "warnings": []
}
```

Errors also use a normalized envelope:

```json
{
  "ok": false,
  "provider": "gemini",
  "label": "critique:iter1",
  "phase": "Critique",
  "errorCode": "SCHEMA_VALIDATION_FAILED",
  "message": "Provider returned JSON that did not match the requested schema.",
  "recoverable": true,
  "attempts": 3,
  "stderrTail": "...",
  "rawOutputPath": "logs/run-id/raw/provider-output.jsonl"
}
```

## Security posture

Default to least privilege:

- read-only for extraction, analysis, critique
- workspace-write for artifact generation and final save
- danger-full-access only in externally sandboxed environments
- provider-specific env allowlists
- no global pass-through of all environment variables by default
- logs redact known secret patterns

## Success criteria

The bridge is successful when:

1. Claude native workflows still run from Claude.
2. A workflow phase can route to Codex/OpenCode/Gemini without changing the
   workflow source file.
3. JSON schema phases fail closed if output is invalid.
4. Logs make it possible to debug provider failures without rerunning blindly.
5. Providers can be swapped through config, not workflow edits.

