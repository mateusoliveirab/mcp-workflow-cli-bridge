import { agyAdapter } from './agy.ts'
import { claudeAdapter } from './claude.ts'
import { codexAdapter } from './codex.ts'
import { geminiAdapter } from './gemini.ts'
import { opencodeAdapter } from './opencode.ts'
import { createConfigAdapter } from './config-runner.ts'
import type { ProviderAdapter } from './contract.ts'
import type { CliAdapterConfig } from './config-types.ts'
import adaptersConfig from './adapters-config.json' with { type: 'json' }


export const defaultAdapters: Readonly<Record<string, ProviderAdapter>> = Object.freeze({
  agy: agyAdapter,
  claude: claudeAdapter,
  codex: codexAdapter,
  gemini: geminiAdapter,
  ollama: createConfigAdapter(adaptersConfig.ollama as CliAdapterConfig),
  opencode: opencodeAdapter,
})
