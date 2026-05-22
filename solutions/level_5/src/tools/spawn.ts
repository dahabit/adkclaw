import type { AgentTool } from '../types/index.js';
import type { MultiAgentOrchestrator } from '../multi-agent/orchestrator.js';
import { PROFILES } from '../multi-agent/profiles/index.js';

interface SpawnArgs {
  task: string;
  goalChain?: string[];
  profileId?: string;
}

function describeProfile(id: string): string {
  const p = PROFILES[id];
  return p ? `${p.role}` : id;
}

function genericSpawnDescription(): string {
  const list = Object.keys(PROFILES)
    .map((k) => `${k} (${describeProfile(k)})`)
    .join('; ');
  return [
    'Spawn a sub-agent to handle one focused task in an isolated session.',
    "The sub-agent does NOT see this conversation's history — pass everything it needs in `task`.",
    'It DOES inherit identity, memory bank, and skills.',
    `Available profiles: ${list}.`,
    'Use this when a task would otherwise consume too much of your context, or needs a specialist.',
  ].join(' ');
}

export function makeSpawnAgentTool(orchestrator: MultiAgentOrchestrator): AgentTool {
  return {
    name: 'spawn_agent',
    description: genericSpawnDescription(),
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'Sub-agent spawn request',
      properties: {
        task: { type: 'string', description: 'The specific task for the sub-agent' },
        profileId: {
          type: 'string',
          description: 'Optional named profile',
          enum: Object.keys(PROFILES),
        },
        goalChain: {
          type: 'array',
          description: 'Goal ancestry — outermost goal first, immediate task last',
          items: { type: 'string', description: 'Goal step' },
        },
      },
      required: ['task'],
    },
    async execute(args, ctx) {
      const a = args as Partial<SpawnArgs>;
      if (!a.task) return { error: 'task is required' };
      const result = await orchestrator.spawn({
        task: a.task,
        parentSessionKey: ctx.session.key,
        ...(a.profileId !== undefined ? { profileId: a.profileId } : {}),
        ...(a.goalChain !== undefined ? { goalChain: a.goalChain } : {}),
      });
      if (!result.ok) {
        return { error: `Sub-agent (${result.profileId ?? 'ad-hoc'}) failed: ${result.error}` };
      }
      const meta = `${result.toolCalls} tools, ${result.tokensUsed} tokens, ${result.durationMs}ms`;
      return {
        success: true,
        result: `Sub-agent (${result.profileId ?? 'ad-hoc'}) finished — ${meta}\n\n${result.summary}`,
      };
    },
  };
}

function makeProfileSpawnTool(
  orchestrator: MultiAgentOrchestrator,
  profileId: string,
  toolName: string,
): AgentTool {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`Unknown profile: ${profileId}`);
  return {
    name: toolName,
    description: `Spawn a ${profileId} sub-agent. ${profile.role}. Sub-agent runs in isolation with its own context, returns a structured result.`,
    permission: 'allow',
    parameters: {
      type: 'object',
      description: `${profileId} sub-agent task`,
      properties: {
        task: { type: 'string', description: 'The specific task for the sub-agent' },
        goalChain: {
          type: 'array',
          description: 'Goal ancestry — outermost goal first',
          items: { type: 'string', description: 'Goal step' },
        },
      },
      required: ['task'],
    },
    async execute(args, ctx) {
      const task = String(args.task ?? '');
      if (!task) return { error: 'task is required' };
      const goalChain = Array.isArray(args.goalChain)
        ? (args.goalChain as unknown[]).map(String)
        : undefined;
      const result = await orchestrator.spawn({
        task,
        parentSessionKey: ctx.session.key,
        profileId,
        ...(goalChain !== undefined ? { goalChain } : {}),
      });
      if (!result.ok) {
        return { error: `${profileId} sub-agent failed: ${result.error}` };
      }
      const meta = `${result.toolCalls} tools, ${result.tokensUsed} tokens, ${result.durationMs}ms`;
      return {
        success: true,
        result: `${profileId} sub-agent finished — ${meta}\n\n${result.summary}`,
      };
    },
  };
}

export function makeSpawnSearchTool(o: MultiAgentOrchestrator): AgentTool {
  return makeProfileSpawnTool(o, 'search', 'spawn_search');
}
export function makeSpawnCommunicatorTool(o: MultiAgentOrchestrator): AgentTool {
  return makeProfileSpawnTool(o, 'communicator', 'spawn_communicator');
}
export function makeSpawnResearcherTool(o: MultiAgentOrchestrator): AgentTool {
  return makeProfileSpawnTool(o, 'researcher', 'spawn_researcher');
}
export function makeSpawnCoderTool(o: MultiAgentOrchestrator): AgentTool {
  return makeProfileSpawnTool(o, 'coder', 'spawn_coder');
}
