import { spawn } from 'node:child_process'
import { BridgeError, ErrorCode } from '../broker/errors.ts'
import { DEFAULT_TIMEOUT_MS } from '../config/constants.ts'
import type { RunProcessFn } from './contract.ts'

export function tail(text: string, maxLength = 4000): string {
  if (!text) return ''
  return text.length > maxLength ? text.slice(-maxLength) : text
}

export const runProcess: RunProcessFn = async (command, args, options = {}) => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const startedAt = Date.now()

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env as NodeJS.ProcessEnv | undefined,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGTERM')
      reject(new BridgeError(ErrorCode.TIMEOUT, `${command} timed out after ${timeoutMs}ms.`, {
        recoverable: true,
      }))
    }, timeoutMs)

    child.stdout!.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (error: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new BridgeError(ErrorCode.PROVIDER_UNAVAILABLE, `${command} failed to start: ${error.message}`, {
        cause: error,
      }))
    })

    child.on('close', (code: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      const durationMs = Date.now() - startedAt
      if (code !== 0) {
        reject(new BridgeError(ErrorCode.PROCESS_EXIT_NONZERO, `${command} exited with code ${code}.`, {
          recoverable: true,
          details: { code, stdoutTail: tail(stdout), stderrTail: tail(stderr) },
        }))
        return
      }

      resolve({ stdout, stderr, durationMs })
    })
  })
}
