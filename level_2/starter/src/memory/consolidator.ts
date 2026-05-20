
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
    //REPLACE-MEMORY-CONSOLIDATOR
    // Read the day's notes, ask Gemini to extract structured memory, save it to the bank.
    // From level_2/codelab.md §5 "The consolidator".
    throw new Error('REPLACE-MEMORY-CONSOLIDATOR not implemented — see level_2/codelab.md §5');
  }
}

function parseJsonLoose(text: string): ParsedConsolidation {
  //REPLACE-MEMORY-CONSOLIDATOR
  // From level_2/codelab.md §5 "The consolidator" (parseJsonLoose helper).
  throw new Error('REPLACE-MEMORY-CONSOLIDATOR not implemented — see level_2/codelab.md §5');
}
