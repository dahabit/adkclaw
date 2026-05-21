import type { AgentTool } from '../types/index.js';
import { MemoryBank, BANK_CATEGORIES } from '../memory/bank.js';
import { DailyNotes } from '../memory/daily-notes.js';

export function makeMemorySaveTool(): AgentTool {
  return {
    name: 'memory_save',
    description:
      'Save a fact, decision, project note, or person profile to the long-term memory bank. Use this whenever you learn something durable about the user or the world.',
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'Memory bank entry',
      properties: {
        category: {
          type: 'string',
          description: 'One of: facts, decisions, projects, people',
          enum: [...BANK_CATEGORIES],
        },
        name: { type: 'string', description: 'Short title (e.g. "User drinks coffee")' },
        content: { type: 'string', description: 'Full content / details / rationale' },
      },
      required: ['category', 'name', 'content'],
    },
    async execute(args, ctx) {
      const category = String(args.category ?? '');
      const name = String(args.name ?? '');
      const content = String(args.content ?? '');
      if (!MemoryBank.isValidCategory(category)) {
        return { error: `Invalid category. Must be one of: ${BANK_CATEGORIES.join(', ')}` };
      }
      if (!name || !content) return { error: 'name and content are required' };
      const bank = new MemoryBank({ workspacePath: ctx.workspacePath });
      const entry = await bank.save(category, name, content);
      return { success: true, result: `Saved bank/${category}/${entry.slug}.md` };
    },
  };
}

export function makeMemoryRecallTool(): AgentTool {
  return {
    name: 'memory_recall',
    description:
      'Search the long-term memory bank by query, optionally filtered by category. Returns matching entries (name + preview).',
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'Memory recall query',
      properties: {
        query: { type: 'string', description: 'Search terms (matches name + preview)' },
        category: {
          type: 'string',
          description: 'Optional: facts | decisions | projects | people',
          enum: [...BANK_CATEGORIES],
        },
        limit: { type: 'integer', description: 'Max results (default 20)' },
      },
      required: ['query'],
    },
    async execute(args, ctx) {
      const query = String(args.query ?? '');
      const category =
        typeof args.category === 'string' && MemoryBank.isValidCategory(args.category)
          ? args.category
          : undefined;
      const limit = typeof args.limit === 'number' ? args.limit : 20;
      const bank = new MemoryBank({ workspacePath: ctx.workspacePath });
      const opts: { category?: typeof category; limit: number } = { limit };
      if (category) opts.category = category;
      const results = await bank.recall(query, opts);
      if (results.length === 0) return { success: true, result: '(no matches)' };
      const formatted = results
        .map((r) => `- [${r.category}/${r.slug}] **${r.name}** — ${r.preview}`)
        .join('\n');
      return { success: true, result: formatted };
    },
  };
}

export function makeDailyAppendTool(): AgentTool {
  return {
    name: 'daily_append',
    description:
      "Append a short note to today's daily journal. Use this for events, observations, and reminders that should be captured now and consolidated later.",
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'Daily note entry',
      properties: {
        text: { type: 'string', description: 'What happened or what to remember' },
      },
      required: ['text'],
    },
    async execute(args, ctx) {
      const text = String(args.text ?? '');
      if (!text) return { error: 'text is required' };
      const daily = new DailyNotes({ workspacePath: ctx.workspacePath });
      await daily.append(text);
      return { success: true, result: `Appended to today's daily note.` };
    },
  };
}
