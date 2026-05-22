import type { Session } from './session.js';
import type { Config } from './config.js';

export type ToolPermission = 'allow' | 'ask' | 'deny';

export interface ToolResult {
  success?: boolean;
  result?: string;
  error?: string;
}

export interface ToolContext {
  session: Session;
  workspacePath: string;
  config: Config;
}

export interface JsonSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array' | 'integer';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number)[];
}

export interface AgentTool {
  name: string;
  description: string;
  permission: ToolPermission;
  parameters: JsonSchema;
  fallbackToolName?: string;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
