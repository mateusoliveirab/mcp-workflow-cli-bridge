# Documentation Map

Welcome to the documentation for the MCP Workflow CLI Bridge. This folder organizes technical specs, design logs, and reference guides.

---

## 📖 Core Reference Docs

These documents describe the current, stable state of the bridge:

*   **[Architecture Spec](file:///home/ubuntu/repos/mcp-workflow-cli-bridge/docs/architecture.md)** — Core design principles, routing engine, and contract definitions.
*   **[Known Gotchas & Constraints](file:///home/ubuntu/repos/mcp-workflow-cli-bridge/docs/gotchas.md)** — Non-obvious constraints regarding execution VMs, shell environments, and model mappings.
*   **[Plugin Installation Guide](file:///home/ubuntu/repos/mcp-workflow-cli-bridge/docs/plugin-installation.md)** — Guide on loading the bridge as a local Codex plugin.

---

## 🗄️ Archive (Historical Plans & Findings)

These files capture the initial research phase and implementation waves. They are preserved for historical context but may contain outdated descriptions:

*   **[Research Findings](file:///home/ubuntu/repos/mcp-workflow-cli-bridge/docs/archive/00-research-findings.md)** — Local environment discovery logs.
*   **[Implementation Plan](file:///home/ubuntu/repos/mcp-workflow-cli-bridge/docs/archive/02-implementation-plan.md)** — Initial milestones (Phases 0 to 6).
*   **[Provider Adapter Contract](file:///home/ubuntu/repos/mcp-workflow-cli-bridge/docs/archive/04-provider-adapter-contract.md)** — Blueprint for adapter inputs/outputs.
*   **[Claude Integration Contract](file:///home/ubuntu/repos/mcp-workflow-cli-bridge/docs/archive/05-claude-integration-contract.md)** — Subagent integration details.
*   **[Implementation Status Logs](file:///home/ubuntu/repos/mcp-workflow-cli-bridge/docs/archive/07-implementation-status.md)** — Handoff record.

---

## 🛠️ Modifying Documentation

We follow the **Docs-as-Code** philosophy:
1. All changes to architecture or routing contracts should be proposed via a Pull Request.
2. Major decisions should be captured as **Architecture Decision Records (ADRs)** in `/docs/adr/`.
