import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertProviderCommandAvailable,
  providerStatuses,
  selectOnlyAvailableProviderForDemand,
} from '../src/adapters/availability.ts'

const capabilities = {
  structuredOutput: true,
  images: false,
  sandbox: false,
  skipPermissions: false,
}

function adapter(overrides = {}) {
  return {
    capabilities: { ...capabilities, ...overrides.capabilities },
    command: overrides.command,
    run: async () => {
      throw new Error('not used')
    },
  }
}

test('providerStatuses reports adapter command availability without checking auth', async () => {
  const statuses = await providerStatuses({
    node: adapter({ command: process.execPath }),
    missing: adapter({ command: 'definitely-missing-clibridge-command' }),
  })

  assert.equal(statuses.find((status) => status.provider === 'node').available, true)
  assert.equal(statuses.find((status) => status.provider === 'missing').available, false)
})

test('assertProviderCommandAvailable rejects missing CLI commands before dispatch', async () => {
  await assert.rejects(
    assertProviderCommandAvailable('missing', adapter({
      command: 'definitely-missing-clibridge-command',
    })),
    (error) => {
      assert.equal(error.code, 'PROVIDER_UNAVAILABLE')
      assert.equal(error.details.provider, 'missing')
      return true
    },
  )
})

test('selectOnlyAvailableProviderForDemand chooses the single provider matching requested capabilities', async () => {
  const provider = await selectOnlyAvailableProviderForDemand({
    workflow: 'w',
    phase: 'p',
    label: 'l',
    cwd: process.cwd(),
    prompt: 'go',
    attachments: [{ type: 'image', path: 'image.png' }],
  }, {
    textOnly: adapter(),
    imageCapable: adapter({ capabilities: { images: true } }),
  })

  assert.equal(provider, 'imageCapable')
})

test('selectOnlyAvailableProviderForDemand rejects ambiguous capability matches', async () => {
  await assert.rejects(
    selectOnlyAvailableProviderForDemand({
      workflow: 'w',
      phase: 'p',
      label: 'l',
      cwd: process.cwd(),
      prompt: 'go',
    }, {
      first: adapter(),
      second: adapter(),
    }),
    (error) => {
      assert.equal(error.code, 'PROVIDER_NOT_FOUND')
      assert.deepEqual(error.details.candidates, ['first', 'second'])
      return true
    },
  )
})
