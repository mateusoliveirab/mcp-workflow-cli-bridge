import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runAgent } from '../../src/index.ts'
import { defaultAdapters } from '../../src/adapters/registry.ts'
import { commandPath } from '../../src/adapters/availability.ts'

const execFileAsync = promisify(execFile)

export const DEFAULT_PROVIDERS = Object.keys(defaultAdapters).sort()
export const DEFAULT_TIMEOUT_MS = 90000

const PROVIDER_PROBES = Object.freeze({
  agy: {
    kind: 'command',
    args: ['--version'],
  },
  gemini: {
    kind: 'command',
    args: ['--version'],
  },
})

export function parseLiveValidationArgs(argv) {
  const parsed = {
    providers: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    json: false,
    includeEnvelope: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--json') {
      parsed.json = true
    } else if (arg === '--include-envelope') {
      parsed.includeEnvelope = true
    } else if (arg === '--timeout-ms') {
      parsed.timeoutMs = Number(argv[index + 1])
      index += 1
    } else if (arg === '--providers') {
      parsed.providers.push(...splitProviders(argv[index + 1] || ''))
      index += 1
    } else if (arg === '--provider') {
      parsed.providers.push(argv[index + 1])
      index += 1
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`)
    } else {
      parsed.providers.push(...splitProviders(arg))
    }
  }

  parsed.providers = [...new Set(parsed.providers.filter(Boolean))]

  if (!Number.isInteger(parsed.timeoutMs) || parsed.timeoutMs <= 0) {
    throw new Error(`Invalid --timeout-ms: ${parsed.timeoutMs}`)
  }

  return parsed
}

export async function runLiveValidations(options = {}) {
  const providers = options.providers?.length ? options.providers : DEFAULT_PROVIDERS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const results = []

  for (const provider of providers) {
    results.push(await validateProvider({ provider, timeoutMs, includeEnvelope: options.includeEnvelope }))
  }

  return results
}

export async function validateProvider({ provider, timeoutMs = DEFAULT_TIMEOUT_MS, includeEnvelope = false }) {
  const probe = PROVIDER_PROBES[provider]
  if (probe?.kind === 'command') {
    return await validateCommandProbe({ provider, probe, timeoutMs })
  }

  const startedAt = Date.now()
  const result = await runAgent(buildLiveValidationInput({ provider, timeoutMs }), {
    config: { defaultProvider: provider },
    loadAgent: false,
  })

  return {
    provider,
    elapsedMs: Date.now() - startedAt,
    ...summarizeResult(result),
    envelope: includeEnvelope ? result : undefined,
  }
}

async function validateCommandProbe({ provider, probe, timeoutMs }) {
  const startedAt = Date.now()
  const adapter = defaultAdapters[provider]
  const command = adapter?.command || provider
  const path = await commandPath(command)

  if (!path) {
    return {
      provider,
      elapsedMs: Date.now() - startedAt,
      pass: false,
      status: 'cli-unavailable',
      errorCode: 'PROVIDER_UNAVAILABLE',
      detail: `Command '${command}' is not available on PATH.`,
      durationMs: Date.now() - startedAt,
      attempts: 1,
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(command, probe.args, {
      timeout: timeoutMs,
      cwd: process.cwd(),
    })
    return {
      provider,
      elapsedMs: Date.now() - startedAt,
      pass: true,
      status: 'ok',
      errorCode: null,
      detail: compact(firstNonEmpty(stdout, stderr, path)),
      durationMs: Date.now() - startedAt,
      attempts: 1,
    }
  } catch (error) {
    const detail = firstNonEmpty(error.stdout, error.stderr, error.message)
    return {
      provider,
      elapsedMs: Date.now() - startedAt,
      pass: false,
      status: classifyFailure({ errorCode: error.killed ? 'TIMEOUT' : 'PROCESS_EXIT_NONZERO', message: error.message }, detail),
      errorCode: error.killed ? 'TIMEOUT' : 'PROCESS_EXIT_NONZERO',
      detail: compact(detail),
      durationMs: Date.now() - startedAt,
      attempts: 1,
    }
  }
}

export function buildLiveValidationInput({ provider, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const adapter = defaultAdapters[provider]

  return {
    workflow: 'live-validation',
    phase: 'Check',
    label: `live:${provider}`,
    cwd: process.cwd(),
    prompt: 'Reply with exactly the word OK and nothing else. Do not use any tools.',
    timeoutMs,
    dangerouslySkipPermissions: Boolean(adapter?.capabilities.skipPermissions),
    disableFallback: true,
  }
}

export function summarizeResult(result) {
  if (result.ok) {
    const text = compact(result.text)
    const pass = text === 'OK'
    return {
      pass,
      status: pass ? 'ok' : 'unexpected-output',
      errorCode: null,
      detail: pass ? text : `text=${JSON.stringify(text)}`,
      durationMs: result.durationMs,
      attempts: result.attempts,
    }
  }

  const detail = firstNonEmpty(
    result.stdoutTail,
    result.stderrTail,
    typeof result.details === 'object' && result.details ? JSON.stringify(result.details) : '',
    result.message,
  )

  return {
    pass: false,
    status: classifyFailure(result, detail),
    errorCode: result.errorCode,
    detail: compact(detail),
    durationMs: result.durationMs,
    attempts: result.attempts,
  }
}

export function classifyFailure(result, detail = '') {
  const text = `${result.errorCode || ''}\n${result.message || ''}\n${detail || ''}`.toLowerCase()

  if (result.errorCode === 'PROVIDER_UNAVAILABLE') return 'cli-unavailable'
  if (result.errorCode === 'TIMEOUT') return 'timeout'
  if (result.errorCode?.startsWith('UNSUPPORTED_')) return 'unsupported'
  if (text.includes('session limit')) return 'session-limit'
  if (text.includes('rate limit') || text.includes('quota') || text.includes('usage limit') || text.includes('too many requests')) {
    return 'quota-or-rate-limit'
  }
  if (text.includes('auth') || text.includes('login') || text.includes('api key') || text.includes('not authenticated')) {
    return 'auth'
  }
  if (text.includes('permission') || text.includes('approval')) return 'permission'
  if (result.errorCode === 'PROCESS_EXIT_NONZERO') return 'process-exit'
  return 'failed'
}

export function printLiveValidationTable(rows) {
  const header = ['provider', 'status', 'pass', 'duration', 'attempts', 'detail']
  const widths = [12, 20, 6, 10, 8, 0]

  console.log(formatRow(header, widths))
  console.log(formatRow(header.map((label) => '-'.repeat(label.length)), widths))

  for (const row of rows) {
    console.log(formatRow([
      row.provider,
      row.status,
      row.pass ? 'yes' : 'no',
      `${row.elapsedMs}ms`,
      String(row.attempts),
      row.detail || row.errorCode || '',
    ], widths))
  }
}

export function printLiveValidationHelp() {
  console.log(`Usage:
  npm run live:validate
  npm run live:validate -- claude opencode
  npm run live:validate -- --providers claude,codex --timeout-ms 120000
  npm run live:validate -- --json --include-envelope claude

Runs real provider CLIs through runAgent. This is an environment validation,
not part of the deterministic unit test suite.`)
}

function splitProviders(value) {
  return value.split(',').map((provider) => provider.trim()).filter(Boolean)
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || ''
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160)
}

function formatRow(values, widths) {
  return values.map((value, index) => {
    const text = String(value)
    return widths[index] ? text.padEnd(widths[index]) : text
  }).join('  ')
}
