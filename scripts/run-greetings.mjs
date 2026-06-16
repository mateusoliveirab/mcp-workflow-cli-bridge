import fs from 'node:fs'
import path from 'node:path'
import { runWorkflow } from '../src/workflows/workflow-executor.ts'

const tempDir = path.join(process.cwd(), 'greetings-test-run')
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true })
}
fs.mkdirSync(tempDir, { recursive: true })

console.log('Running real workflow in:', tempDir)

try {
  const result = await runWorkflow({
    workflowPath: 'examples/greetings-research.workflow.json',
    cwd: tempDir,
    task: 'Determine how people in Salvador say hi and write it to salvador_greetings.md',
    dryRun: false,
    inputs: {
      city: 'Salvador',
      filename: 'salvador_greetings.md'
    },
    dangerouslySkipPermissions: true
  })

  console.log('\n=============================================')
  console.log('Workflow execution result:')
  console.log(JSON.stringify(result, null, 2))
  console.log('=============================================\n')

  const mdFile = path.join(tempDir, 'salvador_greetings.md')
  if (fs.existsSync(mdFile)) {
    console.log('\n--- Generated Markdown Content ---')
    console.log(fs.readFileSync(mdFile, 'utf8'))
    console.log('---------------------------------\n')
  } else {
    console.log('Error: markdown file was not generated!')
  }
} catch (error) {
  console.error('Error running workflow:', error)
} finally {
  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true })
}
