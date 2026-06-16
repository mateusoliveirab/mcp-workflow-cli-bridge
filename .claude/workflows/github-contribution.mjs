import { execFileSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { runAgent } from '../../src/broker/run-agent.ts'
import { defaultAdapters } from '../../src/adapters/registry.ts'
import { resolveRole } from '../../src/workflows/roles.ts'
import { loadContributionConfig } from '../../src/workflows/contribution-config.ts'
import { newRunId, startRun, phaseStart, phaseEnd, endRun } from '../../src/workflows/run-state.ts'
import { validatePrBody } from '../../src/workflows/pr-template-validator.ts'

const workflowName = 'github-contribution'
const phaseNames = ['rules', 'preflight', 'plan', 'implement', 'validate', 'stress', 'review', 'describe', 'publish']
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const publish = args.includes('--publish')
const maintainerOk = args.includes('--maintainer-ok')
const configPath = readFlag('--config')
const requestedBranch = readFlag('--branch')
const issue = readFlag('--issue')
const changeType = readFlag('--change-type') || 'bugfix'
const publishTarget = readFlag('--publish-target') || 'pr'
const taskPrompt = readPrompt()

if (!taskPrompt) {
  console.error('Usage: node --import tsx .claude/workflows/github-contribution.mjs [--dry-run] [--publish] [--publish-target pr|issue] [--change-type bugfix|feature|architecture|dependency|refactor-only|test-ci-only] [--maintainer-ok] [--branch name] [--issue id] "<task prompt>"')
  process.exit(1)
}

const cwd = process.cwd()
const config = loadContributionConfig(cwd, configPath)
const runId = newRunId(workflowName)
const results = {}
const summary = []
let activeBranch = ''

async function run() {
  startRun({ runId, workflow: workflowName, description: taskPrompt, phases: phaseNames })

  await runPhase('rules', 'explorer', async () => {
    const rules = discoverRules()
    enforceContributionPolicy(rules)
    results.rules = rules.summary
    return rules.summary
  })

  await runPhase('preflight', 'explorer', async () => {
    const currentBranch = git(['branch', '--show-current']).trim()
    const status = git(['status', '--short']).trim()
    const defaultBranch = config.repository.defaultBranch

    if (config.contribution.requireCleanWorktree && status && !dryRun) {
      throw new Error(`Working tree must be clean before starting a contribution workflow:\n${status}`)
    }

    if (publishTarget === 'issue') {
      activeBranch = currentBranch || defaultBranch
      return `Issue-first workflow selected; staying on ${activeBranch} and skipping contribution branch creation.`
    }

    activeBranch = requestedBranch || (
      currentBranch && currentBranch !== defaultBranch
        ? currentBranch
        : makeBranchName(config.contribution.branchPrefix, taskPrompt)
    )

    if (dryRun) return `[dry-run] would use branch ${activeBranch}`

    if (currentBranch === activeBranch) {
      return `Using existing branch ${activeBranch}`
    }

    if (branchExists(activeBranch)) {
      throw new Error(`Branch '${activeBranch}' already exists. Pass --branch with another name or switch to it first.`)
    }

    if (currentBranch === defaultBranch || requestedBranch) {
      git(['switch', '-c', activeBranch])
      return `Created branch ${activeBranch} from ${currentBranch || defaultBranch}`
    }

    return `Using current branch ${currentBranch}`
  })

  await runPhase('plan', 'architect', async (provider) => {
    const prompt = [
      `Repository: ${config.repository.name || path.basename(cwd)}`,
      `Public repo: ${config.repository.publicRepo}`,
      `Change type: ${changeType}`,
      issue ? `Issue/context: ${issue}` : '',
      maintainerOk ? 'Maintainer approval/context: supplied by --maintainer-ok' : '',
      '',
      `Task: ${taskPrompt}`,
      '',
      `Contribution rules discovered:\n${results.rules}`,
      '',
      'Assume the perspective of a code architecture developer contributing to this project.',
      'Create a concise implementation plan. Call out ownership boundaries, risks, validation commands, stress commands, and files likely to change.',
      policyInstructions(),
    ].filter(Boolean).join('\n')

    const result = await runAgent({
      workflow: workflowName,
      phase: 'plan',
      label: `${workflowName}:plan`,
      cwd,
      provider,
      prompt,
      ...(dryRun ? { dryRun: true, mockText: '[dry-run plan]' } : {}),
    })
    assertEnvelope(result, 'plan')
    results.plan = result.text
    return result.text
  })

  await runPhase('implement', 'writer', async (provider) => {
    if (publishTarget === 'issue') {
      results.implement = 'Implementation skipped because --publish-target issue was selected.'
      return results.implement
    }

    const prompt = [
      `Task: ${taskPrompt}`,
      '',
      `Plan:\n${results.plan}`,
      '',
      `Contribution rules:\n${results.rules}`,
      '',
      'Implement the plan in this repository as a disciplined contributor. Keep the diff scoped. Do not commit or push.',
      policyInstructions(),
    ].join('\n')

    const result = await runAgent({
      workflow: workflowName,
      phase: 'implement',
      label: `${workflowName}:implement`,
      cwd,
      provider,
      prompt,
      dangerouslySkipPermissions: true,
      ...(dryRun ? { dryRun: true, mockText: '[dry-run implementation]' } : {}),
    })
    assertEnvelope(result, 'implement')
    results.implement = result.text
    return result.text
  })

  await runPhase('validate', 'explorer', async () => {
    if (publishTarget === 'issue') {
      results.validate = 'Validation skipped because --publish-target issue was selected.'
      return results.validate
    }

    results.validate = runCommands(config.validation.commands, 'Validation')
    return results.validate
  })

  await runPhase('stress', 'explorer', async () => {
    if (publishTarget === 'issue') {
      results.stress = 'Stress validation skipped because --publish-target issue was selected.'
      return results.stress
    }

    results.stress = runCommands(config.validation.stressCommands, 'Stress validation')
    return results.stress
  })

  await runPhase('review', 'judge', async (provider) => {
    if (!config.review.requireReview) {
      results.review = 'Review disabled by config.'
      return results.review
    }

    if (publishTarget === 'issue') {
      results.review = 'Review skipped for issue-first workflow; implementation has not started.'
      return results.review
    }

    const diff = dryRun ? '[dry-run diff]' : git(['diff', '--stat']) + '\n\n' + git(['diff'])
    const prompt = [
      'Review this contribution diff as a code architecture developer.',
      'Focus on correctness bugs, architectural fit, public-repo professionalism, missing tests, and risky assumptions.',
      'Lead with concrete findings. If there are no blocking issues, say so clearly.',
      '',
      `Task: ${taskPrompt}`,
      '',
      `Contribution rules:\n${results.rules}`,
      '',
      `Plan:\n${results.plan}`,
      '',
      `Validation:\n${results.validate}`,
      '',
      `Stress validation:\n${results.stress}`,
      '',
      `Diff:\n${diff}`,
    ].join('\n')

    const result = await runAgent({
      workflow: workflowName,
      phase: 'review',
      label: `${workflowName}:review`,
      cwd,
      provider: config.review.provider || provider,
      prompt,
      ...(dryRun ? { dryRun: true, mockText: '[dry-run review: no findings]' } : {}),
    })
    assertEnvelope(result, 'review')
    results.review = result.text
    return result.text
  })

  await runPhase('describe', 'architect', async (provider) => {
    const status = dryRun ? '[dry-run status]' : git(['status', '--short'])
    const stat = dryRun ? '[dry-run diff stat]' : git(['diff', '--stat'])
    const prompt = [
      publishTarget === 'issue'
        ? 'Write a GitHub issue title and body for this proposed contribution from a code architecture developer perspective.'
        : 'Write a GitHub pull request title and body for this contribution from a code architecture developer perspective.',
      'Base it only on the real task, validation, review, git status, and diff stat below.',
      'Return this format exactly:',
      'TITLE: <title>',
      'BODY:',
      '<markdown body>',
      '',
      `Task: ${taskPrompt}`,
      '',
      `Change type: ${changeType}`,
      issue ? `Issue/context: ${issue}` : '',
      '',
      `Contribution rules:\n${results.rules}`,
      '',
      `Plan:\n${results.plan}`,
      '',
      `Validation:\n${results.validate}`,
      '',
      `Stress validation:\n${results.stress}`,
      '',
      `Review:\n${results.review}`,
      '',
      `Git status:\n${status}`,
      '',
      `Diff stat:\n${stat}`,
      '',
      policyInstructions(),
      publishTarget === 'issue'
        ? 'For issue-first work, include the proposed API surface, behavior changes, user stories, failure modes, recovery/resilience, and security considerations when applicable.'
        : 'If real behavior proof is required, include a Real Behavior Proof section with setup, exact commands/steps, observed result, and what was not tested.',
    ].join('\n')

    const result = await runAgent({
      workflow: workflowName,
      phase: 'describe',
      label: `${workflowName}:describe`,
      cwd,
      provider,
      prompt,
      ...(dryRun ? {
        dryRun: true,
        mockText: publishTarget === 'issue'
          ? 'TITLE: dry-run issue\nBODY:\nDry-run issue body.'
          : 'TITLE: dry-run contribution\nBODY:\nDry-run PR body.',
      } : {}),
    })
    assertEnvelope(result, 'describe')
    const pr = parsePrDescription(result.text, config.pr.titlePrefix)
    results.pr = pr
    writePrArtifact(pr, publishTarget)

    if (publishTarget === 'pr') {
      const templateFile = config.rules.files.find(f => /PULL_REQUEST_TEMPLATE/i.test(f))
      if (templateFile) {
        const templatePath = path.isAbsolute(templateFile)
          ? templateFile
          : path.join(cwd, templateFile)
        const validation = validatePrBody(templatePath, pr.body, config.pr.templateValidation)
        if (!validation.ok) {
          const summary = validation.issues.join('\n')
          if (config.pr.templateValidation.onFail === 'block') {
            throw new Error(
              `PR body validation failed — fix before publishing:\n${summary}`,
            )
          }
          console.warn(`PR body has issues (continuing in warn mode):\n${summary}`)
          results.pr.validationWarnings = validation.issues
        }
      }
    }
    return `${pr.title}\n\n${pr.body}`
  })

  await runPhase('publish', 'writer', async () => {
    if (!publish) {
      return 'Publish skipped. Re-run with --publish and WORKFLOW_CONFIRM=1 to create the configured GitHub artifact.'
    }
    if (!config.contribution.allowPublish) {
      throw new Error('Publishing is disabled by contribution.allowPublish=false.')
    }
    if (process.env.WORKFLOW_CONFIRM !== '1') {
      throw new Error('WORKFLOW_CONFIRM=1 is required for --publish.')
    }
    if (dryRun) {
      return publishTarget === 'issue'
        ? '[dry-run] would create a GitHub issue from the generated description.'
        : `[dry-run] would commit, push ${activeBranch}, and create ${config.contribution.draftPr ? 'draft ' : ''}PR.`
    }

    if (publishTarget === 'issue') {
      const issueUrl = execFileSync('gh', [
        'issue',
        'create',
        '--title',
        results.pr.title,
        '--body',
        results.pr.body,
      ], { cwd, encoding: 'utf8' }).trim()
      return `Published issue: ${issueUrl}`
    }

    const status = git(['status', '--short']).trim()
    if (!status) {
      throw new Error('No changes to publish.')
    }

    git(['add', '-A'])
    git(['commit', '-m', results.pr.title])
    git(['push', '-u', 'origin', activeBranch])

    const prArgs = ['pr', 'create', '--title', results.pr.title, '--body', results.pr.body]
    if (config.contribution.draftPr) prArgs.push('--draft')
    for (const label of config.pr.labels) prArgs.push('--label', label)
    const prUrl = execFileSync('gh', prArgs, { cwd, encoding: 'utf8' }).trim()
    return `Published PR: ${prUrl}`
  })

  endRun(runId, summary.every(item => item.ok))
  console.log(JSON.stringify({ workflow: workflowName, runId, branch: activeBranch, phases: summary, pr: results.pr }, null, 2))
}

async function runPhase(name, role, fn) {
  const index = phaseNames.indexOf(name)
  const provider = role === 'writer'
    ? resolveRole({ capabilities: ['skipPermissions'] }, defaultAdapters)
    : role === 'judge'
      ? resolveRole({ strength: 'high' }, defaultAdapters)
      : resolveRole({}, defaultAdapters)
  const startedAt = Date.now()
  phaseStart(runId, name, index, provider)
  try {
    const text = await fn(provider)
    const durationMs = Date.now() - startedAt
    phaseEnd(runId, name, true, durationMs)
    summary.push({ name, provider, ok: true, durationMs })
    return text
  } catch (error) {
    const durationMs = Date.now() - startedAt
    phaseEnd(runId, name, false, durationMs)
    summary.push({ name, provider, ok: false, durationMs, error: error.message })
    throw error
  }
}

function assertEnvelope(result, phase) {
  if (!result.ok) {
    throw new Error(`${phase} failed: ${result.errorCode} ${result.message}`)
  }
}

function runCommands(commands, label) {
  if (!commands.length) return `${label} skipped: no commands configured.`

  const outputs = []
  for (const command of commands) {
    if (dryRun) {
      outputs.push(`[dry-run] ${command}`)
      continue
    }
    try {
      const output = execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      outputs.push(`$ ${command}\n${output.trim()}`)
    } catch (error) {
      const stdout = error.stdout?.toString() || ''
      const stderr = error.stderr?.toString() || ''
      throw new Error(`${label} failed: ${command}\n${stdout}${stderr}`)
    }
  }
  return outputs.join('\n\n')
}

function discoverRules() {
  const found = []
  const missing = []

  for (const file of config.rules.files) {
    const filePath = path.join(cwd, file)
    if (!fs.existsSync(filePath)) {
      missing.push(file)
      continue
    }

    const text = fs.readFileSync(filePath, 'utf8')
    found.push({ file, text: text.slice(0, 12000) })
  }

  if (config.rules.requireDiscovery && found.length === 0) {
    throw new Error(`No contribution rule files were found. Checked: ${config.rules.files.join(', ')}`)
  }

  const sections = found.map(item => [
    `--- ${item.file} ---`,
    item.text.trim() || '(empty file)',
  ].join('\n'))

  const summary = [
    found.length ? sections.join('\n\n') : 'No rule files discovered.',
    missing.length ? `\nMissing configured rule files: ${missing.join(', ')}` : '',
    `\nWorkflow policy: changeType=${changeType}; publishTarget=${publishTarget}; maintainerOk=${maintainerOk}`,
  ].filter(Boolean).join('\n')

  return { found, missing, summary }
}

function enforceContributionPolicy() {
  if (!['pr', 'issue'].includes(publishTarget)) {
    throw new Error(`Unsupported --publish-target '${publishTarget}'. Use 'pr' or 'issue'.`)
  }

  if (config.policy.blockedChangeTypes.includes(changeType) && !maintainerOk) {
    throw new Error(`Change type '${changeType}' is blocked by repository policy unless --maintainer-ok is supplied.`)
  }

  const mustStartWithIssue = config.policy.requireMaintainerOkForIssueFirst
    && config.policy.issueFirstChangeTypes.includes(changeType)
    && !maintainerOk
    && !issue

  if (publishTarget === 'pr' && mustStartWithIssue) {
    throw new Error(`Change type '${changeType}' requires an issue or maintainer approval before opening a PR. Use --publish-target issue, pass --issue, or pass --maintainer-ok when appropriate.`)
  }
}

function policyInstructions() {
  const lines = []
  if (config.policy.requireRealBehaviorProof) {
    lines.push('Real behavior proof is required; unit tests and lint alone are not enough for the final description.')
  }
  if (config.policy.requireReproductionForBugfix && changeType === 'bugfix') {
    lines.push('For bugfix work, include the reproduction or failing behavior and the after-fix verification.')
  }
  if (config.policy.requireChangelogForUserFacing) {
    lines.push('For user-facing changes, consider whether the repository changelog needs an entry.')
  }
  return lines.join('\n')
}

function git(args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

function branchExists(branch) {
  try {
    git(['rev-parse', '--verify', branch])
    return true
  } catch {
    return false
  }
}

function makeBranchName(prefix, prompt) {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'change'
  return `${prefix}${slug}-${Date.now()}`
}

function parsePrDescription(text, titlePrefix) {
  const titleMatch = text.match(/^TITLE:\s*(.+)$/m)
  const bodyMatch = text.match(/^BODY:\s*\n([\s\S]*)$/m)
  const rawTitle = titleMatch?.[1]?.trim() || taskPrompt
  const title = `${titlePrefix || ''}${rawTitle}`.trim()
  const body = bodyMatch?.[1]?.trim() || text.trim()
  return { title, body }
}

function writePrArtifact(pr, kind) {
  const dir = path.join(cwd, '.bridge-runs')
  fs.mkdirSync(dir, { recursive: true })
  const bodyPath = path.join(dir, `${runId}-${kind}.md`)
  fs.writeFileSync(bodyPath, `# ${pr.title}\n\n${pr.body}\n`)
}

function readFlag(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function readPrompt() {
  const skipNext = new Set(['--config', '--branch', '--issue', '--change-type', '--publish-target'])
  for (let i = args.length - 1; i >= 0; i--) {
    const arg = args[i]
    if (arg.startsWith('--')) continue
    if (i > 0 && skipNext.has(args[i - 1])) continue
    return arg
  }
  return ''
}

run().catch(error => {
  endRun(runId, false)
  console.error(error.message)
  process.exit(1)
})
