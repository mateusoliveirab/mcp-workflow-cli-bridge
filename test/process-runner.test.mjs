import assert from 'node:assert/strict'
import test from 'node:test'
import { BridgeError, ErrorCode } from '../src/broker/errors.ts'
import { runProcess, tail } from '../src/adapters/process-runner.ts'

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
