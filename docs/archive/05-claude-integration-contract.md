# Claude Integration Contract

This document describes how native Claude workflows should call the bridge.

## Primary integration

Claude Dynamic Workflow keeps using `agent()`:

```js
const result = await agent(prompt, {
  label: 'create:iter1',
  phase: 'Create',
  schema: PROMPT_SCHEMA,
  agentType: 'workflow-cli-router',
})
```

The `workflow-cli-router` Claude subagent calls the MCP broker tool and returns
the broker's `data` field to the workflow.

## Source-of-truth rule

The source workflow remains in:

```txt
.claude/workflows/*.js
```

The bridge must not require the workflow to be rewritten into:

- Codex skills
- Gemini skills
- OpenCode agents
- YAML pipelines
- shell scripts

## Agent prompt loading

When the original workflow uses a domain-specific `agentType`, the broker should
load the matching Claude agent file:

```txt
.claude/agents/vastitas-creator.md
.claude/agents/vastitas-critic.md
```

The agent markdown frontmatter supplies:

- name
- description
- tools
- model hint

The body supplies the provider system prompt.

## Two possible integration modes

### Mode A: proxy replaces domain agent files

The existing agent file, for example `vastitas-creator.md`, becomes a proxy that
calls the broker with `agentType: vastitas-creator`.

Pros:

- workflow source can stay unchanged
- existing `agentType` labels keep working

Cons:

- original domain prompt must move to another file or be embedded in broker
  config
- less clean separation between proxy and domain instructions

### Mode B: workflow calls a stable router agent

The workflow calls `agentType: workflow-cli-router`, while route config points to
the real domain prompt.

Pros:

- clean proxy architecture
- domain prompts stay as data
- easier to add provider routing

Cons:

- requires small workflow edits
- not a zero-change bridge for existing workflows

## Recommendation

Use Mode B for new workflows and Mode A only where zero workflow edits are
required.

For `portfolio-blog`, Mode B is architecturally cleaner, but Mode A may be used
temporarily if preserving the exact workflow file is more important during the
first validation.

## MCP tool request

The proxy agent should call:

```json
{
  "tool": "code_cli_bridge.run_agent",
  "arguments": {
    "workflow": "generate-blog-image",
    "phase": "Create",
    "label": "create:iter1",
    "agentType": "vastitas-creator",
    "prompt": "...",
    "schema": {},
    "cwd": "/path/to/portfolio-blog",
    "attachments": []
  }
}
```

## Proxy agent behavior

The proxy agent must:

1. avoid interpreting the task itself
2. avoid editing files directly unless explicitly routed to Claude
3. call the broker tool with structured arguments
4. return only the structured broker data when the workflow expects schema
5. return clear failure text when no schema is expected

## Open concern

Claude workflow `agent()` structured output may expect the subagent itself to
call Claude's `StructuredOutput` tool. If the proxy receives structured data
from MCP, it must still return it in the exact way Claude's workflow runtime
accepts for `options.schema`.

This needs a spike:

1. create minimal workflow with `agent(..., { schema, agentType: 'router' })`
2. router calls MCP dry-run
3. verify whether Claude accepts the returned data as structured output
4. if not, make router explicitly emit structured output in Claude's expected
   format

