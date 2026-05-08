/**
 * harness.ts — run a single eval case against a running daemon.
 *
 * Calls POST /api/chat with the case input, captures reply + tool-call trace,
 * checks each assertion. Returns { ok, failures, response }.
 *
 * The daemon must be running. The harness is HTTP-only; it does not import
 * your AgentRunner directly — that keeps the eval honest about end-to-end
 * behavior rather than unit-mocked behavior.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export interface EvalAssertion {
  type:
    | 'tool_called'
    | 'no_tool_called'
    | 'reply_contains'
    | 'reply_matches'
    | 'reply_length_lt'
    | 'reply_length_gt'
    | 'tool_round_count_eq';
  name?: string;
  value?: string | number;
}

export interface EvalCase {
  id: string;
  level: number;
  intent: string;
  preconditions?: { session: string; fixtures?: string[] };
  input: { userText: string };
  asserts: EvalAssertion[];
}

export interface AgentReply {
  reply: string;
  toolCalls?: Array<{ name: string; args: unknown }>;
  rounds?: number;
}

export interface EvalResult {
  ok: boolean;
  failures: string[];
  response: AgentReply | null;
  durationMs: number;
}

export async function runCase(
  caseFile: string,
  baseUrl: string,
  opts: { updateSnapshot?: boolean } = {},
): Promise<EvalResult> {
  const path = resolve(caseFile);
  const c = JSON.parse(readFileSync(path, 'utf8')) as EvalCase;
  const sessionKey = c.preconditions?.session ?? `eval-${c.id}`;
  const start = Date.now();

  const apiResp = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionKey, message: c.input.userText }),
  });

  const durationMs = Date.now() - start;
  if (!apiResp.ok) {
    return {
      ok: false,
      failures: [`HTTP ${apiResp.status} from /api/chat`],
      response: null,
      durationMs,
    };
  }

  const response = (await apiResp.json()) as AgentReply;
  const failures: string[] = [];

  for (const a of c.asserts) {
    const fail = checkAssertion(a, response);
    if (fail) failures.push(fail);
  }

  // Snapshot
  const snapPath = resolve(dirname(path), '..', 'snapshots', `${c.id}.json`);
  if (opts.updateSnapshot) {
    mkdirSync(dirname(snapPath), { recursive: true });
    writeFileSync(snapPath, JSON.stringify({ id: c.id, response }, null, 2));
  } else if (existsSync(snapPath)) {
    const expected = JSON.parse(readFileSync(snapPath, 'utf8')) as { response: AgentReply };
    if (expected.response.reply !== response.reply) {
      failures.push(
        `snapshot mismatch (run with --update-snapshots if intended). Expected reply: "${expected.response.reply.slice(0, 80)}…", got: "${response.reply.slice(0, 80)}…"`,
      );
    }
  }

  return { ok: failures.length === 0, failures, response, durationMs };
}

function checkAssertion(a: EvalAssertion, r: AgentReply): string | null {
  switch (a.type) {
    case 'tool_called': {
      const found = r.toolCalls?.some((c) => c.name === a.name);
      return found ? null : `expected tool_called(${a.name})`;
    }
    case 'no_tool_called': {
      const found = r.toolCalls?.some((c) => c.name === a.name);
      return found ? `expected no_tool_called(${a.name}) but it was invoked` : null;
    }
    case 'reply_contains':
      return r.reply.toLowerCase().includes(String(a.value).toLowerCase())
        ? null
        : `expected reply_contains("${a.value}")`;
    case 'reply_matches':
      return new RegExp(String(a.value)).test(r.reply)
        ? null
        : `expected reply_matches(/${a.value}/)`;
    case 'reply_length_lt':
      return r.reply.length < Number(a.value)
        ? null
        : `expected reply_length < ${a.value}, got ${r.reply.length}`;
    case 'reply_length_gt':
      return r.reply.length > Number(a.value)
        ? null
        : `expected reply_length > ${a.value}, got ${r.reply.length}`;
    case 'tool_round_count_eq':
      return r.rounds === Number(a.value) ? null : `expected rounds == ${a.value}, got ${r.rounds}`;
    default:
      return `unknown assertion type: ${(a as { type: string }).type}`;
  }
}
