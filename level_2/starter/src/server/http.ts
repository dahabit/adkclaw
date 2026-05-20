// src/server/http.ts
import express, { type Express } from 'express';
import type { AgentRunner } from '../agent/runner.js';
import type { ContextEngine } from '../context/manager.js';
import type { Compactor } from '../context/compaction.js';
import type { SessionStore } from '../sessions/store.js';
import type { Config } from '../types/index.js';

export function createHttpServer(
  config: Config,
  runner: AgentRunner,
  contextEngine: ContextEngine,
  sessions: SessionStore,
  compactor: Compactor,
): Express {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
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
