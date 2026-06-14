import Ajv from 'ajv'
import type { ValidateFunction } from 'ajv'
import { BridgeError, ErrorCode } from './errors.ts'

const ajv = new Ajv({
  allErrors: true,
  strict: false,
})

// Schemas are revalidated several times per request (broker pre-check, adapter
// output, broker post-check). Cache the compiled validator by schema reference
// so each request compiles once. WeakMap keeps it leak-free across runs.
const compiledCache = new WeakMap<object, ValidateFunction>()

function compileSchema(schema: object): ValidateFunction {
  const cached = compiledCache.get(schema)
  if (cached) return cached

  let validate: ValidateFunction
  try {
    validate = ajv.compile(schema)
  } catch (error) {
    throw new BridgeError(ErrorCode.UNSUPPORTED_SCHEMA, `Invalid JSON Schema: ${(error as Error).message}`, {
      details: { schema },
      cause: error,
    })
  }

  compiledCache.set(schema, validate)
  return validate
}

export function assertValidSchema(schema?: unknown): void {
  if (!schema) return
  compileSchema(schema as object)
}

export interface ValidationResult {
  valid: boolean
  errors: unknown[]
}

export function validateStructuredOutput(schema: unknown, data: unknown): ValidationResult {
  if (!schema) return { valid: true, errors: [] }

  const validate = compileSchema(schema as object)
  const valid = validate(data)
  if (valid) return { valid: true, errors: [] }

  return {
    valid: false,
    errors: validate.errors || [],
  }
}

export function assertStructuredOutput(schema: unknown, data: unknown): unknown {
  const result = validateStructuredOutput(schema, data)
  if (result.valid) return data

  throw new BridgeError(ErrorCode.SCHEMA_VALIDATION_FAILED, 'Output did not match requested JSON Schema.', {
    recoverable: true,
    details: { errors: result.errors },
  })
}
