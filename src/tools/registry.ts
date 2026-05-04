import type { AgentTool, ToolContext, ToolResult } from '../types/index.js';

export interface RegisterOptions {
  override?: boolean;
}

export interface ApprovalGate {
  /**
   * Called before executing a tool whose permission is 'ask'.
   * Returns true to allow execution, false to refuse.
   * Default policy (no gate provided): auto-approve in dev, with a console warning.
   */
  approve(tool: AgentTool, args: Record<string, unknown>, ctx: ToolContext): Promise<boolean>;
}

export interface ToolRegistryOptions {
  approvalGate?: ApprovalGate;
}

/**
 * ToolRegistry holds the agent's runtime tool catalog and dispatches calls.
 *
 * Permission model (BRD §11.2 + Paperclip approval gate concept):
 *   - allow: execute immediately
 *   - ask:   defer to approvalGate (or auto-approve in dev with a warning)
 *   - deny:  refuse
 */
export class ToolRegistry {
  private tools = new Map<string, AgentTool>();
  private approvalGate?: ApprovalGate;

  constructor(opts: ToolRegistryOptions = {}) {
    if (opts.approvalGate) this.approvalGate = opts.approvalGate;
  }

  register(tool: AgentTool, opts: RegisterOptions = {}): void {
    if (this.tools.has(tool.name) && !opts.override) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): AgentTool | null {
    return this.tools.get(name) ?? null;
  }

  list(): AgentTool[] {
    return [...this.tools.values()];
  }

  /**
   * Returns Gemini FunctionDeclaration-shaped objects for the model.
   */
  toFunctionDeclarations(): Array<{ name: string; description: string; parameters: object }> {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { error: `Unknown tool: ${name}` };
    if (tool.permission === 'deny') {
      return { error: `Tool denied by policy: ${name}` };
    }
    if (tool.permission === 'ask') {
      const approved = this.approvalGate ? await this.approvalGate.approve(tool, args, ctx) : true;
      if (!approved) {
        return { error: `User denied tool: ${name}` };
      }
      if (!this.approvalGate) {
        // Auto-approval in dev — visible signal so this isn't accidentally shipped.
        console.warn(`[ToolRegistry] auto-approved 'ask' tool '${name}' (no ApprovalGate set)`);
      }
    }
    try {
      return await tool.execute(args, ctx);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return { error: `Tool ${name} threw: ${err}` };
    }
  }
}
