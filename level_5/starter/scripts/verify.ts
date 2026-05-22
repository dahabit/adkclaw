// scripts/verify.ts — offline checkpoint: type check + tests.
// Deterministic, no network, no Gemini key. Run after each codelab step.
import { execFileSync } from 'node:child_process';

const steps: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Type check', ['tsc', '--noEmit']],
  ['Tests', ['vitest', 'run']],
];

for (const [label, args] of steps) {
  process.stdout.write(`\n▶ ${label} — npx ${args.join(' ')}\n`);
  try {
    execFileSync('npx', args, { stdio: 'inherit' });
    process.stdout.write(`✓ ${label} passed\n`);
  } catch {
    process.stdout.write(
      `\n✗ ${label} failed. Fix the errors above, then re-run npm run verify.\n`,
    );
    process.exit(1);
  }
}
process.stdout.write('\n✓ verify passed — this checkpoint is green.\n');
