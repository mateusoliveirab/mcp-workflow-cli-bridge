import { normalizeSuccess, getExtraDirs } from './common.ts'
import { BridgeError, ErrorCode } from '../broker/errors.ts'
import { runProcess } from './process-runner.ts'
import type { AdapterFn, ProviderAdapter, RunProcessFn } from './contract.ts'
import type { ResolvedRequest, Envelope } from '../types.ts'

export const runClaude: AdapterFn = async (request: ResolvedRequest, runProcessFn: RunProcessFn = runProcess): Promise<Envelope> => {
  const args = ['-p', '--output-format', request.schema ? 'json' : 'text']
  if (request.schema) args.push('--json-schema', JSON.stringify(request.schema))
  if (request.model) args.push('--model', request.model)
  if (request.agentType) args.push('--agent', request.agentType)

  for (const dirPath of getExtraDirs(request)) {
    args.push('--add-dir', dirPath)
  }

  if (request.dangerouslySkipPermissions) args.push('--dangerously-skip-permissions')
  args.push(request.prompt)

  const processResult = await runProcessFn('claude', args, {
    cwd: request.cwd,
    env: request.env,
    timeoutMs: request.timeoutMs,
  })

  let data: unknown
  if (request.schema) {
    try {
      data = JSON.parse(processResult.stdout)
    } catch (error) {
      throw new BridgeError(ErrorCode.OUTPUT_PARSE_FAILED, `Claude JSON output parse failed: ${(error as Error).message}`, {
        recoverable: true,
        cause: error as Error,
      })
    }
  }
  return normalizeSuccess(request, {
    data,
    text: request.schema ? '' : processResult.stdout.trim(),
    durationMs: processResult.durationMs,
  })
}

export const claudeAdapter: ProviderAdapter = {
  command: 'claude',
  capabilities: { structuredOutput: true, images: false, sandbox: false, skipPermissions: true },
  run: runClaude,
}
