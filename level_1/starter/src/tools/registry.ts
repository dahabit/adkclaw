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
  //REPLACE-TOOL-REGISTRY
  // Convert your registered tools into the Gemini SDK's FunctionDeclaration format,
  // and then execute tool calls with safety checks (permission, errors, etc).
  // Fill this in from level_1/codelab.md §3.
  toFunctionDeclarations(): Array<{ name: string; description: string; parameters: object }> {
    throw new Error('REPLACE-TOOL-REGISTRY not implemented — see level_1/codelab.md §3');
  }

  async invoke(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult> {
    throw new Error('REPLACE-TOOL-REGISTRY not implemented — see level_1/codelab.md §3');
  }
}
