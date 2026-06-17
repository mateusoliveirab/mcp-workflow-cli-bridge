import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCapabilitiesTable, readReadmeBlock } from '../scripts/generate-capabilities-table.mjs'

test('README capabilities table matches adapter capabilities declared in code', () => {
  assert.equal(
    readReadmeBlock(),
    buildCapabilitiesTable(),
    'README.md capabilities table is out of sync — run `node scripts/generate-capabilities-table.mjs --write`',
  )
})
