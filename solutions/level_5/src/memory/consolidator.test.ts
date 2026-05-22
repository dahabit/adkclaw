import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Consolidator } from './consolidator.js';
import { MemoryBank } from './bank.js';
import { DailyNotes } from './daily-notes.js';
import type { GoogleGenAI } from '@google/genai';

let workspace: string;
let bank: MemoryBank;
let daily: DailyNotes;
let client: GoogleGenAI;

beforeEach(() => {
  vi.clearAllMocks();
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-consolidator-'));
  bank = new MemoryBank({ workspacePath: workspace });
  daily = new DailyNotes({ workspacePath: workspace });
  client = {
    models: {
      generateContent: vi.fn(),
    },
  } as unknown as GoogleGenAI;
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('Consolidator', () => {
  it('consolidates daily notes into structured memory', async () => {
    const testDate = new Date('2025-01-01');
    await daily.append('User loves coffee at 7am and takes 2 sugars.', testDate);
    await daily.append('Decided to use Gemini 3.1 for the agent framework.', testDate);
    await daily.append('AdkClaw workshop prep — 80% done, 4 codelabs ready.', testDate);
    await daily.append('Met with Ahmed, who leads the Flutter GDE program.', testDate);

    (client.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({
        facts: [
          { name: 'Coffee preference', content: 'Drinks coffee at 7am with 2 sugars' },
        ],
        decisions: [
          {
            name: 'Gemini 3.1 adoption',
            content: 'Selected Gemini 3.1 as the LLM backbone for agent framework.',
          },
        ],
        projects: [
          {
            name: 'AdkClaw workshop',
            content: 'Workshop prep 80% complete, 4 codelabs ready for delivery.',
          },
        ],
        people: [
          { name: 'Ahmed', content: 'Leads Flutter GDE program' },
        ],
      }),
    });

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate(testDate);

    expect(result.saved).toBe(4);
    expect(result.errors).toEqual([]);

    const facts = await bank.read('facts', 'coffee-preference');
    expect(facts?.content).toContain('7am');
  });

  it('handles missing daily notes gracefully', async () => {
    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate('2025-01-01');

    expect(result.saved).toBe(0);
    expect(result.errors).toContain('No daily notes for this date');
  });

  it('handles LLM call errors', async () => {
    const testDate = new Date('2025-01-01');
    await daily.append('Some fact', testDate);

    (client.models.generateContent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('API rate limit exceeded')
    );

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate(testDate);

    expect(result.saved).toBe(0);
    expect(result.errors).toContain('LLM call failed: API rate limit exceeded');
  });

  it('parses JSON response with markdown fences', async () => {
    const testDate = new Date('2025-01-01');
    await daily.append('User fact', testDate);

    (client.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: '```json\n{"facts": [{"name": "F1", "content": "C1"}]}\n```',
    });

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate(testDate);

    expect(result.saved).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('extracts JSON from malformed response', async () => {
    const testDate = new Date('2025-01-01');
    await daily.append('User fact', testDate);

    (client.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: 'Some preamble\n{"facts": [{"name": "F1", "content": "C1"}]}\nSome epilogue',
    });

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate(testDate);

    expect(result.saved).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('skips items with missing name or content', async () => {
    const testDate = new Date('2025-01-01');
    await daily.append('Some notes', testDate);

    (client.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({
        facts: [
          { name: 'Valid', content: 'Content' },
          { name: '', content: 'Empty name' },
          { name: 'Empty content', content: '' },
          { name: null, content: 'Type mismatch' },
          { name: 'Valid 2', content: 'Content 2' },
        ],
      }),
    });

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate(testDate);

    expect(result.saved).toBe(2); // Only the two with both name and content
  });

  it('handles bank save errors per item', async () => {
    const testDate = new Date('2025-01-01');
    await daily.append('User fact', testDate);

    (client.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({
        facts: [
          { name: 'Good item', content: 'OK' },
          { name: 'Bad item', content: 'Will fail' },
          { name: 'Another good', content: 'OK too' },
        ],
      }),
    });

    // Mock bank.save to fail on second call
    let callCount = 0;
    const originalSave = bank.save.bind(bank);
    vi.spyOn(bank, 'save').mockImplementation(async (...args) => {
      callCount += 1;
      if (callCount === 2) {
        throw new Error('Disk full');
      }
      return originalSave(...args);
    });

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate(testDate);

    expect(result.saved).toBe(2);
    expect(result.errors).toContainEqual(
      expect.stringContaining('Save failed for facts/Bad item: Disk full')
    );
  });

  it('returns string date unchanged', async () => {
    await daily.append('Some fact');

    (client.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({
        facts: [{ name: 'F1', content: 'C1' }],
      }),
    });

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate('2024-12-25');

    expect(result.date).toBe('2024-12-25');
  });

  it('converts Date to ISO string for date field', async () => {
    const testDate = new Date('2025-05-19T00:00:00Z');
    await daily.append('Fact', testDate);

    (client.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({
        facts: [{ name: 'F', content: 'C' }],
      }),
    });

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate(testDate);

    expect(result.date).toBe('2025-05-19');
  });

  it('handles JSON parse failure gracefully', async () => {
    const testDate = new Date('2025-01-01');
    await daily.append('Some fact', testDate);

    (client.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: 'This is not JSON at all',
    });

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate(testDate);

    // Should return empty result with no saved items (parseJsonLoose returns {})
    expect(result.saved).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('processes all four categories', async () => {
    const testDate = new Date('2025-01-01');
    await daily.append('F', testDate);
    await daily.append('D', testDate);
    await daily.append('P', testDate);
    await daily.append('Pe', testDate);

    (client.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify({
        facts: [{ name: 'Fact 1', content: 'C1' }],
        decisions: [{ name: 'Decision 1', content: 'C2' }],
        projects: [{ name: 'Project 1', content: 'C3' }],
        people: [{ name: 'Person 1', content: 'C4' }],
      }),
    });

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-flash',
    });

    const result = await consolidator.consolidate(testDate);

    expect(result.saved).toBe(4);

    const f = await bank.read('facts', 'fact-1');
    expect(f?.content).toBe('C1');

    const d = await bank.read('decisions', 'decision-1');
    expect(d?.content).toBe('C2');

    const p = await bank.read('projects', 'project-1');
    expect(p?.content).toBe('C3');

    const pe = await bank.read('people', 'person-1');
    expect(pe?.content).toBe('C4');
  });

  it('uses correct model in LLM call', async () => {
    const testDate = new Date('2025-01-01');
    await daily.append('Fact', testDate);

    const generateContentMock = vi
      .fn()
      .mockResolvedValue({ text: '{"facts": []}' });
    client.models.generateContent = generateContentMock;

    const consolidator = new Consolidator({
      client,
      bank,
      daily,
      model: 'gemini-3-pro',
    });

    await consolidator.consolidate(testDate);

    const call = generateContentMock.mock.calls[0]?.[0] as
      | { model?: string }
      | undefined;
    expect(call?.model).toBe('gemini-3-pro');
  });
});
