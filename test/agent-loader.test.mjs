import assert from 'node:assert/strict'
import test from 'node:test'
import { join } from 'node:path'
import { loadClaudeAgent, parseClaudeAgent } from '../src/claude/agent-loader.ts'

test('parseClaudeAgent reads frontmatter and prompt body', () => {
  const agent = parseClaudeAgent(`---
name: test-agent
tools:
  - Read
model: sonnet
---

Body prompt.
`)

  assert.equal(agent.metadata.name, 'test-agent')
  assert.deepEqual(agent.metadata.tools, ['Read'])
  assert.equal(agent.metadata.model, 'sonnet')
  assert.equal(agent.prompt, 'Body prompt.')
})

test('loadClaudeAgent loads .claude/agents by agentType', async () => {
  const cwd = join(import.meta.dirname, 'fixtures', 'workspace')
  const agent = await loadClaudeAgent(cwd, 'vastitas-creator')

  assert.equal(agent.metadata.name, 'vastitas-creator')
  assert.match(agent.prompt, /test creator agent/)
})

