/**
 * `adkclaw audit` — wrapper that delegates to scripts/audit-security.ts.
 *
 * Shipped as a CLI subcommand so students can run `npx adkclaw audit` after
 * deploying without remembering the script path.
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

export function audit(): Promise<number> {
  return new Promise((res) => {
    const script = resolve(process.cwd(), 'scripts/audit-security.ts');
    const child = spawn('npx', ['tsx', script], { stdio: 'inherit' });
    child.on('exit', (code) => res(code ?? 1));
  });
}
