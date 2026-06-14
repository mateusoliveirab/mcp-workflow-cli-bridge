import type { AgentInput, Envelope, ResolvedRequest } from '../types.ts'

// A process runner is injectable so adapters can be unit-tested without
// spawning real CLIs (matches the current runProcessFn convention).
export type RunProcessFn = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string | undefined>; timeoutMs?: number },
) => Promise<{ stdout: string; stderr: string; durationMs: number }>

/**
 * What a provider CLI can actually do. Declaring this as data (instead of
 * scattered `if`s per adapter) lets the broker enforce capabilities uniformly
 * and fail fast — killing the "each adapter handles concepts differently"
 * class of drift (e.g. structured output, image attachments, skip-permissions).
 */
export interface ProviderCapabilities {
  /** Native structured JSON output validated against a schema. */
  structuredOutput: boolean
  /** Image attachments. */
  images: boolean
  /** Sandbox isolation flag. */
  sandbox: boolean
  /** Unattended tool auto-approval. */
  skipPermissions: boolean
}

/** Transitional alias for the current function-shaped adapters. */
export type AdapterFn = (request: ResolvedRequest, runProcessFn?: RunProcessFn) => Promise<Envelope>

/** Target shape: an adapter is its capabilities plus a run function. */
export interface ProviderAdapter {
  /** CLI executable expected on PATH for live provider runs. */
  command?: string
  capabilities: ProviderCapabilities
  run: AdapterFn
}

export type AdapterEntry = ProviderAdapter | AdapterFn

export const PERMISSIVE_CAPABILITIES: ProviderCapabilities = Object.freeze({
  structuredOutput: true,
  images: true,
  sandbox: true,
  skipPermissions: true,
})

// Accept both the ProviderAdapter shape ({ capabilities, run }) and the legacy
// bare adapter function still used by some callers and tests.
export function resolveAdapterEntry(entry: AdapterEntry): ProviderAdapter {
  if (typeof entry === 'function') {
    return { capabilities: PERMISSIVE_CAPABILITIES, run: entry }
  }
  return entry
}

/** A request capability the broker can check before dispatching. */
export type RequiredCapability = keyof ProviderCapabilities

/**
 * Which capabilities a given request actually needs. The broker compares this
 * against the chosen provider's declared capabilities and rejects mismatches
 * with a clear error instead of letting the CLI fail opaquely downstream.
 */
export function requiredCapabilities(request: AgentInput): RequiredCapability[] {
  const needed: RequiredCapability[] = []
  if (request.schema) needed.push('structuredOutput')
  if ((request.attachments || []).some((a) => a.type === 'image')) needed.push('images')
  if (request.sandbox) needed.push('sandbox')
  if (request.dangerouslySkipPermissions) needed.push('skipPermissions')
  return needed
}
