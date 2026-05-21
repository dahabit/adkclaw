import type { GoogleGenAI } from '@google/genai';
import { DailyNotes } from './daily-notes.js';
import { MemoryBank, type BankCategory } from './bank.js';

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

export interface ConsolidatorOptions {
  client: GoogleGenAI;
  bank: MemoryBank;
  daily: DailyNotes;
  model: string;
}

export interface ConsolidationResult {
  date: string;
  saved: number;
  errors: string[];
}

interface ParsedConsolidation {
  facts?: Array<{ name?: unknown; content?: unknown }>;
  decisions?: Array<{ name?: unknown; content?: unknown }>;
  projects?: Array<{ name?: unknown; content?: unknown }>;
  people?: Array<{ name?: unknown; content?: unknown }>;
}

/**
 * Consolidator — promotes daily notes into the structured memory bank.
 *
 * Run end-of-day (cron) or on demand. Reads `workspace/memory/<date>.md`,
 * asks Gemini to extract facts/decisions/projects/people, writes them into
 * `workspace/bank/<category>/<slug>.md` files. Idempotent — re-running just
 * overwrites the same slug.
 */
export class Consolidator {
  private readonly client: GoogleGenAI;
  private readonly bank: MemoryBank;
  private readonly daily: DailyNotes;
  private readonly model: string;

  constructor(opts: ConsolidatorOptions) {
    this.client = opts.client;
    this.bank = opts.bank;
    this.daily = opts.daily;
    this.model = opts.model;
  }

  async consolidate(date: Date | string = new Date()): Promise<ConsolidationResult> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
    const errors: string[] = [];
    let saved = 0;

    const notes = await this.daily.read(date);
    if (!notes || !notes.trim()) {
      return { date: dateStr, saved, errors: ['No daily notes for this date'] };
    }

    let parsed: ParsedConsolidation;
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: `${CONSOLIDATION_PROMPT}\n${notes}`,
      });
      const text = response.text ?? '';
      parsed = parseJsonLoose(text);
    } catch (e) {
      errors.push(`LLM call failed: ${e instanceof Error ? e.message : String(e)}`);
      return { date: dateStr, saved, errors };
    }

    for (const cat of ['facts', 'decisions', 'projects', 'people'] as BankCategory[]) {
      const items = parsed[cat] ?? [];
      for (const item of items) {
        const name = typeof item.name === 'string' ? item.name : '';
        const content = typeof item.content === 'string' ? item.content : '';
        if (!name || !content) continue;
        try {
          await this.bank.save(cat, name, content);
          saved += 1;
        } catch (e) {
          errors.push(
            `Save failed for ${cat}/${name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    return { date: dateStr, saved, errors };
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
