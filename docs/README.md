# Documentation Map

Welcome to the documentation for the MCP Workflow CLI Bridge.

---

## Core Reference Docs

These documents describe the current state of the bridge:

*   **[Architecture Spec](architecture.md)** — Design principles, routing engine, and contract definitions.
*   **[Workflow Executor Contract](workflow-executor-contract.md)** — Generic MCP workflow execution contract and JSON workflow file format.
*   **[Known Gotchas & Constraints](gotchas.md)** — Non-obvious constraints regarding execution VMs, shell environments, and model mappings.
*   **[Plugin Installation Guide](plugin-installation.md)** — Guide on loading the bridge as a local Codex plugin.

## Workflow Patterns

*   **[GitHub Contribution](workflows/github-contribution.md)** — Discover repo rules, branch, implement, validate, stress-test, review, describe, and optionally publish a contribution artifact for a specific repository.

---

## Archive (Historical Plans & Findings)

These files are frozen snapshots from the initial design phase (June 2026). They do not reflect the current implementation:

*   **[Research Findings](archive/00-research-findings.md)** — Local environment discovery logs.
*   **[Implementation Plan](archive/02-implementation-plan.md)** — Initial milestones (Phases 0 to 6).
*   **[Provider Adapter Contract](archive/04-provider-adapter-contract.md)** — Blueprint for adapter inputs/outputs.
*   **[Claude Integration Contract](archive/05-claude-integration-contract.md)** — Subagent integration details.
*   **[Implementation Status Logs](archive/07-implementation-status.md)** — Handoff record.

---

## Modifying Documentation

All changes to architecture or routing contracts should be proposed via a Pull Request.
