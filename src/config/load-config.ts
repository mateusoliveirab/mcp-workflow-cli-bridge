import { readFile } from 'node:fs/promises'
import type { BridgeConfig } from '../types.ts'

export async function loadJsonConfig(path: string): Promise<BridgeConfig> {
  const contents = await readFile(path, 'utf8')
  return JSON.parse(contents) as BridgeConfig
}
