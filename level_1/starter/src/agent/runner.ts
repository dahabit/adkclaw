// src/agent/runner.ts
import { GoogleGenAI, type Content, type FunctionCall, type Part } from '@google/genai';
import type { Config, Session, ToolContext } from '../types/index.js';
import type { ToolRegistry } from '../tools/registry.js';

// MAX_TOOL_ROUNDS caps the loop so a misbehaving model can't ping-pong tools
// forever. 15 is more than enough for any real task — hitting it is a bug
// worth investigating, not a value to bump.
const MAX_TOOL_ROUNDS = 15;

export interface RunRequest {
  session: Session;
  systemPrompt: string;
  history: Content[];
  userText: string;
}

export interface RunResult {
  reply: string;
  toolCalls: number;
  rounds: number;
  newHistory: Content[];
}

export class AgentRunner {
  constructor(
    private readonly client: GoogleGenAI,
    private readonly registry: ToolRegistry,
    private readonly config: Config,
  ) {}

  async run(req: RunRequest): Promise<RunResult> {
    //REPLACE-AGENT-LOOP
    // The agent loop: call Gemini, run any tool calls it requests, feed the
    // results back, and repeat until the model returns a plain-text answer.
    // Fill this in from level_1/codelab.md §3 "The agent loop".
    throw new Error('REPLACE-AGENT-LOOP not implemented — see level_1/codelab.md §3');
  }
}
