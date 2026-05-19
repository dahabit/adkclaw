// src/tools/web.ts
import type { AgentTool } from '../types/index.js';

export const webSearchTool: AgentTool = {
  name: 'web_search',
  description:
    'Search the web for current, factual information. Use for news, recent ' +
    'events, version numbers, or anything time-sensitive.',
  permission: 'allow',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  //REPLACE-TOOL-WEB
  // Implement both web_search and web_fetch execute bodies.
  // For now, web_search returns a stub so the loop works end-to-end.
  // web_fetch actually fetches and returns the page content.
  // Fill this in from level_1/codelab.md §4.
  async execute(args) {
    throw new Error('REPLACE-TOOL-WEB not implemented — see level_1/codelab.md §4');
  },
};

export const webFetchTool: AgentTool = {
  name: 'web_fetch',
  description:
    'Fetch the contents of a public URL and return them as plain text. Use ' +
    'when the user gives you a URL to summarize or extract data from.',
  permission: 'allow',
  parameters: {
    type: 'object',
    properties: { url: { type: 'string' } },
    required: ['url'],
  },
  async execute(args) {
    throw new Error('REPLACE-TOOL-WEB not implemented — see level_1/codelab.md §4');
  },
};
