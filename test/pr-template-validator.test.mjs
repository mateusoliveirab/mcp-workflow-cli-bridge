import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { validatePrBody } from '../src/workflows/pr-template-validator.ts'

function tmpFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-tmpl-valid-'))
  const filePath = path.join(dir, 'PULL_REQUEST_TEMPLATE.md')
  fs.writeFileSync(filePath, content, 'utf8')
  return filePath
}

function rmDir(filePath) {
  fs.rmSync(path.dirname(filePath), { recursive: true, force: true })
}

const defaultConfig = { enabled: true, onFail: 'block' }

test('returns ok when template file does not exist', () => {
  const result = validatePrBody('/nonexistent/template.md', 'some body', defaultConfig)
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.issues.length, 0)
})

test('returns ok when validation is disabled', () => {
  const tmpl = tmpFile('## Description\n\nContent\n')
  try {
    const r = validatePrBody(tmpl, '## Description\n\nContent\n', { enabled: false, onFail: 'block' })
    assert.strictEqual(r.ok, true)
    assert.strictEqual(r.issues.length, 0)
  } finally { rmDir(tmpl) }
})

test('passes when all sections match exactly', () => {
  const tmpl = tmpFile([
    '## Description', '',
    'Closes #', '',
    '## Testing', '',
    '- [ ] Unit tests pass', '',
    '## Real Behavior Proof', '',
    '- Environment:',
    '- Steps:',
  ].join('\n'))
  const body = [
    '## Description', '',
    'Closes #42', '',
    '## Testing', '',
    '- [x] Unit tests pass', '',
    '## Real Behavior Proof', '',
    '- Environment: Ubuntu 24.04',
    '- Steps: grep',
  ].join('\n')
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, true)
    assert.strictEqual(r.issues.length, 0)
  } finally { rmDir(tmpl) }
})

test('fails on missing required section', () => {
  const tmpl = tmpFile('## Description\n\nContent\n\n## Testing\n')
  const body = '## Description\n\nContent\n'
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, false)
    assert.ok(r.issues[0].includes('Testing'))
    assert.strictEqual(r.sectionIssues[1].status, 'missing')
  } finally { rmDir(tmpl) }
})

test('suggests near-match for typo in section name', () => {
  const tmpl = tmpFile('## Description\n\nContent\n')
  const body = '## Descripton\n\nContent\n'
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, false)
    assert.ok(r.sectionIssues[0].suggestion)
    assert.ok(r.issues[0].includes('Descripton'))
    assert.ok(r.issues[0].includes('Description'))
  } finally { rmDir(tmpl) }
})

test('does not suggest near-match for completely different heading', () => {
  const tmpl = tmpFile('## Description\n\nContent\n')
  const body = '## Summary\n\nContent\n'
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, false)
    assert.strictEqual(r.sectionIssues[0].suggestion, undefined)
    assert.ok(r.issues[0].includes('Description'))
  } finally { rmDir(tmpl) }
})

test('fails on unchecked checkbox in a require-all section', () => {
  const tmpl = tmpFile([
    '## Review Readiness', '',
    '- [ ] I have performed a self-review',
    '- [ ] This PR is ready for human review',
  ].join('\n'))
  const body = [
    '## Review Readiness', '',
    '- [ ] I have performed a self-review',
    '- [x] This PR is ready for human review',
  ].join('\n')
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, false)
    assert.strictEqual(r.checkboxIssues[0].checked, false)
    assert.strictEqual(r.checkboxIssues[1].checked, true)
    assert.ok(r.issues[0].includes('self-review'))
  } finally { rmDir(tmpl) }
})

test('does not validate checkboxes in select-one sections like Type of Change', () => {
  const tmpl = tmpFile([
    '## Type of Change', '',
    '- [ ] Bug fix',
    '- [ ] Documentation update',
  ].join('\n'))
  const body = [
    '## Type of Change', '',
    '- [x] Documentation update',
  ].join('\n')
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, true)
    assert.strictEqual(r.issues.length, 0)
  } finally { rmDir(tmpl) }
})

test('fails on empty required field', () => {
  const tmpl = tmpFile([
    '## Real Behavior Proof', '',
    '- Environment:',
    '- Steps:',
  ].join('\n'))
  const body = [
    '## Real Behavior Proof', '',
    '- Environment:',
    '- Steps: grep',
  ].join('\n')
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, false)
    assert.strictEqual(r.fieldIssues[0].filled, false)
    assert.strictEqual(r.fieldIssues[1].filled, true)
    assert.ok(r.issues[0].includes('Environment'))
  } finally { rmDir(tmpl) }
})

test('skips optional sections marked (if applicable)', () => {
  const tmpl = tmpFile([
    '## Description', '', 'Content', '',
    '## Screenshots (if applicable)', '', 'Add screenshots here.',
  ].join('\n'))
  const body = '## Description\n\nContent\n'
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, true)
    assert.strictEqual(r.sectionIssues[1].status, 'skipped')
  } finally { rmDir(tmpl) }
})

test('reports multiple missing sections (fields within are implied, not double-reported)', () => {
  const tmpl = tmpFile([
    '## Description', 'Content',
    '## Testing',
    '- [ ] Unit tests pass',
    '## Real Behavior Proof',
    '- Environment:',
    '- Steps:',
  ].join('\n'))
  const body = '## Description\n\nContent\n'
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, false)
    assert.ok(r.issues.some(i => i.includes('Testing')))
    assert.ok(r.issues.some(i => i.includes('Real Behavior Proof')))
    // When a section is missing entirely, its fields are not double-reported
    assert.strictEqual(r.fieldIssues.length, 0)
  } finally { rmDir(tmpl) }
})

test('respects ignoreSections config', () => {
  const tmpl = tmpFile([
    '## Description', 'Content',
    '## Deploy Notes', '',
    '- Some field:',
  ].join('\n'))
  const body = '## Description\n\nContent\n'
  try {
    const r = validatePrBody(tmpl, body, {
      enabled: true, onFail: 'block', ignoreSections: ['Deploy Notes'],
    })
    assert.strictEqual(r.ok, true)
    assert.strictEqual(r.sectionIssues[1].status, 'skipped')
  } finally { rmDir(tmpl) }
})

test('does not treat `#` or `###` as section headers', () => {
  const tmpl = tmpFile('## Description\n\nContent\n')
  const body = '# Wrong Level\n\nContent\n'
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, false)
    assert.strictEqual(r.sectionIssues[0].status, 'missing')
  } finally { rmDir(tmpl) }
})

test('validates against headroom-like template successfully', () => {
  const tmpl = tmpFile([
    '## Description', '',
    'Closes #', '',
    '## Type of Change', '',
    '- [ ] Bug fix',
    '- [ ] Documentation update', '',
    '## Testing', '',
    '- [ ] Unit tests pass',
    '- [ ] Manual testing performed', '',
    '## Real Behavior Proof', '',
    '- Environment:',
    '- Exact command / steps:',
    '- Observed result:',
    '- Not tested:', '',
    '## Review Readiness', '',
    '- [ ] I have performed a self-review',
    '- [ ] This PR is ready for human review', '',
    '## Screenshots (if applicable)', '',
    'N/A',
  ].join('\n'))
  const body = [
    '## Description', '',
    'Closes #123', '',
    '## Type of Change', '',
    '- [x] Documentation update', '',
    '## Testing', '',
    '- [x] Unit tests pass',
    '- [x] Manual testing performed', '',
    '## Real Behavior Proof', '',
    '- Environment: Ubuntu 24.04',
    '- Exact command / steps: grep',
    '- Observed result: docs updated',
    '- Not tested: e2e proxy run', '',
    '## Review Readiness', '',
    '- [x] I have performed a self-review',
    '- [x] This PR is ready for human review',
  ].join('\n')
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, true)
    assert.strictEqual(r.issues.length, 0)
  } finally { rmDir(tmpl) }
})

test('catches the exact headroom PR body pattern that failed governance', () => {
  const tmpl = tmpFile([
    '## Description', '', 'Closes #', '',
    '## Type of Change',
    '- [ ] Bug fix',
    '- [ ] Documentation update', '',
    '## Changes Made',
    '- List changes', '',
    '## Testing',
    '- [ ] Unit tests pass',
    '- [ ] Manual testing performed', '',
    '## Real Behavior Proof',
    '- Environment:',
    '- Exact command / steps:',
    '- Observed result:',
    '- Not tested:', '',
    '## Review Readiness',
    '- [ ] I have performed a self-review',
    '- [ ] This PR is ready for human review',
  ].join('\n'))
  const body = [
    '## Summary', '',
    'Added docs for env vars.', '',
    '## Type of Change', '',
    '- [x] Documentation update', '',
    '## Real Behavior Proof', '',
    '- Environment: Ubuntu 24.04',
    '- Exact command / steps: grep',
    '- Observed result: docs updated',
    '- Not tested: e2e proxy run',
  ].join('\n')
  try {
    const r = validatePrBody(tmpl, body, defaultConfig)
    assert.strictEqual(r.ok, false)
    const text = r.issues.join(' ')
    assert.ok(text.includes('Description'), 'should flag Description')
    assert.ok(text.includes('Testing'), 'should flag Testing')
    assert.ok(text.includes('Review Readiness'), 'should flag Review Readiness')
  } finally { rmDir(tmpl) }
})

test('validates custom requireAllCheckboxSections config', () => {
  const tmpl = tmpFile([
    '## My Checklist', '',
    '- [ ] Item one',
    '- [ ] Item two',
  ].join('\n'))
  const body = [
    '## My Checklist', '',
    '- [x] Item one',
    '- [ ] Item two',
  ].join('\n')
  try {
    const r = validatePrBody(tmpl, body, {
      enabled: true, onFail: 'block',
      requireAllCheckboxSections: ['My Checklist'],
    })
    assert.strictEqual(r.ok, false)
    assert.ok(r.issues[0].includes('Item two'))
  } finally { rmDir(tmpl) }
})
