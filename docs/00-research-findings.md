# Research Findings

This file captures the verified constraints that drive the architecture.

## Local environment observed

Installed local CLIs:

```txt
claude 2.1.177
codex-cli 0.139.0
gemini 0.45.2
opencode 1.15.4
```

Local paths observed:

```txt
~/.local/bin/claude
~/.nvm/versions/node/v20.19.4/bin/codex
~/.nvm/versions/node/v20.19.4/bin/gemini
~/.opencode/bin/opencode
```

## Source workflow shape observed

The concrete workflow inspected in `portfolio-blog` uses a small subset of the
Claude Dynamic Workflow surface:

- `export const meta = ...`
- global `args`
- `phase(name)`
- `log(message)`
- `agent(prompt, options)`
- JSON schemas passed through `options.schema`
- `options.model`
- `options.agentType`
- a serial `while` loop
- top-level `return`

It does not currently use:

- `parallel()`
- `pipeline()`
- nested workflow calls
- remote isolation
- custom timers

## Claude workflow runtime facts

Official Claude docs describe Dynamic Workflows as JavaScript files that
orchestrate agents. Workflow scripts keep logic and state outside the model
context; agents do the file, shell, and analysis work.

Local binary inspection also shows internal workflow runtime symbols and error
strings such as:

- `workflow_agent`
- `workflow_phase`
- `workflow_log`
- `StructuredOutput`
- `agent({schema}) received an invalid JSON Schema`
- `agent({schema}): subagent completed without calling StructuredOutput`
- `parallel() expects an array of functions`
- deterministic restrictions around `Date.now()`, `new Date()`, and
  `Math.random()`

Interpretation: Claude's workflow runtime is a real internal runtime, not a
plain Node script. It should not be treated as a public library unless Anthropic
exposes it explicitly.

## Provider CLI capability summary

### Claude CLI

Useful facts from `claude --help`:

- non-interactive mode: `claude -p`
- output formats: `text`, `json`, `stream-json`
- structured output: `--json-schema <schema>`
- agent selection: `--agent`
- custom agent definitions: `--agents <json>`
- permission modes and tool allow/deny flags exist
- `--safe-mode` disables customizations including workflows

Claude can be used as fallback and as the native workflow host.

### Codex CLI

Useful facts from the current Codex manual and `codex exec --help`:

- non-interactive mode: `codex exec`
- structured output: `--output-schema <FILE>`
- final output file: `--output-last-message <FILE>`
- event stream: `--json`
- image attachments: `--image <FILE>`
- workspace root: `--cd <DIR>`
- sandbox modes: `read-only`, `workspace-write`, `danger-full-access`

Codex is a strong first adapter because it has native JSON Schema output and
image attachment support.

## Gemini CLI

Useful facts from `gemini --help`:

- non-interactive mode: `gemini -p`
- output formats: `text`, `json`, `stream-json`
- approval modes: `default`, `auto_edit`, `yolo`, `plan`
- skills, hooks, and extensions exist

Current concern: the CLI JSON output is an execution envelope, not proven native
payload validation against arbitrary JSON Schema. Treat schema support as
wrapper-enforced until official CLI schema support is verified.

## OpenCode

Useful facts from `opencode run --help`:

- non-interactive mode: `opencode run`
- JSON events: `--format json`
- model routing: `--model`
- agent routing: `--agent`
- file attachments: `--file`
- working directory: `--dir`
- permission bypass flag exists

OpenCode should be evaluated through both CLI and SDK. The SDK path is likely
stronger for structured output and stable programmatic integration.

## Evidence sources

- Claude Dynamic Workflows: https://code.claude.com/docs/en/workflows
- Claude MCP: https://code.claude.com/docs/en/mcp
- Claude subagents: https://code.claude.com/docs/en/sub-agents
- Codex non-interactive mode: https://developers.openai.com/codex/noninteractive
- Codex skills: https://developers.openai.com/codex/skills
- Codex hooks: https://developers.openai.com/codex/hooks
- OpenCode CLI docs: https://opencode.ai/docs/cli/
- OpenCode SDK docs: https://opencode.ai/docs/sdk/
- Gemini CLI docs: https://geminicli.com/docs/

