import { join } from 'node:path'
import { normalizeSuccess, readJsonFile, withTempDir, writeSchemaFile, getExtraDirs } from './common.ts'
import { runProcess } from './process-runner.ts'
import type { AdapterFn, ProviderAdapter, RunProcessFn } from './contract.ts'
import type { ResolvedRequest, Envelope } from '../types.ts'

export const runCodex: AdapterFn = async (request: ResolvedRequest, runProcessFn: RunProcessFn = runProcess): Promise<Envelope> => {
  return await withTempDir(async (dir) => {
    const schemaPath = await writeSchemaFile(dir, request.schema)
    const outputPath = join(dir, 'last-message.txt')
    const args = ['exec', '--cd', request.cwd, '--skip-git-repo-check', '--output-last-message', outputPath]

    if (request.sandbox) args.push('--sandbox', request.sandbox)
    if (schemaPath) args.push('--output-schema', schemaPath)

    for (const attachment of request.attachments || []) {
      if (attachment.type === 'image') args.push('--image', attachment.path)
    }

    for (const dirPath of getExtraDirs(request)) {
      args.push('--add-dir', dirPath)
    }

    if (request.model) args.push('--model', request.model)
    if (request.dangerouslySkipPermissions) args.push('--dangerously-bypass-approvals-and-sandbox')
    args.push(request.prompt)

    const processResult = await runProcessFn('codex', args, {
      cwd: request.cwd,
      env: request.env,
      timeoutMs: request.timeoutMs,
    })

    const data = request.schema ? await readJsonFile(outputPath) : undefined
    return normalizeSuccess(request, {
      data,
      text: request.schema ? '' : processResult.stdout.trim(),
      durationMs: processResult.durationMs,
    })
  })
}

export const codexAdapter: ProviderAdapter = {
  command: 'codex',
  capabilities: { structuredOutput: true, images: true, sandbox: true, skipPermissions: true },
  run: runCodex,
}
