// src/server/http.ts
import express, { type Express } from 'express';
import type { AgentRunner } from '../agent/runner.js';
import type { ContextEngine } from '../context/manager.js';
import type { Compactor } from '../context/compaction.js';
import type { CronEngine } from '../cron/engine.js';
import type { SessionStore } from '../sessions/store.js';
import type { Config } from '../types/index.js';
import { adminAuth } from './middleware/admin-auth.js';

const DASHBOARD_HTML = `<!doctype html>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="5" />
<title>AdkClaw — Dashboard</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0a0e1a; color: #e2e8f0; padding: 2rem; }
  .card { background: #131a2c; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  pre { white-space: pre-wrap; word-break: break-word; }
</style>
<h1>AdkClaw — Dashboard</h1>
<div class="card"><h2>Active sessions</h2><pre id="sessions">loading…</pre></div>
<div class="card"><h2>Cron jobs</h2><pre id="cron">loading…</pre></div>
<script>
  fetch('/api/admin/status', { headers: { 'x-admin-key': localStorage.getItem('adkclaw-admin-key') || '' } })
    .then((r) => r.json()).then((s) => {
    document.getElementById('sessions').textContent = JSON.stringify(s.sessions, null, 2);
    document.getElementById('cron').textContent = JSON.stringify(s.cron, null, 2);
  });
</script>`;

export function createHttpServer(
  config: Config,
  runner: AgentRunner,
  contextEngine: ContextEngine,
  sessions: SessionStore,
  compactor: Compactor,
  cronEngine?: CronEngine,
): Express {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Live admin dashboard — a static auto-refreshing page, no build step.
  // L5 hardening folded in: gated by adminAuth middleware (x-admin-key header).
  app.get('/', adminAuth, (_req, res) => {
    res.type('html').send(DASHBOARD_HTML);
  });

  app.get('/api/admin/status', adminAuth, (_req, res) => {
    res.json({
      sessions: sessions.listSessions().map((s) => ({
        key: s.key,
        kind: s.kind,
        channel: s.channel,
        updatedAt: s.updatedAt,
      })),
      cron: cronEngine
        ? cronEngine.list().map((j) => ({ id: j.id, schedule: j.schedule, enabled: j.enabled }))
        : [],
    });
  });

  app.post('/api/chat', async (req, res) => {
    const { sessionKey, message, channel, senderId } = req.body as {
      sessionKey?: string;
      message?: string;
      channel?: string;
      senderId?: string;
    };
    if (!sessionKey || !message) {
      res.status(400).json({ error: 'sessionKey and message are required' });
      return;
    }

    try {
      const session = sessions.ensureSession(
        sessionKey,
        channel ?? 'cli',
        senderId ?? 'cli',
        config.gemini.defaultModel,
      );
      await compactor.maybeCompact(session.key);
      const history = sessions.history(session.key);
      const result = await runner.run({
        session,
        systemPrompt: contextEngine.bootstrap().systemPrompt,
        history,
        userText: message,
      });
      sessions.appendAll(session.key, result.newHistory.slice(history.length));
      res.json({ text: result.reply, toolCallCount: result.toolCalls });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return app;
}
