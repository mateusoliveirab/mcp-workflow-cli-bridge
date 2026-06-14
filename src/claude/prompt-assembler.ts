import type { ClaudeAgent } from './agent-loader.ts'

export interface AssemblePromptArgs {
  prompt: string
  agent?: ClaudeAgent | null
}

export function assemblePrompt({ prompt, agent }: AssemblePromptArgs): string {
  if (!agent?.prompt) return prompt

  return [
    '## Agent Instructions',
    agent.prompt,
    '',
    '## Task',
    prompt,
  ].join('\n')
}
