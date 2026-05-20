
import type { GoogleGenAI } from '@google/genai';
import { BANK_CATEGORIES, type BankCategory, type MemoryBank } from './bank.js';
import type { DailyNotes } from './daily-notes.js';

export interface ConsolidationResult {
  date: Date | string;
  saved: number;
  errors: string[];
}

type ParsedConsolidation = Partial<
  Record<BankCategory, Array<{ name?: string; content?: string }>>
>;

const CONSOLIDATION_PROMPT = `
You're consolidating a day of agent activity into structured long-term memory.

Read the daily notes below. Output JSON with this shape:
{
  "facts":     [{"name": "string", "content": "string"}],
  "decisions": [{"name": "string", "content": "string"}],
  "projects":  [{"name": "string", "content": "string"}],
  "people":    [{"name": "string", "content": "string"}]
}

Rules:
- "facts" = verified, durable facts about the user or the world (not session ephemera).
- "decisions" = choices made today with their rationale.
- "projects" = ongoing work with current status.
- "people" = people mentioned with relevant context.
- Skip categories where nothing belongs.
- Output JSON ONLY, no preamble.

DAILY NOTES:
`.trim();

export class Consolidator {
  // but does not show the constructor).
  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly daily: DailyNotes;
  private readonly bank: MemoryBank;

  constructor(opts: { client: GoogleGenAI; model: string; daily: DailyNotes; bank: MemoryBank }) {
    this.client = opts.client;
    this.model = opts.model;
    this.daily = opts.daily;
    this.bank = opts.bank;
  }

  async consolidate(date: Date | string = new Date()): Promise<ConsolidationResult> {
    const notes = await this.daily.read(date);
    if (!notes?.trim()) return { date, saved: 0, errors: ['No daily notes'] };

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: `${CONSOLIDATION_PROMPT}\n${notes}`,
    });
    const parsed = parseJsonLoose(response.text ?? '');

    let saved = 0;
    for (const cat of BANK_CATEGORIES) {
      for (const item of parsed[cat] ?? []) {
        if (item.name && item.content) {
          await this.bank.save(cat, item.name, item.content);
          saved += 1;
        }
      }
    }
    return { date, saved, errors: [] };
  }
}

function parseJsonLoose(text: string): ParsedConsolidation {
  // Strip markdown fences if Gemini wrapped it
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as ParsedConsolidation;
  } catch {
    // Try to extract first {...} block
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as ParsedConsolidation;
      } catch {
        return {};
      }
    }
    return {};
  }
}
