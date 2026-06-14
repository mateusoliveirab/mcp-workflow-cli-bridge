import type { ErrorEnvelope } from '../types.ts'

export interface BridgeErrorOptions {
  recoverable?: boolean
  details?: Record<string, unknown>
  cause?: unknown
}

export class BridgeError extends Error {
  code: string
  recoverable: boolean
  details: Record<string, unknown>

  constructor(code: string, message: string, options: BridgeErrorOptions = {}) {
    super(message)
    this.name = 'BridgeError'
    this.code = code
    this.recoverable = options.recoverable ?? false
    this.details = options.details ?? {}
    this.cause = options.cause
  }
}

export const ErrorCode = Object.freeze({
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  UNSUPPORTED_SCHEMA: 'UNSUPPORTED_SCHEMA',
  UNSUPPORTED_ATTACHMENT: 'UNSUPPORTED_ATTACHMENT',
  UNSUPPORTED_SANDBOX: 'UNSUPPORTED_SANDBOX',
  AUTH_MISSING: 'AUTH_MISSING',
  TIMEOUT: 'TIMEOUT',
  PROCESS_EXIT_NONZERO: 'PROCESS_EXIT_NONZERO',
  OUTPUT_PARSE_FAILED: 'OUTPUT_PARSE_FAILED',
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',     // Reserved: not yet thrown by any adapter.
  CANCELLED: 'CANCELLED',          // Reserved: not yet thrown by any adapter.
  UNKNOWN_PROVIDER_ERROR: 'UNKNOWN_PROVIDER_ERROR',
})

interface ErrorEnvelopeRequest {
  runId: string
  provider?: string
  phase?: string
  label?: string
}

interface ErrorEnvelopeExtra {
  durationMs?: number
  attempts?: number
  stderrTail?: string
  stdoutTail?: string
  rawOutputPath?: string
}

export function errorEnvelope(
  error: unknown,
  request: ErrorEnvelopeRequest,
  extra: ErrorEnvelopeExtra = {},
): ErrorEnvelope {
  const bridgeError = error instanceof BridgeError
    ? error
    : new BridgeError(ErrorCode.UNKNOWN_PROVIDER_ERROR, (error as Error)?.message || String(error), {
      cause: error,
    })

  return {
    ok: false,
    runId: request.runId,
    provider: request.provider as string,
    phase: request.phase as string,
    label: request.label as string,
    durationMs: extra.durationMs ?? 0,
    attempts: extra.attempts ?? 1,
    errorCode: bridgeError.code,
    message: bridgeError.message,
    recoverable: bridgeError.recoverable,
    details: bridgeError.details,
    stderrTail: extra.stderrTail ?? (bridgeError.details?.stderrTail as string) ?? '',
    stdoutTail: extra.stdoutTail ?? (bridgeError.details?.stdoutTail as string) ?? '',
    rawOutputPath: extra.rawOutputPath,
  }
}
