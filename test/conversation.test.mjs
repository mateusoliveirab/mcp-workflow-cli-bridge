import assert from 'node:assert/strict'
import test from 'node:test'
import { join } from 'node:path'
import { runAgent } from '../src/broker/run-agent.ts'
import { BridgeError, ErrorCode } from '../src/broker/errors.ts'

const cwd = join(import.meta.dirname, 'fixtures', 'workspace')

function textEnvelope(request, text, overrides = {}) {
  return {
    ok: true,
    runId: request.runId,
    provider: request.provider,
    phase: request.phase,
    label: request.label,
    durationMs: 1,
    attempts: 1,
    structured: false,
    text,
    usage: {},
    artifacts: [],
    warnings: [],
    ...overrides,
  }
}

function structuredEnvelope(request, data) {
  return textEnvelope(request, '', {
    structured: true,
    data,
  })
}

function mockAdapter(run, capabilities = {}) {
  return {
    capabilities: {
      structuredOutput: true,
      images: true,
      sandbox: true,
      skipPermissions: true,
      ...capabilities,
    },
    run,
  }
}

async function runConversation({
  runId = 'knock-knock-run',
  turns,
  adapters,
  schema,
  agentType,
  loadAgent = false,
}) {
  const transcript = []
  const results = []

  for (const [index, turn] of turns.entries()) {
    const prompt = [
      'Continue this conversation.',
      transcript.map((entry) => `${entry.role}: ${entry.text}`).join('\n'),
      `user: ${turn.userText}`,
    ].filter(Boolean).join('\n\n')

    const result = await runAgent({
      runId,
      workflow: 'conversation-test',
      phase: 'Dialogue',
      label: `dialogue:${index + 1}`,
      agentType,
      cwd,
      prompt,
      schema,
      maxRetries: turn.maxRetries,
    }, {
      config: { defaultProvider: 'mock' },
      loadAgent,
      adapters,
    })

    results.push(result)
    if (!result.ok) break

    transcript.push({ role: 'user', text: turn.userText })
    transcript.push({
      role: 'assistant',
      text: result.structured ? result.data.reply : result.text,
    })
  }

  return { results, transcript }
}

test('runAgent can drive a knock-knock conversation across multiple calls', async () => {
  const seen = []
  const repliesByLabel = new Map([
    ['dialogue:1', "Who's there?"],
    ['dialogue:2', 'Lettuce who?'],
    ['dialogue:3', "Lettuce in, it's cold out here."],
  ])

  const { results, transcript } = await runConversation({
    turns: [
      { userText: 'Knock knock.' },
      { userText: 'Lettuce.' },
      { userText: "Lettuce in, it's cold out here." },
    ],
    adapters: {
      mock: mockAdapter(async (request) => {
        seen.push(request)
        return textEnvelope(request, repliesByLabel.get(request.label))
      }),
    },
  })

  assert.equal(results.length, 3)
  assert.deepEqual(results.map((result) => result.ok), [true, true, true])
  assert.deepEqual(results.map((result) => result.runId), [
    'knock-knock-run',
    'knock-knock-run',
    'knock-knock-run',
  ])
  assert.deepEqual(results.map((result) => result.text), [
    "Who's there?",
    'Lettuce who?',
    "Lettuce in, it's cold out here.",
  ])

  assert.match(seen[1].prompt, /user: Knock knock\./)
  assert.match(seen[1].prompt, /assistant: Who's there\?/)
  assert.match(seen[2].prompt, /user: Lettuce\./)
  assert.match(seen[2].prompt, /assistant: Lettuce who\?/)

  assert.deepEqual(transcript, [
    { role: 'user', text: 'Knock knock.' },
    { role: 'assistant', text: "Who's there?" },
    { role: 'user', text: 'Lettuce.' },
    { role: 'assistant', text: 'Lettuce who?' },
    { role: 'user', text: "Lettuce in, it's cold out here." },
    { role: 'assistant', text: "Lettuce in, it's cold out here." },
  ])
})

test('runAgent assembles agent instructions once per conversation turn', async () => {
  const seen = []

  const { results } = await runConversation({
    agentType: 'vastitas-creator',
    loadAgent: true,
    turns: [
      { userText: 'Knock knock.' },
      { userText: 'Agent-aware follow-up.' },
    ],
    adapters: {
      mock: mockAdapter(async (request) => {
        seen.push(request)
        return textEnvelope(request, `reply for ${request.label}`)
      }),
    },
  })

  assert.deepEqual(results.map((result) => result.ok), [true, true])
  assert.equal(seen.length, 2)

  for (const request of seen) {
    assert.equal((request.prompt.match(/## Agent Instructions/g) || []).length, 1)
    assert.match(request.prompt, /You are the test creator agent\./)
  }

  assert.match(seen[1].prompt, /user: Knock knock\./)
  assert.doesNotMatch(seen[1].prompt, /## Task[\s\S]*## Agent Instructions[\s\S]*## Agent Instructions/)
})

test('runAgent validates every structured turn before the conversation continues', async () => {
  const calls = []
  const schema = {
    type: 'object',
    required: ['reply', 'done'],
    properties: {
      reply: { type: 'string' },
      done: { type: 'boolean' },
    },
    additionalProperties: false,
  }

  const { results, transcript } = await runConversation({
    schema,
    turns: [
      { userText: 'Knock knock.' },
      { userText: 'Orange.' },
      { userText: 'Orange you glad this validated?' },
    ],
    adapters: {
      mock: mockAdapter(async (request) => {
        calls.push(request.label)
        if (request.label === 'dialogue:1') {
          return structuredEnvelope(request, { reply: "Who's there?", done: false })
        }
        if (request.label === 'dialogue:2') {
          return structuredEnvelope(request, { reply: 'Orange who?', done: false })
        }
        return structuredEnvelope(request, { reply: 'Orange you glad this validated?', done: true })
      }),
    },
  })

  assert.deepEqual(calls, ['dialogue:1', 'dialogue:2', 'dialogue:3'])
  assert.deepEqual(results.map((result) => result.ok), [true, true, true])
  assert.deepEqual(results.map((result) => result.data), [
    { reply: "Who's there?", done: false },
    { reply: 'Orange who?', done: false },
    { reply: 'Orange you glad this validated?', done: true },
  ])
  assert.deepEqual(transcript.at(-1), {
    role: 'assistant',
    text: 'Orange you glad this validated?',
  })
})

test('runAgent stops a multi-turn conversation when a structured turn is invalid', async () => {
  const calls = []
  const schema = {
    type: 'object',
    required: ['reply', 'done'],
    properties: {
      reply: { type: 'string' },
      done: { type: 'boolean' },
    },
    additionalProperties: false,
  }

  const { results, transcript } = await runConversation({
    schema,
    turns: [
      { userText: 'Knock knock.' },
      { userText: 'Interrupting cow.' },
      { userText: 'This turn should not run.' },
    ],
    adapters: {
      mock: mockAdapter(async (request) => {
        calls.push(request.label)
        if (request.label === 'dialogue:1') {
          return structuredEnvelope(request, { reply: "Who's there?", done: false })
        }
        if (request.label === 'dialogue:2') {
          return structuredEnvelope(request, { reply: 123, done: 'no' })
        }
        return structuredEnvelope(request, { reply: 'unexpected', done: true })
      }),
    },
  })

  assert.deepEqual(calls, ['dialogue:1', 'dialogue:2'])
  assert.equal(results.length, 2)
  assert.equal(results[0].ok, true)
  assert.equal(results[1].ok, false)
  assert.equal(results[1].errorCode, 'SCHEMA_VALIDATION_FAILED')
  assert.deepEqual(transcript, [
    { role: 'user', text: 'Knock knock.' },
    { role: 'assistant', text: "Who's there?" },
  ])
})

test('runAgent keeps retry attempts isolated to the failing conversation turn', async () => {
  const calls = []

  const { results } = await runConversation({
    turns: [
      { userText: 'Knock knock.' },
      { userText: 'Retry.', maxRetries: 1 },
      { userText: 'Continue after retry.' },
    ],
    adapters: {
      mock: mockAdapter(async (request) => {
        calls.push(request.label)
        if (request.label === 'dialogue:2' && calls.filter((label) => label === 'dialogue:2').length === 1) {
          throw new BridgeError(ErrorCode.TIMEOUT, 'slow turn', { recoverable: true })
        }
        return textEnvelope(request, `reply for ${request.label}`)
      }),
    },
  })

  assert.deepEqual(calls, ['dialogue:1', 'dialogue:2', 'dialogue:2', 'dialogue:3'])
  assert.deepEqual(results.map((result) => result.ok), [true, true, true])
  assert.deepEqual(results.map((result) => result.attempts), [1, 2, 1])
  assert.deepEqual(results.map((result) => result.text), [
    'reply for dialogue:1',
    'reply for dialogue:2',
    'reply for dialogue:3',
  ])
})
