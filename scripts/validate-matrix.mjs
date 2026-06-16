import { runAgent } from '../src/index.ts'

// Usage:
//   npm run live:matrix -- <provider> "<model>" [timeoutMs]
const [provider, model, timeoutMs] = [process.argv[2], process.argv[3], Number(process.argv[4] || 90000)]

const result = await runAgent({
  workflow: 'validate', phase: 'Check', label: `${provider}:${model || 'default'}`,
  cwd: process.cwd(),
  prompt: 'Reply with exactly the word OK and nothing else. Do not use any tools.',
  model: model || undefined,
  timeoutMs,
  dangerouslySkipPermissions: true,
  disableFallback: true,
}, { config: { defaultProvider: provider }, loadAgent: false })

const text = (result.text || '').replace(/\s+/g, ' ').slice(0, 50)
console.log(`${provider} / ${model || 'default'}: ok=${result.ok} | text=${JSON.stringify(text)} | err=${result.errorCode || '-'}`)
process.exit(result.ok ? 0 : 1)
