---
name: clibridge
description: Use when designing, testing, or integrating the clibridge MCP broker that routes Claude Dynamic Workflow agent work to Codex, OpenCode, Gemini CLI, or Claude. Trigger for "workflow bridge", "clibridge", "cli_bridge", adapter routes, provider adapters, or bridge MCP setup.
---

# CLI Bridge (clibridge)

Use this skill when working on the clibridge project.

## Core Architecture

The bridge keeps Claude Dynamic Workflow files as the source of truth and routes
selected agent work to local CLIs through a broker:

```txt
Claude Dynamic Workflow
  -> Claude proxy subagent
  -> MCP tool clibridge.run_agent
  -> local broker
  -> provider adapter
  -> Codex/OpenCode/Gemini/Claude
```

Do not migrate `.claude/workflows/*.js` into skills or shell scripts.

## Dynamic Discovery & CLI Usage

Rather than relying on static documentation that may become outdated, you should query the local `bridge-cli` tool to inspect registered workflows, phase schemas, and contract rules at runtime:

```bash
# List all registered workflows in the project
node --import tsx bin/bridge-cli.mjs list

# Inspect a specific workflow's phases and capabilities
node --import tsx bin/bridge-cli.mjs info <workflow-name>

# Print the formal generic executor contract
node --import tsx bin/bridge-cli.mjs doc

# Run a declarative JSON workflow directly (useful for testing)
node --import tsx bin/bridge-cli.mjs run <workflow-path> --task "description" [--dry-run]
```

## Important Files

- `docs/architecture.md`: architecture direction.
- `docs/gotchas.md`: constraints and paths to avoid.
- `src/broker/run-agent.ts`: broker entry point.
- `src/mcp/create-server.ts`: MCP tool registration.
- `src/adapters/`: provider adapters.
- `examples/portfolio-blog.routes.json`: example route config.

## Working Rules

- Keep provider-specific logic inside adapters.
- Keep route selection deterministic and config-driven.
- Validate structured output with JSON Schema before returning success.
- Treat Gemini schema support as wrapper-enforced unless verified otherwise.
- Do not assume Claude's native workflow `agent()` can be monkey-patched.
- Prefer tests with dry-run or mock adapters before live CLI calls.
- Do not use emojis in responses; keep all communication clean, professional, and direct.
