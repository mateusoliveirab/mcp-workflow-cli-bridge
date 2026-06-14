#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './mcp/create-server.ts'

const server = createMcpServer()
const transport = new StdioServerTransport()

await server.connect(transport)
