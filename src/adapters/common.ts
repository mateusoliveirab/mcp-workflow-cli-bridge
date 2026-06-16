import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { BridgeError, ErrorCode } from '../broker/errors.ts'
import { assertStructuredOutput } from '../broker/schema-validation.ts'
import type { ResolvedRequest, SuccessEnvelope } from '../types.ts'

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'clibridge-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function writeSchemaFile(dir: string, schema: unknown): Promise<string | null> {
  if (!schema) return null
  const path = join(dir, 'schema.json')
  await writeFile(path, JSON.stringify(schema, null, 2))
  return path
}

export async function readJsonFile(path: string): Promise<unknown> {
  const contents = await readFile(path, 'utf8')
  try {
    return JSON.parse(contents)
  } catch (error) {
    throw new BridgeError(ErrorCode.OUTPUT_PARSE_FAILED, `Failed to parse JSON output at ${path}: ${(error as Error).message}`, {
      recoverable: true,
      cause: error as Error,
    })
  }
}

interface NormalizeInput {
  data?: unknown
  text?: string
  durationMs?: number
  attempts?: number
  usage?: Record<string, unknown>
  artifacts?: unknown[]
  warnings?: unknown[]
}

export function normalizeSuccess(request: ResolvedRequest, result: NormalizeInput): SuccessEnvelope {
  const hasSchema = Boolean(request.schema)
  const data = hasSchema ? assertStructuredOutput(request.schema, result.data) : result.data

  return {
    ok: true,
    runId: request.runId,
    provider: request.provider,
    model: request.model,
    phase: request.phase,
    label: request.label,
    durationMs: result.durationMs ?? 0,
    attempts: result.attempts ?? 1,
    structured: hasSchema,
    data: hasSchema ? data : undefined,
    text: hasSchema ? '' : (result.text ?? ''),
    usage: result.usage ?? {},
    artifacts: result.artifacts ?? [],
    warnings: result.warnings ?? [],
  }
}

/**
 * Collects and returns a unique array of extra directory paths requested in the resolved request.
 */
export function getExtraDirs(request: ResolvedRequest): string[] {
  const dirs = new Set<string>()
  if (request.addDir) dirs.add(request.addDir)
  for (const dir of request.addDirs || []) {
    if (dir) dirs.add(dir)
  }
  return Array.from(dirs)
}

