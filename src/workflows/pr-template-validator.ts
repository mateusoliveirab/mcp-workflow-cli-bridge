import fs from 'node:fs'

export interface PrTemplateValidationConfig {
  enabled: boolean
  onFail: 'warn' | 'block'
  ignoreSections?: string[]
  requireAllCheckboxSections?: string[]
}

export interface PrTemplateValidationResult {
  ok: boolean
  issues: string[]
  sectionIssues: { heading: string; status: 'present' | 'missing' | 'skipped'; suggestion?: string }[]
  checkboxIssues: { label: string; section: string; checked: boolean }[]
  fieldIssues: { label: string; section: string; filled: boolean }[]
}

interface ParsedSection {
  heading: string
  checkboxes: string[]
  fields: string[]
  hasApplicable: boolean
}

interface ParsedBodySection {
  heading: string
  checkboxes: { label: string; checked: boolean }[]
  fields: { label: string; value: string }[]
}

const SKIP_INDICATORS = ['(if applicable)', '(optional)', 'n/a']
const DEFAULT_ALL_CHECKBOX_SECTIONS = ['Review Readiness']

export function validatePrBody(
  templatePath: string,
  body: string,
  config: PrTemplateValidationConfig,
): PrTemplateValidationResult {
  const empty: PrTemplateValidationResult = {
    ok: true, issues: [],
    sectionIssues: [], checkboxIssues: [], fieldIssues: [],
  }

  if (!config.enabled) return empty
  if (!fs.existsSync(templatePath)) return empty

  const template = fs.readFileSync(templatePath, 'utf8')
  const parsedTemplate = parseTemplate(template)
  const parsedBody = parseBody(body)

  const ignoreSet = new Set(
    (config.ignoreSections ?? []).map(s => s.trim().toLowerCase()),
  )

  const checkboxSections = new Set(
    (config.requireAllCheckboxSections ?? DEFAULT_ALL_CHECKBOX_SECTIONS).map(s => s.trim().toLowerCase()),
  )

  return validate(parsedTemplate, parsedBody, ignoreSet, checkboxSections)
}

function parseTemplate(text: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null

  for (const line of text.split('\n')) {
    const h = line.match(/^##\s+(.+)/)
    if (h) {
      current = {
        heading: h[1].trim(),
        checkboxes: [],
        fields: [],
        hasApplicable: SKIP_INDICATORS.some(ind => h[1].toLowerCase().includes(ind)),
      }
      sections.push(current)
      continue
    }
    if (!current) continue

    const cb = line.match(/^-\s+\[\s\]\s+(.+)/)
    if (cb) {
      current.checkboxes.push(cb[1].trim())
      continue
    }

    const f = line.match(/^-\s*([A-Za-z\u00C0-\u024F][\w\u00C0-\u024F\s]{0,60}?):\s*/)
    if (f && !f[1].startsWith('[')) {
      current.fields.push(f[1].trim())
    }
  }

  return sections
}

function parseBody(text: string): ParsedBodySection[] {
  const sections: ParsedBodySection[] = []
  let current: ParsedBodySection | null = null

  for (const line of text.split('\n')) {
    const h = line.match(/^##\s+(.+)/)
    if (h) {
      current = { heading: h[1].trim(), checkboxes: [], fields: [] }
      sections.push(current)
      continue
    }
    if (!current) continue

    const cb = line.match(/^-\s+\[(x| )\]\s+(.+)/i)
    if (cb) {
      current.checkboxes.push({ label: cb[2].trim(), checked: cb[1].toLowerCase() === 'x' })
      continue
    }

    const f = line.match(/^-\s*([A-Za-z\u00C0-\u024F][\w\u00C0-\u024F\s]{0,60}?):\s*(.*)/)
    if (f && !f[1].startsWith('[')) {
      current.fields.push({ label: f[1].trim(), value: f[2].trim() })
    }
  }

  return sections
}

function findSection(heading: string, sections: ParsedBodySection[]): ParsedBodySection | undefined {
  return sections.find(s => s.heading === heading)
}

function closestSection(heading: string, sections: ParsedBodySection[]): string | undefined {
  const hl = heading.toLowerCase()
  let best: string | undefined
  let bestDist = 4
  for (const s of sections) {
    const d = levenshtein(hl, s.heading.toLowerCase())
    if (d > 0 && d < bestDist) {
      bestDist = d
      best = s.heading
    }
  }
  return best
}

function levenshtein(a: string, b: string): number {
  const m = a.length; const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
    }
  }
  return dp[m][n]
}

function validate(
  template: ParsedSection[],
  body: ParsedBodySection[],
  ignoreSet: Set<string>,
  checkboxSections: Set<string>,
): PrTemplateValidationResult {
  const issues: string[] = []
  const sectionIssues: PrTemplateValidationResult['sectionIssues'] = []
  const checkboxIssues: PrTemplateValidationResult['checkboxIssues'] = []
  const fieldIssues: PrTemplateValidationResult['fieldIssues'] = []

  for (const ts of template) {
    if (ts.hasApplicable || ignoreSet.has(ts.heading.toLowerCase())) {
      sectionIssues.push({ heading: ts.heading, status: 'skipped' })
      continue
    }

    const bs = findSection(ts.heading, body)
    const present = !!bs

    if (!present) {
      const near = closestSection(ts.heading, body)
      sectionIssues.push({ heading: ts.heading, status: 'missing', suggestion: near })
      issues.push(near
        ? `Missing required section "${ts.heading}" (found "${near}" — did you mean "${ts.heading}"?)`
        : `Missing required section "${ts.heading}"`,
      )
      continue
    }

    sectionIssues.push({ heading: ts.heading, status: 'present' })

    if (checkboxSections.has(ts.heading.toLowerCase())) {
      for (const cb of ts.checkboxes) {
        const bc = bs.checkboxes.find(b => b.label === cb)
        const checked = bc?.checked ?? false
        checkboxIssues.push({ label: cb, section: ts.heading, checked })
        if (!checked) {
          issues.push(`Checkbox not checked: "${cb}" (under "${ts.heading}")`)
        }
      }
    }

    for (const f of ts.fields) {
      const bf = bs.fields.find(b => b.label === f)
      const filled = !!bf && bf.value.length > 0
      fieldIssues.push({ label: f, section: ts.heading, filled })
      if (!filled) {
        issues.push(`Empty required field: "${f}" (under "${ts.heading}")`)
      }
    }
  }

  return { ok: issues.length === 0, issues, sectionIssues, checkboxIssues, fieldIssues }
}
