import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { runAgent } from '../broker/run-agent.ts'
import { defaultAdapters } from '../adapters/registry.ts'
import { providerStatuses } from '../adapters/availability.ts'
import { loadJsonConfig } from '../config/load-config.ts'
import type { RunAgentOptions } from '../broker/run-agent.ts'
import { AgentInputSchema } from '../types.ts'
import type { AgentInput, BridgeConfig } from '../types.ts'

export interface CreateMcpServerOptions {
  config?: BridgeConfig
  adapters?: RunAgentOptions['adapters']
  dangerouslySkipPermissions?: boolean
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = join(__dirname, '../../package.json')
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

export function createMcpServer(options: CreateMcpServerOptions = {}): McpServer {
  const server = new McpServer({
    name: pkg.name || 'claude-workflow-cli-bridge',
    version: pkg.version || '0.0.0',
  })

  // Expose the shape of AgentInputSchema directly as the input schema for the tool.
  // We need to omit fields that shouldn't be passed or just use shape properties.
  // Zod's .shape returns the object containing the key-value schema shapes.
  server.registerTool('code_cli_bridge.run_agent', {
    title: 'Run a workflow agent through a local coding CLI',
    description: 'Routes a Claude workflow agent request to Codex, OpenCode, Gemini, or Claude through the local bridge.',
    inputSchema: AgentInputSchema.shape,
  }, async (input) => {
    const config = input.routeConfigPath
      ? await loadJsonConfig(input.routeConfigPath)
      : (options.config || {})

    const result = await runAgent(input as AgentInput, {
      config,
      adapters: options.adapters,
      dangerouslySkipPermissions: options.dangerouslySkipPermissions,
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
      structuredContent: result as unknown as Record<string, unknown>,
    }
  })

  server.registerTool('code_cli_bridge.providers', {
    title: 'List registered provider adapters',
    description: 'Lists provider adapters, capabilities, and whether their CLI command is available on PATH.',
    inputSchema: {},
  }, async () => {
    const providers = await providerStatuses(options.adapters || defaultAdapters)

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(providers, null, 2) }],
      structuredContent: { providers },
    }
  })

  return server
}
