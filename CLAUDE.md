# CLAUDE.md

## Stack
Node.js >=20.19.4 · TypeScript · @modelcontextprotocol/sdk · tsx · node:test

## Gotchas
- **Gemini Structured Output** — Gemini CLI does not support JSON Schema output natively. The broker must perform client-side schema validation on the stdout payload.
- **Agy Capabilities** — Agy CLI does not support schemas or images. Reject requests requesting these capabilities in the broker before dispatch.
- **CLI Path Validation** — Always assert that provider binaries are on the user's `PATH` before invoking them to avoid cryptic execution failures.
- **Safe Pushing & Clean** — Git push or branch reset/clean commands require explicit user confirmation.

## Commands
- `npm run live:validate` — Run live checks against local CLI binaries.
- `npm run smoke` — Dry-run validation of provider configurations.
