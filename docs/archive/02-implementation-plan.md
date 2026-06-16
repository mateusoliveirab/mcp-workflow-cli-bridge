# Implementation Plan

## Phase 0: Decisions and fixture capture

Status: current.

Deliverables:

- architecture documents
- source workflow fixture from `portfolio-blog`
- source agent fixture from `.claude/agents`
- provider capability matrix
- routing examples

Exit criteria:

- documented primary architecture
- documented non-goals
- explicit gotchas list

## Phase 1: MCP broker skeleton

Build a local MCP server exposing:

- `clibridge.run_agent`
- `clibridge.validate_route`
- `clibridge.providers`

Initial implementation can be Node.js ESM.

Suggested layout:

```txt
src/
  mcp-server.mjs
  broker/
    run-agent.mjs
    routing.mjs
    schema-validation.mjs
    audit-log.mjs
  adapters/
    codex.mjs
    claude.mjs
    opencode.mjs
    gemini.mjs
  claude/
    agent-loader.mjs
    prompt-assembler.mjs
  config/
    load-config.mjs
schemas/
  run-agent-request.schema.json
  run-agent-response.schema.json
examples/
  portfolio-blog.routes.json
```

Exit criteria:

- MCP server starts locally
- tool schema is visible to Claude
- dry-run provider returns normalized envelope

## Phase 2: Codex adapter

Implement Codex first because it has the strongest CLI fit for this project:

- `codex exec`
- `--output-schema`
- `--output-last-message`
- `--image`
- `--cd`
- `--sandbox`

Adapter responsibilities:

- write temporary schema file when needed
- write final output to temp file
- pass image attachments when present
- parse final JSON when schema exists
- parse JSONL when `--json` is enabled
- classify failures

Exit criteria:

- structured `Extract` fixture passes
- structured `Create` fixture passes
- image `Critique` fixture can receive an image attachment

## Phase 3: Claude native integration

Create a Claude proxy subagent, for example:

```txt
.claude/agents/workflow-cli-router.md
```

The proxy agent should:

- receive the original workflow prompt
- call the MCP tool
- return only the broker response data to the workflow
- preserve structured output behavior when the workflow expects schema

Exit criteria:

- Claude workflow can call the proxy subagent
- proxy can route one phase to Codex
- workflow source requires minimal or no semantic change

Important open design question:

Claude `agent()` selects subagents through `agentType`. If an existing workflow
uses domain agents like `vastitas-creator`, either:

1. those agents become proxy agents that call the broker, or
2. workflow source uses a stable proxy `agentType` and passes the domain
   `agentType` in prompt/config.

The first option preserves workflow source better but modifies existing agent
files. The second option is cleaner but may require workflow edits.

## Phase 4: OpenCode adapter

Evaluate two paths:

- CLI path: `opencode run --format json --agent --model --file --dir`
- SDK path: preferred if structured output and lifecycle handling are stronger

Exit criteria:

- same broker contract as Codex
- schema validation either native or wrapper-enforced
- failure classification works

## Phase 5: Gemini adapter

Implement only after Codex and OpenCode are stable.

Expected shape:

- `gemini -p`
- `--output-format json`
- wrapper-enforced JSON extraction
- AJV validation
- retry with strict repair prompt

Exit criteria:

- non-schema text phase works
- schema phase works through wrapper validation and retry
- unsupported attachment/schema cases fail with explicit error

## Phase 6: External workflow runner

Build only after the broker is stable.

Purpose:

- CI
- dry-run
- local tests outside Claude
- fixture replay

Supported subset:

- `meta`
- `args`
- `phase`
- `log`
- `agent`
- top-level `return`

Not initially supported:

- resume snapshots
- native Claude UI
- remote isolation
- full deterministic VM restrictions
- nested workflows
- `parallel`
- `pipeline`

Exit criteria:

- can execute the portfolio-blog fixture outside Claude
- output matches expected normalized broker calls

