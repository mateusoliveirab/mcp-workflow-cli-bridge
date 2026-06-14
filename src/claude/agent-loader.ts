import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { AGENT_DIR_SEGMENTS } from '../config/constants.ts'

export interface ClaudeAgent {
  path: string
  metadata: Record<string, unknown>
  prompt: string
}

export async function loadClaudeAgent(cwd: string, agentType?: string): Promise<ClaudeAgent | null> {
  if (!agentType) return null

  const agentPath = join(cwd, ...AGENT_DIR_SEGMENTS, `${agentType}.md`)
  const contents = await readFile(agentPath, 'utf8')
  return parseClaudeAgent(contents, agentPath)
}

export function parseClaudeAgent(contents: string, path = '<inline>'): ClaudeAgent {
  const frontmatterMatch = contents.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!frontmatterMatch) {
    return {
      path,
      metadata: {},
      prompt: contents.trim(),
    }
  }

  const metadata = (parseYaml(frontmatterMatch[1]) as Record<string, unknown>) || {}
  const prompt = frontmatterMatch[2].trim()

  return {
    path,
    metadata,
    prompt,
  }
}
