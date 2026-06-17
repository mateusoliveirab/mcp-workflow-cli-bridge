# GitHub Contribution Workflow

**Purpose:** turn a task or issue into a scoped repository contribution with branch isolation, validation, review, PR description, and optional publishing.

The intended contributor persona is a **code architecture developer**: someone who understands the repo's design, keeps diffs scoped to ownership boundaries, validates behavior, and writes PRs that maintainers can review confidently.

## When to Use

Use this workflow when the output should become a GitHub pull request for a specific repository. It is designed for public-repo work where correctness, architectural fit, traceability, and clean contribution hygiene matter.

## Shape

The workflow has nine phases:

1. **rules**: reads configured contribution files and blocks disallowed change types before implementation.
2. **preflight**: verifies the repository state and creates or selects a contribution branch.
3. **plan**: asks an architect provider for a short implementation plan.
4. **implement**: asks a writer provider to make the scoped code change.
5. **validate**: runs the repo-specific validation commands from `.bridge/contribution-workflow.json`.
6. **stress**: runs heavier pre-push or CI-like commands before review/publish.
7. **review**: reviews the real diff for correctness, professionalism, and test gaps.
8. **describe**: writes a PR or issue title/body from the actual rules, plan, validation, stress output, review, and diff.
9. **publish**: skipped by default; with `--publish` and `WORKFLOW_CONFIRM=1`, creates the configured GitHub artifact.

## Repo Config

Each repository can define `.bridge/contribution-workflow.json`:

```json
{
  "repository": {
    "name": "clibridge",
    "defaultBranch": "main",
    "publicRepo": true
  },
  "contribution": {
    "branchPrefix": "contrib/",
    "requireCleanWorktree": true,
    "allowPublish": true,
    "draftPr": true
  },
  "validation": {
    "commands": ["npm run typecheck", "npm test"],
    "stressCommands": ["npm run smoke"]
  },
  "policy": {
    "issueFirstChangeTypes": ["feature", "architecture", "dependency"],
    "blockedChangeTypes": ["refactor-only", "test-ci-only"],
    "requireMaintainerOkForIssueFirst": true,
    "requireRealBehaviorProof": true,
    "requireReproductionForBugfix": true,
    "requireChangelogForUserFacing": false
  }
}
```

## MCP Executor Path

For MCP clients, use the generic executor tool with a workflow file:

```json
{
  "workflowPath": "/home/ubuntu/repos/clibridge/examples/headroom-contribution.workflow.json",
  "cwd": "/home/ubuntu/repos/workbench-claude/headroom",
  "task": "fix the failing wrap prepare-only path",
  "dryRun": true,
  "inputs": {
    "changeType": "bugfix",
    "publishTarget": "pr"
  }
}
```

This calls `run_workflow`. The MCP server remains a generic executor; it does not expose Headroom-specific tools.

## Headroom Preset

`examples/headroom-contribution.workflow.json` is the executable workflow file for the public Headroom repo. `examples/headroom.contribution-workflow.json` remains a repo-specific contribution config/preset.

The Headroom workflow captures these rules observed from its repo:

- bug fixes and small fixes can go straight to PR, but need reproduction plus a test;
- features, architecture changes, and dependency changes require an issue or maintainer approval first;
- refactor-only and test/CI-only PRs are blocked unless a maintainer asked for them;
- every external PR needs a `Real Behavior Proof` section;
- validation runs `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy headroom --ignore-missing-imports`, and `uv run pytest`;
- stress validation runs `uv run make ci-precheck`, which mirrors Headroom's pre-push gate across Rust, Python, and commitlint.

From a Headroom clone, the CLI reference runner can still use the config preset explicitly:

```bash
node /home/ubuntu/repos/clibridge/bin/bridge-contribute.mjs \
  --config /home/ubuntu/repos/clibridge/examples/headroom.contribution-workflow.json \
  --dry-run \
  --change-type bugfix \
  "fix the failing wrap prepare-only path"
```

For feature or architecture work, start with an issue/spec instead of implementation:

```bash
WORKFLOW_CONFIRM=1 node /home/ubuntu/repos/clibridge/bin/bridge-contribute.mjs \
  --config /home/ubuntu/repos/clibridge/examples/headroom.contribution-workflow.json \
  --publish --publish-target issue \
  --change-type architecture \
  "propose a safer MCP install migration path"
```

## Safety Model

The workflow applies the Headroom setup lessons directly:

- validate live behavior, not only installed files;
- fail instead of masking provider/config errors;
- keep persistent config separate from runtime state;
- record phase state in `.bridge-runs/`;
- run stress gates before preparing publish artifacts;
- do not publish externally unless `--publish` and `WORKFLOW_CONFIRM=1` are both present.

## Usage

Client-neutral entrypoint:

```bash
node bin/bridge-contribute.mjs --dry-run "add a config loader test"
```

Claude Code workflow path, equivalent behavior:

```bash
node --import tsx .claude/workflows/github-contribution.mjs --dry-run "add a config loader test"
```

Create a local branch and run the full local workflow:

```bash
node bin/bridge-contribute.mjs "add a config loader test"
```

Publish after checking the local result:

```bash
WORKFLOW_CONFIRM=1 node bin/bridge-contribute.mjs --publish "add a config loader test"
```
