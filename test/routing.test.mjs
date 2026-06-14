import assert from 'node:assert/strict'
import test from 'node:test'
import { selectRoute } from '../src/broker/routing.ts'

test('selectRoute prefers label over agentType and phase', () => {
  const route = selectRoute({
    defaultProvider: 'codex',
    routes: [
      { phase: 'Create', provider: 'gemini' },
      { agentType: 'vastitas-creator', provider: 'opencode' },
      { label: 'create:iter1', provider: 'codex' },
    ],
  }, {
    phase: 'Create',
    agentType: 'vastitas-creator',
    label: 'create:iter1',
  })

  assert.equal(route.provider, 'codex')
})

test('selectRoute falls back to default provider', () => {
  const route = selectRoute({
    defaultProvider: 'codex',
    routes: [],
  }, {
    phase: 'Extract',
    label: 'extract-conflict',
  })

  assert.equal(route.provider, 'codex')
})

test('selectRoute can require image attachments', () => {
  const route = selectRoute({
    defaultProvider: 'codex',
    routes: [
      { phase: 'Critique', requiresImages: true, provider: 'codex' },
      { phase: 'Critique', provider: 'claude' },
    ],
  }, {
    phase: 'Critique',
    label: 'critique:iter1',
    attachments: [{ type: 'image', path: 'iter1.png' }],
  })

  assert.equal(route.provider, 'codex')
})

