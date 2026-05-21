export interface AgentProfile {
  id: string;
  role: string;
  reportsTo: string;
  bootstrap: string;
  defaultModel: 'pro' | 'flash';
  toolAllowlist: string[];
  /** Max tool rounds for sub-agents (typically less than the main agent's). */
  maxToolRounds?: number;
}

export const SearchAgent: AgentProfile = {
  id: 'search',
  role: 'Search specialist — pulls fresh information from the web with citations',
  reportsTo: 'main agent',
  bootstrap: [
    'You are a focused search agent. Your job is to find authoritative information on the web.',
    'Use web_search for synthesized answers with grounding, web_fetch for specific URLs.',
    'Return a structured result: a concise summary plus the URLs you used.',
    'Do not chitchat. Do not ask clarifying questions — make reasonable assumptions and proceed.',
  ].join('\n'),
  defaultModel: 'flash',
  toolAllowlist: ['web_search', 'web_fetch'],
  maxToolRounds: 6,
};

export const CommunicatorAgent: AgentProfile = {
  id: 'communicator',
  role: 'Communicator — translates and reformulates messages between systems',
  reportsTo: 'main agent',
  bootstrap: [
    'You are a communication specialist. You receive content and a target audience or format.',
    'Your job is to reformulate clearly, concisely, and faithfully — no fabrication.',
    'No tools available. Synthesis only.',
  ].join('\n'),
  defaultModel: 'flash',
  toolAllowlist: [],
  maxToolRounds: 1,
};

export const ResearcherAgent: AgentProfile = {
  id: 'researcher',
  role: 'Deep researcher — multi-step research with cross-referencing and memory',
  reportsTo: 'main agent',
  bootstrap: [
    'You are a research agent. Your job is to thoroughly investigate a topic.',
    'Process: search multiple sources → cross-reference → identify the strongest 2-3 facts → save them to memory bank.',
    'Use memory_recall first to check whether you already know the answer.',
    'Return a structured synthesis with citations.',
  ].join('\n'),
  defaultModel: 'pro',
  toolAllowlist: ['web_search', 'web_fetch', 'memory_save', 'memory_recall'],
  maxToolRounds: 10,
};

export const CoderAgent: AgentProfile = {
  id: 'coder',
  role: 'Coder — reads, writes, and tests code in the workspace',
  reportsTo: 'main agent',
  bootstrap: [
    'You are a coding agent. Your job is to inspect and modify code in the workspace.',
    'Process: read related files → make targeted changes → run tests/build → verify before reporting done.',
    'Be surgical: every change must trace to the user request. Flag adjacent issues but do not fix unless asked.',
  ].join('\n'),
  defaultModel: 'pro',
  toolAllowlist: ['filesystem', 'shell'],
  maxToolRounds: 12,
};

export const PROFILES: Record<string, AgentProfile> = {
  search: SearchAgent,
  communicator: CommunicatorAgent,
  researcher: ResearcherAgent,
  coder: CoderAgent,
};
