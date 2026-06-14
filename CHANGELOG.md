# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-14

### Added
- Initial implementation of the local MCP bridge for routing Claude Dynamic Workflow agent tasks.
- Provider adapters for `claude`, `codex`, `gemini`, `opencode`, and `agy` CLIs.
- Capability-based routing, schema validation, and automatic execution retry broker.
- Test suites covering routing, adapter logic, schema validation, and retry behavior.
