# Plugin Installation

This project is also a local Codex plugin.

## Included plugin structure

```txt
.codex-plugin/plugin.json
.mcp.json
.agents/plugins/marketplace.json
skills/clibridge/SKILL.md
```

The plugin manifest exposes:

- the `clibridge` skill
- the `clibridge` MCP server

The local marketplace points to the current project root with:

```json
{
  "source": {
    "source": "local",
    "path": "."
  }
}
```

This keeps local development simple: edits in this repository are edits to the
plugin source.

## Install from this local marketplace

From anywhere:

```bash
codex plugin marketplace add /path/to/clibridge
codex plugin add clibridge@clibridge-local
```

Restart Codex or start a new thread after installation so skills and MCP tools
are loaded into the session.

## Validate the plugin

From this repository:

```bash
python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
npm test
```

## Development update flow

During local iteration, update the Codex plugin cachebuster before reinstalling:

```bash
python3 ~/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py .
codex plugin add clibridge@clibridge-local
```

Then start a new Codex thread to pick up the new plugin metadata.

