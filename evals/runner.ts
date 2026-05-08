#!/usr/bin/env tsx
/**
 * runner.ts — eval CLI entry. Discovers all `cases/*.json`, runs each
 * against the running daemon, prints a report, exits 0 or 1.
 *
 * Usage:
 *   npx tsx evals/runner.ts
 *   npx tsx evals/runner.ts --update-snapshots
 *   npx tsx evals/runner.ts --filter=L1
 */

import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { runCase, type EvalResult } from './harness.js';

const GREEN = '\x1b[0;32m';
const RED = '\x1b[0;31m';
const NC = '\x1b[0m';

const BASE_URL =
  process.env.ADKCLAW_API_BASE ??
  `http://${process.env.HOST ?? 'localhost'}:${process.env.PORT ?? '3000'}`;

const args = process.argv.slice(2);
const updateSnapshot = args.includes('--update-snapshots');
const filterArg = args.find((a) => a.startsWith('--filter='));
const filter = filterArg ? filterArg.slice('--filter='.length) : null;

async function main(): Promise<void> {
  const dir = resolve(process.cwd(), 'evals/cases');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !filter || f.includes(filter));

  if (files.length === 0) {
    console.log('no eval cases matched');
    process.exit(0);
  }

  console.log(`\nRunning ${files.length} case(s) against ${BASE_URL}\n`);

  const results: Array<{ id: string; r: EvalResult }> = [];
  for (const f of files) {
    const id = f.replace(/\.json$/, '');
    process.stdout.write(`  ${id} ... `);
    try {
      const r = await runCase(resolve(dir, f), BASE_URL, { updateSnapshot });
      results.push({ id, r });
      console.log(
        r.ok
          ? `${GREEN}PASS${NC} (${r.durationMs}ms)`
          : `${RED}FAIL${NC} (${r.durationMs}ms): ${r.failures.join('; ')}`,
      );
    } catch (e) {
      results.push({
        id,
        r: { ok: false, failures: [(e as Error).message], response: null, durationMs: 0 },
      });
      console.log(`${RED}ERROR${NC}: ${(e as Error).message}`);
    }
  }

  const failed = results.filter((x) => !x.r.ok).length;
  console.log('');
  if (failed === 0) {
    console.log(`${GREEN}All ${results.length} case(s) passed${NC}`);
    process.exit(0);
  }
  console.log(`${RED}${failed}/${results.length} case(s) failed${NC}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
