---
name: workflow-cli-bridge
description: Use when designing, testing, or integrating the Claude Workflow CLI Bridge MCP broker that routes Claude Dynamic Workflow agent work to Codex, OpenCode, Gemini CLI, or Claude. Trigger for "workflow bridge", "Claude workflow CLI bridge", "code_cli_bridge", adapter routes, provider adapters, or bridge MCP setup.
---

# Workflow CLI Bridge

Use this skill when working on the Claude Workflow CLI Bridge project.

## Core Architecture

The bridge keeps Claude Dynamic Workflow files as the source of truth and routes
selected agent work to local CLIs through a broker:

```txt
Claude Dynamic Workflow
  -> Claude proxy subagent
  -> MCP tool code_cli_bridge.run_agent
  -> local broker
  -> provider adapter
  -> Codex/OpenCode/Gemini/Claude
```

Do not migrate `.claude/workflows/*.js` into skills or shell scripts.

## Primary Commands

From the plugin/project root:

```bash
npm test
npm run mcp
node -e "import('./src/mcp/create-server.ts').then(({ createMcpServer }) => console.log(Boolean(createMcpServer())))"
```

## Important Files

- `docs/01-architecture-spec.md`: architecture direction.
- `docs/03-gotchas-and-non-goals.md`: constraints and paths to avoid.
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
