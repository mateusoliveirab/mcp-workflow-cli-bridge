import os from 'node:os'
import { normalizeSuccess, getExtraDirs } from './common.ts'
import { runProcess } from './process-runner.ts'
import type { AdapterFn, ProviderAdapter, RunProcessFn } from './contract.ts'
import type { ResolvedRequest, Envelope } from '../types.ts'

// agy is a multi-model gateway CLI (Gemini, Claude, GPT-OSS) with a
// text-only print mode — it has no JSON/schema output flag. Its
// `structuredOutput: false` capability makes the broker reject schema
// requests before dispatch (see contract.requiredCapabilities).
export const runAgy: AdapterFn = async (request: ResolvedRequest, runProcessFn: RunProcessFn = runProcess): Promise<Envelope> => {
  // agy's flag parser only binds the prompt as a positional argument when it
  // directly follows --print; placed after other flags it silently drops the
  // prompt and falls back to open-ended filesystem exploration.
  const args = ['--print', request.prompt]

  const extraDirs = getExtraDirs(request)
  for (const dir of extraDirs) {
    args.push('--add-dir', dir)
  }

  if (request.model) args.push('--model', request.model)
  if (request.sandbox) args.push('--sandbox')

  // agy is agentic: in print mode it blocks on tool-approval prompts unless
  // permissions are skipped. This maps the normalized request flag (resolved
  // by the broker / bridge policy) to agy's CLI option — same contract as
  // codex and opencode, not a per-adapter default.
  if (request.dangerouslySkipPermissions) args.push('--dangerously-skip-permissions')

  // agy auto-indexes its process working directory as codebase context, so
  // running it inside the project dir causes it to explore the full repo even
  // when no --add-dir flag is given. When no explicit context dirs are
  // requested, use the home dir as a neutral cwd to avoid this.
  const processCwd = extraDirs.length > 0 ? request.cwd : os.homedir()

  const processResult = await runProcessFn('agy', args, {
    cwd: processCwd,
    env: request.env,
    timeoutMs: request.timeoutMs,
  })

  return normalizeSuccess(request, {
    text: processResult.stdout.trim(),
    durationMs: processResult.durationMs,
  })
}

export const agyAdapter: ProviderAdapter = {
  command: 'agy',
  capabilities: { structuredOutput: false, images: false, sandbox: true, skipPermissions: true },
  run: runAgy,
}
