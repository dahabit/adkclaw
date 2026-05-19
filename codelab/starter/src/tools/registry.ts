// src/tools/registry.ts
import type { AgentTool, ToolContext, ToolResult } from '../types/index.js';

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  list(): AgentTool[] {
    return [...this.tools.values()];
  }

  // Gemini FunctionDeclaration-shaped objects. `parameters` is widened to
  // `object` so the agent's JsonSchema flows into the SDK without friction.
  toFunctionDeclarations(): Array<{ name: string; description: string; parameters: object }> {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async invoke(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { error: `Unknown tool: ${name}` };
    }
    if (tool.permission === 'deny') {
      return { error: `Tool denied by policy: ${name}` };
    }
    try {
      return await tool.execute(args as Record<string, unknown>, ctx);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
