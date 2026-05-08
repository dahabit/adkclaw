# Extension — MCP server (expose your agent's tools to IDEs)

**Difficulty:** Medium · **What you'll learn:** turn your AdkClaw agent into a Model Context Protocol (MCP) server so any MCP-aware client (Claude Desktop, Cursor, IDE plugins) can call your tools natively.

## Why this matters

The MCP standard lets an LLM client discover and invoke tools that run in your process. Your AdkClaw agent already has 21 tools — filesystem, web_search, web_fetch, memory_save, memory_recall, browser, content generation, and more. Wrapping them in an MCP server means a developer using Claude Desktop on their laptop can ask your tools to do things, *with the same memory bank and personality*, without you building a separate IDE plugin.

This isn't replacing the agent loop. The MCP server runs alongside it: same workspace, same skills, same Vertex AI account. Different surface.

## What you'll build

- `src/channels/mcp.ts` — MCP server adapter (stdio transport for desktop clients, SSE for HTTP)
- `bin/adkclaw-mcp` — entry point Claude Desktop / Cursor invoke
- A `.mcp.json` snippet a client copies into its config to register your server
- Reuse: zero changes to `src/agent/runner.ts`, `src/tools/*`, `src/memory/*`. The MCP layer is an adapter.

## Prerequisites

- Completed Levels 1–4 (you have a running daemon with tools registered)
- Node.js 22+ locally
- Claude Desktop, Cursor, or any MCP-aware client to test against

## Steps

### 1. Install the MCP SDK

```bash
npm install @modelcontextprotocol/sdk
```

### 2. Build the adapter

`src/channels/mcp.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistry } from '../tools/registry.js';

export async function startMcpServer(registry: ToolRegistry): Promise<void> {
  const server = new Server(
    { name: 'adkclaw', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  // Discover: convert your AgentTool[] to MCP tool schema
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.list().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.parameters,
    })),
  }));

  // Invoke: call into your existing tool registry
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const result = await registry.invoke(req.params.name, req.params.arguments ?? {}, {
      sessionKey: 'mcp:default',
      workspacePath: process.env.WORKSPACE_PATH ?? './workspace',
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

### 3. Build the entry point

`bin/adkclaw-mcp` (executable):

```javascript
#!/usr/bin/env node
import 'dotenv/config';
import { ToolRegistry } from '../dist/tools/registry.js';
import { filesystemTool, webSearchTool, webFetchTool } from '../dist/tools/index.js';
import { makeMemorySaveTool, makeMemoryRecallTool } from '../dist/tools/memory.js';
import { startMcpServer } from '../dist/channels/mcp.js';

const registry = new ToolRegistry();
registry.register(filesystemTool);
registry.register(webSearchTool);
registry.register(webFetchTool);
registry.register(makeMemorySaveTool());
registry.register(makeMemoryRecallTool());

startMcpServer(registry).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Make it executable: `chmod +x bin/adkclaw-mcp`.

### 4. Register with a client

For **Claude Desktop**, add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "adkclaw": {
      "command": "/absolute/path/to/adkclaw/bin/adkclaw-mcp",
      "env": {
        "WORKSPACE_PATH": "/absolute/path/to/your/workspace"
      }
    }
  }
}
```

For **Cursor**, add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "adkclaw": {
      "command": "/absolute/path/to/adkclaw/bin/adkclaw-mcp"
    }
  }
}
```

### 5. Test the round-trip

Restart the client. Open a new chat. You should see a "Connected to MCP server: adkclaw" indicator and your tools listed. Try:

> "Save a fact: my favorite color is blue. Then recall it."

The client invokes `memory_save` then `memory_recall` against your local workspace.

## Success criteria

- [ ] `bin/adkclaw-mcp` starts cleanly when invoked from a terminal (writes nothing to stdout on success — MCP uses stdout for JSON-RPC)
- [ ] Claude Desktop shows AdkClaw as a connected MCP server with N tools listed
- [ ] At least three tools (filesystem, memory_save, memory_recall) execute successfully from the client
- [ ] Errors surface back to the client with useful messages, not raw stack traces

## Stretch

- Expose **resources** alongside tools (your `workspace/bank/` files become MCP resources the client can read directly)
- Expose **prompts** (your `workspace/skills/*.md` become reusable prompt templates the client lists)
- HTTP/SSE transport instead of stdio, for hosting your MCP server in Cloud Run
- Per-client session isolation (currently `mcp:default` is a singleton — fork it like L3 sub-agents)

## Common pitfalls

| Symptom | Fix |
|---|---|
| Client shows "MCP server crashed" | Run `bin/adkclaw-mcp` from terminal directly. Check stderr for the actual error — stdout is reserved for JSON-RPC and crashes there are silent. |
| Tools listed but every call returns "tool not found" | The registry imports point at `dist/` — make sure you ran `npm run build` first. |
| Client connects but no tools listed | Your `setRequestHandler(ListToolsRequestSchema, ...)` returns an empty array. Check the registry has `register()` calls before `startMcpServer`. |
| Memory operations succeed but data doesn't persist | `WORKSPACE_PATH` env var differs between MCP and main daemon. Set both to the same absolute path. |

## Why this is a 4th channel, not a replacement

Your agent has four channels now: Telegram, CLI, HTTP, and MCP. They're peers — same `AgentRunner`, same workspace, same memory. A user might:

- Talk to the agent on Telegram from their phone
- Ask the same agent things from Claude Desktop on their laptop (via MCP)
- Hit `/api/chat` from a script

All three see the same memory bank, the same personality, the same skills. Channels are adapters. The agent is the agent.
