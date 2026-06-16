#!/usr/bin/env node
// Client-agnostic entrypoint for the GitHub contribution workflow.
// Any MCP-capable client, terminal, or agent can invoke this command without
// depending on Claude Code's workflow runtime.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const tsxLoader = require.resolve('tsx')
const workflowPath = path.join(__dirname, '..', '.claude', 'workflows', 'github-contribution.mjs')

const result = spawnSync(process.execPath, ['--import', tsxLoader, workflowPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
