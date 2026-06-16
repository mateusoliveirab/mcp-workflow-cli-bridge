import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runWorkflow } from '../src/workflows/workflow-executor.ts'

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-workflow-executor-'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

test('runWorkflow executes read-files, policy, agent dry-run, and shell dry-run phases', async () => {
  const dir = tempDir()
  try {
    fs.writeFileSync(path.join(dir, 'CONTRIBUTING.md'), 'Bug fixes need tests.')
    const workflowPath = path.join(dir, 'workflow.json')
    writeJson(workflowPath, {
      name: 'test-workflow',
      inputDefaults: {
        changeType: 'bugfix',
      },
      phases: [
        {
          name: 'rules',
          kind: 'read-files',
          files: ['CONTRIBUTING.md'],
        },
        {
          name: 'policy',
          kind: 'policy',
          assertions: [
            {
              input: 'changeType',
              notIn: ['refactor-only'],
              message: 'blocked',
            },
          ],
        },
        {
          name: 'plan',
          kind: 'agent',
          prompt: 'Task={{task}}\nRules={{results.rules}}\nType={{inputs.changeType}}',
          mockText: 'planned',
        },
        {
          name: 'validate',
          kind: 'shell',
          commands: ['npm test'],
        },
      ],
    })

    const result = await runWorkflow({
      workflowPath,
      cwd: dir,
      task: 'fix a bug',
      dryRun: true,
      inputs: {},
    })

    assert.equal(result.ok, true)
    assert.equal(result.workflow, 'test-workflow')
    assert.equal(result.results.plan, 'planned')
    assert.match(result.results.rules, /Bug fixes need tests/)
    assert.equal(result.results.validate, '[dry-run] npm test')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('runWorkflow returns ok=false when a policy assertion rejects inputs', async () => {
  const dir = tempDir()
  try {
    const workflowPath = path.join(dir, 'workflow.json')
    writeJson(workflowPath, {
      name: 'policy-workflow',
      phases: [
        {
          name: 'policy',
          kind: 'policy',
          assertions: [
            {
              input: 'changeType',
              notIn: ['refactor-only'],
              message: 'refactor-only is blocked',
            },
          ],
        },
      ],
    })

    const result = await runWorkflow({
      workflowPath,
      cwd: dir,
      task: 'cleanup only',
      inputs: {
        changeType: 'refactor-only',
      },
    })

    assert.equal(result.ok, false)
    assert.match(result.error, /refactor-only is blocked/)
    assert.equal(result.phases[0].name, 'policy')
    assert.equal(result.phases[0].ok, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('runWorkflow executes shell phases when dryRun is false', async () => {
  const dir = tempDir()
  try {
    const workflowPath = path.join(dir, 'workflow.json')
    writeJson(workflowPath, {
      name: 'shell-workflow',
      phases: [
        {
          name: 'validate',
          kind: 'shell',
          command: 'node -e "console.log(\\"shell-ok\\")"',
        },
      ],
    })

    const result = await runWorkflow({
      workflowPath,
      cwd: dir,
      task: 'validate',
    })

    assert.equal(result.ok, true)
    assert.match(result.results.validate, /shell-ok/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('runWorkflow renders template variables in shell commands', async () => {
  const dir = tempDir()
  try {
    const workflowPath = path.join(dir, 'workflow.json')
    writeJson(workflowPath, {
      name: 'template-shell-workflow',
      phases: [
        {
          name: 'validate',
          kind: 'shell',
          command: 'node -e "console.log(\\"{{inputs.filename}}:{{task}}\\")"',
        },
      ],
    })

    const result = await runWorkflow({
      workflowPath,
      cwd: dir,
      task: 'say hello',
      inputs: {
        filename: 'greetings.txt',
      },
    })

    assert.equal(result.ok, true)
    assert.match(result.results.validate, /greetings.txt:say hello/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('Headroom workflow blocks architecture PR work without issue or maintainer approval', async () => {
  const dir = tempDir()
  try {
    fs.writeFileSync(path.join(dir, 'CONTRIBUTING.md'), 'Feature work is issue-first.')
    const workflowPath = path.resolve('examples/headroom-contribution.workflow.json')

    const result = await runWorkflow({
      workflowPath,
      cwd: dir,
      task: 'propose architecture change',
      dryRun: true,
      inputs: {
        changeType: 'architecture',
        publishTarget: 'pr',
      },
    })

    assert.equal(result.ok, false)
    assert.match(result.error, /requires an issue or maintainer approval/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
