<h1 align="center">clibridge</h1>

<p align="center">
  <img src="https://github.com/mateusoliveirab/clibridge/actions/workflows/ci.yml/badge.svg" alt="CI" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-blue" alt="node" />
  <img src="https://img.shields.io/badge/typescript-5.x-blue" alt="typescript" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
  <img src="https://img.shields.io/badge/mcp-supported-orange" alt="mcp" />
</p>

A local Model Context Protocol (MCP) server that acts as a dispatch hub, routing tasks to coding agent CLIs installed on your local machine (`claude`, `codex`, `opencode`, `gemini`, `agy`).

It provides capability-based routing, CLI availability discovery, strict JSON Schema output validation, automatic execution retries, and a normalized response envelope.

## Table of Contents

- [Problem & Context](#problem--context)
- [How It Works](#how-it-works)
- [Supported Providers & Capabilities](#supported-providers--capabilities)
- [Installation & Client Configuration](#installation--client-configuration)
  - [Claude Desktop](#1-claude-desktop)
  - [Claude Code](#2-claude-code)
  - [Codex Plugin](#3-codex-plugin)
  - [Cursor / Windsurf](#4-cursor--windsurf)
- [MCP Tools Spec](#mcp-tools-spec)
  - [`clibridge.providers`](#clibridgeproviders)
  - [`clibridge.run_agent`](#clibridgerun_agent)
- [Routing Configuration](#routing-configuration)
- [Security & Sandbox Guidelines](#security--sandbox-guidelines)
- [Development & Testing](#development--testing)
- [Contributing](#contributing)
- [Changelog](#changelog)

## Problem & Context

Claude Code Dynamic Workflows (`.claude/workflows/*.js`) and other MCP clients often need to delegate sub-tasks to specialized CLI engines—e.g., Codex for structured output with image analysis, or OpenCode for lightweight generation—without hardcoding provider-specific APIs or rewriting execution logic for each different client environment.

The **clibridge** solves this by abstracting local CLI tool execution behind a standardized MCP interface.

## How It Works

```
Claude Dynamic Workflow (.claude/workflows/*.js)
  -> agent() call with agentType: "workflow-cli-router"
  -> .claude/agents/workflow-cli-router.md (Claude subagent)
  -> MCP tool: clibridge.run_agent
  -> broker: routing + schema validation + retry
  -> provider adapter (claude | codex | opencode | gemini | agy)
  -> local CLI process
  -> normalized response envelope
```

> [!NOTE]
> **What this project is not:**
> - It does **not** port the Claude workflow runtime to other clients; `.claude/workflows/*.js` continues to run natively within Claude Code.
> - It is **not** a persistent background daemon. One process is spawned per MCP session.

## Supported Providers & Capabilities

Below is the capabilities matrix for the supported local CLI engines:

| Provider CLI | structuredOutput | images | sandbox | skipPermissions |
| :--- | :---: | :---: | :---: | :---: |
| **claude** | Yes | - | - | Yes |
| **codex** | Yes | Yes | Yes | Yes |
| **gemini** | Yes | - | - | - |
| **opencode** | Yes | Yes | - | Yes |
| **agy** | - | - | Yes | Yes |

*If a call requires a capability the target provider does not support (e.g., passing a `schema` to `agy`), the broker rejects the request with a validation error before spawning any process.*

## Installation & Client Configuration

### Prerequisites
- Node.js >= 20.19.4
- Local installation of the CLI engines you plan to use (e.g., `claude`, `codex`, etc.) available on your system `PATH`.

```bash
git clone https://github.com/mateusoliveirab/clibridge.git
cd clibridge
npm install
```

### 1. Claude Desktop
Add the server configuration to your `claude_desktop_config.json`:

**MacOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "clibridge": {
      "command": "node",
      "args": ["--import", "tsx", "/absolute/path/to/clibridge/src/mcp-server.ts"]
    }
  }
}
```

### 2. Claude Code
To use this inside Claude Code, define the server in your project's local `.mcp.json` configuration file:

```json
{
  "mcpServers": {
    "clibridge": {
      "cwd": ".",
      "command": "node",
      "args": ["--import", "tsx", "/absolute/path/to/clibridge/src/mcp-server.ts"]
    }
  }
}
```
Then, create `.claude/agents/workflow-cli-router.md` to map agent work to `clibridge.run_agent`.

### 3. Codex Plugin
You can add the bridge directly as a Codex plugin:

```bash
codex plugin marketplace add /path/to/clibridge
codex plugin add clibridge@clibridge-local
```

### 4. Cursor / Windsurf
In Cursor/Windsurf, navigate to **Settings** -> **Features** -> **MCP** and add a new MCP Server:
- **Name**: `clibridge`
- **Type**: `command`
- **Command**: `node --import tsx /absolute/path/to/clibridge/src/mcp-server.ts`

## MCP Tools Spec

### `clibridge.providers`
Returns all registered provider adapters, their capabilities, and whether their CLI binaries are available on the user's `PATH`.

### `clibridge.run_agent`
Runs a task on the targeted provider.

#### Parameters:

| Field | Type | Required | Description |
| :--- | :---: | :---: | :--- |
| `prompt` | `string` | **Yes** | Task instruction/prompt |
| `cwd` | `string` | **Yes** | Working directory for the CLI process |
| `workflow` | `string` | **Yes** | Name of the active workflow (for logging) |
| `phase` | `string` | **Yes** | Active workflow phase (used for route matching) |
| `label` | `string` | **Yes** | Step label (for logging) |
| `provider` | `string` | No | Overrides routing config to target a specific provider |
| `schema` | `object` | No | JSON Schema to strictly validate provider output against |
| `attachments` | `object[]` | No | List of attachment inputs, e.g. `[{"type": "image", "path": "path/to/img.png"}]` |

#### Example Call:
```json
{
  "workflow": "blog-pipeline",
  "phase": "Generate",
  "label": "generate:iter1",
  "cwd": "/path/to/project",
  "prompt": "Generate a blog post about TypeScript performance",
  "provider": "codex",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "body": { "type": "string" }
    },
    "required": ["title", "body"]
  }
}
```

### `clibridge.run_workflow`
Runs a declarative workflow file through the generic MCP workflow executor. This is the preferred interface when a client wants to execute a full workflow instead of a single provider task.

The MCP server exposes one workflow executor, not one tool per workflow. Repository-specific behavior belongs in the workflow file and its inputs.

#### Parameters:

| Field | Type | Required | Description |
| :--- | :---: | :---: | :--- |
| `workflowPath` | `string` | **Yes** | Absolute or caller-resolvable path to a JSON workflow file |
| `cwd` | `string` | **Yes** | Target repository where phases and shell commands run |
| `task` | `string` | **Yes** | User task or contribution objective |
| `dryRun` | `boolean` | No | If true, agent phases and shell commands are simulated |
| `inputs` | `object` | No | Workflow-specific inputs such as `changeType`, `publishTarget`, or `issue` |
| `routeConfigPath` | `string` | No | Optional route config for provider selection |

#### Example Call:
```json
{
  "workflowPath": "/home/ubuntu/repos/clibridge/examples/headroom-contribution.workflow.json",
  "cwd": "/home/ubuntu/repos/workbench-claude/headroom",
  "task": "fix the wrap prepare-only path",
  "dryRun": true,
  "inputs": {
    "changeType": "bugfix",
    "publishTarget": "pr"
  }
}
```

## Routing Configuration

Create a `route-config.json` at your repository root to govern automatic tool execution routing:

```json
{
  "defaultProvider": "opencode",
  "routes": [
    { "phase": "Extract", "provider": "codex" },
    { "phase": "Generate", "provider": "opencode" }
  ]
}
```
If no route configuration matches, the broker will auto-select a provider *only* if exactly one available CLI satisfies the requested capabilities.

## Contribution Workflow

For repository contribution work, the bridge includes a client-neutral workflow entrypoint:

```bash
node bin/bridge-contribute.mjs --dry-run "add a focused test for route selection"
```

This runs the reference `github-contribution` CLI workflow as a code architecture developer. For MCP clients, prefer `clibridge.run_workflow` with a JSON workflow file such as `examples/headroom-contribution.workflow.json`. Headroom-specific rules live in workflow/config files, not in a dedicated MCP tool.

## CLI Utilities

The bridge includes command-line tools to monitor executions and discover workflows dynamically:

### Generic CLI (`bridge-cli`)
Inspect and execute workflows natively:
```bash
node --import tsx bin/bridge-cli.mjs list                  # List registered workflows
node --import tsx bin/bridge-cli.mjs info <workflow-name>  # Inspect phase details
node --import tsx bin/bridge-cli.mjs doc                   # View the generic executor specification
node --import tsx bin/bridge-cli.mjs run <workflow-path> --task "prompt"  # Run a workflow directly
```

### Live Run TUI Monitor (`bridge-monitor`)
Tails and visualizes the state of current or past runs in your terminal:
```bash
node --import tsx bin/bridge-monitor.mjs            # Live TUI tailing active runs
node --import tsx bin/bridge-monitor.mjs --once     # Single terminal frame print
node --import tsx bin/bridge-monitor.mjs --run <id> # Focus a specific run
```

## Security & Sandbox Guidelines

> [!WARNING]
> Because this bridge executes local CLI commands on your host system:
> 1. Use providers supporting sandboxing (e.g., `codex`, `agy` with sandbox flags) when executing untrusted workflow instructions.
> 2. Ensure sensitive files (`.env`, `credentials.json`) are excluded in your project configurations.
> 3. Limit the permissions granted to local agent sessions.

## Development & Testing

Run the local test suite and static checks:
```bash
npm install
npm test                   # Run unit tests via node:test
npm run test:coverage      # Run unit tests with a code coverage report
npm run typecheck          # Strict TypeScript checks
```

Validate provider connectivity without spawning actual CLI tasks:
```bash
npm run smoke
```

Validate live provider adapters strictly (tests the actual binary directly, bypassing fallbacks):
```bash
npm run live:validate
npm run live:validate:claude
```

## Contributing

See our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on developer setup, coding style, and test validations.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.


For a full list of changes and releases, see [CHANGELOG.md](CHANGELOG.md).
