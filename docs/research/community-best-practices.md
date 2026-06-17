# Community Best Practices for Local-First CLI Agents & MCP Servers (2024-2025)

As the ecosystem around local-first agent dispatchers and the Model Context Protocol (MCP) matures, several distinct patterns have emerged across prominent tools like OpenCode, Aider, Continue, and Cline. This document synthesizes research into community best practices in architecture, MCP design, open-source governance, testing, and documentation, with specific, actionable applications for the **`clibridge`** project.

---

## 1. Architecture Patterns for Multi-Provider Routing

Modern CLI agents have evolved from monolithic wrappers into modular, provider-agnostic orchestration frameworks.

### Community Patterns
*   **Transport & Coder Pattern (Aider):** Uses a universal transport adapter (like LiteLLM) to normalize interactions across hundreds of models. Routing is "capability-based" where tasks are directed to specific "Coders" (e.g., Diff Coder vs. Whole File Coder) based on the model's known strengths.
*   **Layered SDK & Smart Routing (Cline):** Separates the provider/gateway layer from the agent's core autonomous loop. Features "Traffic Cop" routers that dynamically select providers based on real-time latency, cost, and API drift.
*   **Local-First Middleware (Continue.dev):** Focuses on Context Provider plugins where context gathering (files, diffs, terminal) is heavily localized. Employs "Role-based routing" (e.g., routing tab-autocomplete to a local Ollama model while routing chat to a frontier model like Claude 3.5 Sonnet).

### 🎯 Direct Application to `clibridge`
*   **Adapter Pattern:** `clibridge` should maintain strict abstraction boundaries for its CLIs (`claude`, `codex`, `gemini`, `opencode`, `agy`, `ollama`). Adapters must normalize inputs/outputs so the core broker doesn't care which CLI is executing the task.
*   **Capability-Based Routing:** Implement routing metadata where `clibridge` selects the optimal adapter based on workflow requirements (e.g., routing tasks requiring deep, native codebase integration to `opencode`, and rapid formatting tasks to `gemini` or `claude`).
*   **Declarative Fallbacks:** Ensure the declarative JSON workflows support graceful failover routing (e.g., trying `claude` and falling back to `gemini` if rate-limited).

---

## 2. MCP Server Design & Emerging Standards

The Model Context Protocol (MCP) standardizes how LLMs interact with local environments. 

### Community Patterns
*   **Resources vs. Tools:** 
    *   **Resources** are read-only, idempotent data sources controlled by the host (e.g., `file:///logs/error.log`).
    *   **Tools** are intent-based, model-controlled actions with potential side-effects. The industry trend avoids CRUD-like granularity in favor of high-intent tools (e.g., `get_user_activity_summary` instead of `get_user` + `get_logs`).
*   **Error Envelopes:** A critical pattern for LLM recovery. Protocol-level errors (JSON-RPC crashes) halt the session, whereas application-level errors (e.g., "file not found") are wrapped in a **successful JSON-RPC result** with `isError: true`. This injects the failure directly into the LLM's context, allowing it to self-correct.
*   **Strict Schema Validation:** Never trust LLM inputs. Enforce strict JSON Schema validation via Zod/Pydantic before executing operations. 

### 🎯 Direct Application to `clibridge`
*   **Error Envelopes:** When an adapter command fails (e.g., `agy` throws a validation error), `clibridge` must not crash the MCP server. It should wrap the CLI stderr in an `isError: true` envelope so the orchestrating LLM can attempt a fix.
*   **JSON Schema Workflows:** Use robust schema validation (like `schema-validation.ts`) to ensure the declarative JSON workflows are well-formed before spawning processes. 
*   **Naming Conventions:** Ensure all exported tools follow MCP alphanumeric naming conventions.

---

## 3. Open-Source Contribution Practices

The standard for high-quality open-source CLI projects centers heavily on automated versioning and strict supply-chain security.

### Community Patterns
*   **Changesets-First Workflows:** Projects mandate the use of `changesets` (or `semantic-release`). `CONTRIBUTING.md` files explicitly instruct developers to run `npx changeset` for user-facing changes.
*   **CI Gating:** Multi-stage gating is the norm:
    *   **Changeset Gate:** Fails the PR if a `.changeset` file is missing.
    *   **Quality & Security Gates:** Matrix testing across OS environments, coupled with CodeQL or dependency review actions.
*   **Docs-as-Code:** Requiring documentation updates in the same PR as the feature, enforced via CI.

### 🎯 Direct Application to `clibridge`
*   **`CONTRIBUTING.md` Structure:** Add a "Release Workflow" section detailing how to add a changeset. Create explicit PR and Issue templates that feature checklists for testing and changesets.
*   **CI Gating Strategy:** Implement GitHub Actions that block merges if schemas, declarative workflows, or tests fail. Enforce the presence of changesets for any CLI adapter updates.

---

## 4. Testing methodologies for CLI-Process-Spawning

Testing dispatchers that spawn actual processes is notoriously difficult. The community has established patterns to ensure tests are fast, deterministic, and sandboxed.

### Community Patterns
*   **The "Re-exec" Pattern:** Instead of mocking OS-level execution (`exec`/`spawn`), the test binary sets a special environment variable and spawns *itself*. The helper process emulates the CLI tool (e.g., printing dummy output and exiting), testing the true I/O boundaries without needing external binaries.
*   **Golden File Testing (Snapshotting):** Used for complex CLI outputs. The test captures `stdout` and diffs it against a "golden" file in the repository. An update flag (e.g., `SNAPSHOT_UPDATE=1`) overwrites the file when changes are intentional.
*   **Sandboxing:** Process spawning tests are wrapped in strict Temporary Directories (e.g., `tempfile`, `t.TempDir()`), and environment variables (like `PATH` and `HOME`) are aggressively scrubbed to prevent host leaks.

### 🎯 Direct Application to `clibridge`
*   **Mocking Subprocess Calls:** Implement a standard dependency injection pattern for `process-runner.ts` or utilize the Re-exec pattern to simulate local CLI responses (mocking `claude` or `ollama` responses) during unit tests.
*   **Golden File Testing:** Use snapshots to validate that `prompt-assembler.ts` and workflow output generate the precise, expected JSON-RPC/MCP structures.
*   **Live-Validation & Smoke Tests:** The `scripts/live-validations.mjs` approach is correct. Expand this to ensure that test executions happen in isolated temporary directories (`/tmp/clibridge-test-...`).

---

## 5. Documentation & Discoverability Practices

Adoption of local-first tooling requires extreme clarity on what the tool supports and how to extend it.

### Community Patterns
*   **Capability Matrices:** A visual grid in the `README.md` showing exactly which providers support which features (e.g., which models support autocomplete, which adapters support streaming).
*   **Workflow Examples:** Providing a rich directory of sample configurations and workflows that users can copy-paste.
*   **Comprehensive `README.md` Structure:** Moving away from deep wikis toward a singular, highly actionable landing page that covers installation, configuration, and a quick-start example within the first screen.

### 🎯 Direct Application to `clibridge`
*   **Capability Matrix:** Create a matrix in the documentation mapping adapters (`claude`, `codex`, `gemini`, etc.) to supported MCP primitives, supported workflows, and context window limits.
*   **Examples Directory:** Continue building out `examples/` with ready-to-run declarative JSON workflows. Ensure every workflow type has a companion `.json` example.

---

## Sources & References

*   [Model Context Protocol (MCP) Official Documentation & Specifications](https://modelcontextprotocol.io)
*   [Aider Architecture & LiteLLM Integration Patterns](https://aider.chat/docs/llms.html)
*   [Continue.dev Local-First Architecture](https://continue.dev/docs)
*   [Cline Layered SDK Architecture](https://github.com/cline/cline)
*   [Testing Subprocesses using the Re-exec Pattern (Rednafi/Go)](https://rednafi.com)
*   [Golden File Testing Practices](https://petermalmgren.com)
*   [Changesets GitHub Actions & Release Workflows](https://github.com/changesets/action)
