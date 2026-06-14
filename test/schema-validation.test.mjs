import assert from 'node:assert/strict'
import test from 'node:test'
import { BridgeError, ErrorCode } from '../src/broker/errors.ts'
import { assertStructuredOutput, validateStructuredOutput } from '../src/broker/schema-validation.ts'

const schema = {
  type: 'object',
  required: ['approved'],
  properties: {
    approved: { type: 'boolean' },
  },
  additionalProperties: false,
}

test('validateStructuredOutput accepts valid data', () => {
  const result = validateStructuredOutput(schema, { approved: true })
  assert.equal(result.valid, true)
})

test('assertStructuredOutput throws normalized bridge error for invalid data', () => {
  assert.throws(() => {
    assertStructuredOutput(schema, { approved: 'yes' })
  }, (error) => {
    assert.equal(error instanceof BridgeError, true)
    assert.equal(error.code, ErrorCode.SCHEMA_VALIDATION_FAILED)
    assert.equal(error.recoverable, true)
    return true
  })
})

