import { GoogleGenAI } from '@google/genai';
import type { AgentTool } from '../types/index.js';

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

function getClient(apiKey: string): GoogleGenAI {
  if (cachedClient && cachedKey === apiKey) return cachedClient;
  cachedClient = new GoogleGenAI({ apiKey });
  cachedKey = apiKey;
  return cachedClient;
}

export const webSearchTool: AgentTool = {
  name: 'web_search',
  description:
    'Search the web using Google Search grounding via Gemini. Returns a synthesized answer with citations. Use this for current events, recent releases, or facts that may have changed since training.',
  permission: 'allow',
  parameters: {
    type: 'object',
    description: 'Web search arguments',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  async execute(args, ctx) {
    const query = String(args.query ?? '');
    if (!query) return { error: 'query is required' };
    if (!ctx.config.gemini.apiKey) {
      return { error: 'web_search unavailable: GEMINI_API_KEY not set' };
    }

    try {
      const client = getClient(ctx.config.gemini.apiKey);
      const response = await client.models.generateContent({
        model: ctx.config.gemini.fallbackModel,
        contents: query,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      const text = response.text ?? '';
      if (!text) return { success: true, result: '(no results)' };
      return { success: true, result: text };
    } catch (e) {
      return { error: `web_search failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};
