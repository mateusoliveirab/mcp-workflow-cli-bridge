import assert from 'node:assert/strict'
import test from 'node:test'
import { BridgeError, ErrorCode } from '../src/broker/errors.ts'
import { runProcess, tail, isRateLimitError } from '../src/adapters/process-runner.ts'

test('tail returns the end of long process output', () => {
  assert.equal(tail('abcdef', 3), 'def')
  assert.equal(tail('abc', 10), 'abc')
  assert.equal(tail('', 10), '')
})

test('runProcess includes stdoutTail and stderrTail for non-zero exits', async () => {
  await assert.rejects(
    runProcess(process.execPath, [
      '-e',
      "process.stdout.write('session limit reached'); process.stderr.write('diagnostic detail'); process.exit(1)",
    ], { timeoutMs: 5000 }),
    (error) => {
      assert.equal(error instanceof BridgeError, true)
      assert.equal(error.code, ErrorCode.PROCESS_EXIT_NONZERO)
      assert.equal(error.details.stdoutTail, 'session limit reached')
      assert.equal(error.details.stderrTail, 'diagnostic detail')
      return true
    },
  )
})

test('isRateLimitError recognizes known provider rate-limit signals', () => {
  assert.equal(isRateLimitError('Error: rate limit exceeded'), true)
  assert.equal(isRateLimitError('429 Too Many Requests'), true)
  assert.equal(isRateLimitError('RESOURCE_EXHAUSTED: quota exceeded'), true)
  assert.equal(isRateLimitError('your credit balance is too low'), true)
  assert.equal(isRateLimitError('command not found'), false)
})

test('runProcess classifies rate-limit output as RATE_LIMITED', async () => {
  await assert.rejects(
    runProcess(process.execPath, [
      '-e',
      "process.stderr.write('Error: 429 rate limit exceeded'); process.exit(1)",
    ], { timeoutMs: 5000 }),
    (error) => {
      assert.equal(error instanceof BridgeError, true)
      assert.equal(error.code, ErrorCode.RATE_LIMITED)
      return true
    },
  )
})
