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
  async execute(args) {
    const query = String(args.query ?? '');
    if (!query) return { error: 'query is required' };
    // Stub for now — returns a placeholder so you can see the loop wire
    // through end-to-end. Level 3 swaps this for Gemini search grounding.
    return {
      success: true,
      result: `(stub) search results for "${query}". Level 3 wires real grounding.`,
    };
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
    const url = String(args.url ?? '');
    if (!url) return { error: 'url is required' };
    const res = await fetch(url);
    if (!res.ok) return { error: `HTTP ${res.status} for ${url}` };
    const text = await res.text();
    return { success: true, result: text.slice(0, 16_000) };
  },
};
