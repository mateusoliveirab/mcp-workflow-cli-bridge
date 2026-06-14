import { runAgent } from '../src/index.ts'

// Usage:
//   npm run smoke                 -> dry-run (instant, no CLI spawned)
//   npm run smoke:live -- codex    -> real run against a provider
const live = process.argv[2] === '--live'
const provider = process.argv[3] || 'codex'

const base = {
  workflow: 'smoke',
  phase: 'Check',
  label: 'smoke:1',
  cwd: process.cwd(),
  prompt: 'Reply with exactly the word OK and nothing else.',
  timeoutMs: 90000,
  // The bridge runs unattended, so the caller opts into auto-approval rather
  // than any adapter assuming it (agentic CLIs block on tool prompts otherwise).
  dangerouslySkipPermissions: true,
}

const result = live
  ? await runAgent(base, {
      config: { defaultProvider: provider },
      loadAgent: false,
    })
  : await runAgent(
      { ...base, dryRun: true, mockText: 'OK (dry-run)' },
      { config: { defaultProvider: provider }, loadAgent: false },
    )

console.log(JSON.stringify(result, null, 2))
process.exit(result.ok ? 0 : 1)
