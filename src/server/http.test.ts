import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { AgentRunner } from '../agent/runner.js';
import type { Config } from '../types/index.js';
import type { SessionStore } from '../sessions/store.js';
import { createHttpServer } from './http.js';

function mkReq(
  body?: unknown,
  params?: Record<string, string>,
  method?: string,
): Request & { params?: Record<string, string> } {
  return {
    body,
    params,
    method,
  } as Request & { params?: Record<string, string> };
}

function mkRes(): Response & {
  _status?: number;
  _json?: unknown;
  _sent?: string;
  _headers?: Record<string, string>;
} {
  const r: Response & {
    _status?: number;
    _json?: unknown;
    _sent?: string;
    _headers?: Record<string, string>;
  } = {
    status(s: number) {
      r._status = s;
      return r;
    },
    json(o: unknown) {
      r._json = o;
      return r;
    },
    send(data: string) {
      r._sent = data;
      return r;
    },
    setHeader(k: string, v: string) {
      r._headers = r._headers || {};
      r._headers[k] = v;
      return r;
    },
  } as Response & {
    _status?: number;
    _json?: unknown;
    _sent?: string;
    _headers?: Record<string, string>;
  };
  return r;
}

describe('createHttpServer', () => {
  let mockConfig: Config;
  let mockRunner: AgentRunner;
  let mockSessions: SessionStore;

  beforeEach(() => {
    mockConfig = {
      agent: { name: 'TestAgent' },
      gemini: { defaultModel: 'gemini-3-flash-preview' },
    } as Config;

    mockRunner = {
      run: vi.fn(async () => ({
        ok: true,
        response: 'test response',
        sessionKey: 'test-key',
        tokens: { input: 10, output: 20 },
      })),
    } as unknown as AgentRunner;

    mockSessions = {
      listSessions: vi.fn(() => [
        {
          key: 'session-1',
          channel: 'http',
          isArchived: false,
          totalTokens: 100,
          lastMessageAt: new Date().toISOString(),
        },
        {
          key: 'session-2',
          channel: 'telegram',
          isArchived: true,
          totalTokens: 50,
          lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ]),
      getSession: vi.fn((key: string) => {
        if (key === 'session-1') {
          return {
            key: 'session-1',
            channel: 'http',
            isArchived: false,
            totalTokens: 100,
          };
        }
        return null;
      }),
      listMessages: vi.fn(() => [
        { id: 'msg-1', text: 'hello', role: 'user' },
        { id: 'msg-2', text: 'hi there', role: 'assistant' },
      ]),
      getLatestCheckpoint: vi.fn(() => ({
        id: 'cp-1',
        sessionKey: 'session-1',
        data: { some: 'checkpoint' },
      })),
      archiveSession: vi.fn(),
    } as unknown as SessionStore;
  });

  describe('GET /', () => {
    it('returns HTML dashboard', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const handler = app._router.stack.find((r: any) => r.route?.path === '/');
      handler.route.stack[0].handle(mkReq(), res);

      expect(res._headers?.['Content-Type']).toBe('text/html; charset=utf-8');
      expect(res._sent).toContain('AdkClaw');
      expect(res._sent).toContain('<!DOCTYPE html>');
    });
  });

  describe('GET /api/health', () => {
    it('returns {ok: true}', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/health');
      handler.route.stack[0].handle(mkReq(), res);

      expect(res._json).toEqual({ ok: true });
    });
  });

  describe('GET /api/status', () => {
    it('returns status with agent name, model, and counts', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/status');
      handler.route.stack[0].handle(mkReq(), res);

      expect(res._json).toEqual(
        expect.objectContaining({
          ok: true,
          agentName: 'TestAgent',
          defaultModel: 'gemini-3-flash-preview',
          activeSessionCount: 1,
          totalSessionCount: 2,
          totalTokensAllTime: 150,
        }),
      );
    });

    it('groups sessions by channel', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/status');
      handler.route.stack[0].handle(mkReq(), res);

      const json = res._json as any;
      expect(json.sessionsByChannel).toEqual({ http: 1 }); // only active sessions
    });

    it('includes uptime in seconds', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/status');
      handler.route.stack[0].handle(mkReq(), res);

      const json = res._json as any;
      expect(json.uptimeSec).toBeDefined();
      expect(typeof json.uptimeSec).toBe('number');
    });

    it('limits sessions array to 50 items', () => {
      const manyMockSessions = {
        ...mockSessions,
        listSessions: vi.fn(() =>
          Array.from({ length: 100 }, (_, i) => ({
            key: `session-${i}`,
            channel: 'http',
            isArchived: false,
            totalTokens: 10,
            lastMessageAt: new Date().toISOString(),
          })),
        ),
      };
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: manyMockSessions as unknown as SessionStore,
      });
      const res = mkRes();
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/status');
      handler.route.stack[0].handle(mkReq(), res);

      const json = res._json as any;
      expect(json.sessions.length).toBeLessThanOrEqual(50);
    });
  });

  describe('POST /api/chat', () => {
    it('returns 400 when sessionKey is missing', async () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq({ message: 'hello' });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/chat');
      await handler.route.stack[0].handle(req, res, () => {});

      expect(res._status).toBe(400);
      expect(res._json).toEqual(
        expect.objectContaining({ error: expect.stringContaining('sessionKey') }),
      );
    });

    it('returns 400 when message is missing', async () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq({ sessionKey: 'test-key' });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/chat');
      await handler.route.stack[0].handle(req, res, () => {});

      expect(res._status).toBe(400);
      expect(res._json).toEqual(
        expect.objectContaining({ error: expect.stringContaining('message') }),
      );
    });

    it('calls runner.run with correct parameters', async () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq({
        sessionKey: 'test-key',
        message: 'hello',
        senderId: 'user-123',
        channel: 'http',
        target: 'target-123',
      });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/chat');
      await handler.route.stack[0].handle(req, res, () => {});

      expect(mockRunner.run).toHaveBeenCalledWith({
        sessionKey: 'test-key',
        message: 'hello',
        channel: 'http',
        target: 'target-123',
        senderId: 'user-123',
      });
    });

    it('defaults channel to http', async () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq({ sessionKey: 'test-key', message: 'hello' });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/chat');
      await handler.route.stack[0].handle(req, res, () => {});

      expect(mockRunner.run).toHaveBeenCalledWith(expect.objectContaining({ channel: 'http' }));
    });

    it('defaults senderId to http', async () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq({ sessionKey: 'test-key', message: 'hello' });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/chat');
      await handler.route.stack[0].handle(req, res, () => {});

      expect(mockRunner.run).toHaveBeenCalledWith(expect.objectContaining({ senderId: 'http' }));
    });

    it('defaults target to sessionKey', async () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq({ sessionKey: 'test-key', message: 'hello' });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/chat');
      await handler.route.stack[0].handle(req, res, () => {});

      expect(mockRunner.run).toHaveBeenCalledWith(expect.objectContaining({ target: 'test-key' }));
    });

    it('returns runner result', async () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq({ sessionKey: 'test-key', message: 'hello' });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/chat');
      await handler.route.stack[0].handle(req, res, () => {});

      expect(res._json).toEqual({
        ok: true,
        response: 'test response',
        sessionKey: 'test-key',
        tokens: { input: 10, output: 20 },
      });
    });

    it('calls next on error', async () => {
      const errorRunner = {
        run: vi.fn(async () => {
          throw new Error('runner failed');
        }),
      } as unknown as AgentRunner;
      const app = createHttpServer({
        config: mockConfig,
        runner: errorRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq({ sessionKey: 'test-key', message: 'hello' });
      let nextCalled = false;
      let errorPassed: unknown;
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/chat');
      await handler.route.stack[0].handle(req, res, (err?: unknown) => {
        nextCalled = true;
        errorPassed = err;
      });

      expect(nextCalled).toBe(true);
      expect(errorPassed).toBeInstanceOf(Error);
    });
  });

  describe('GET /api/sessions', () => {
    it('returns list of all sessions', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/sessions');
      handler.route.stack[0].handle(mkReq(), res);

      expect(res._json).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'session-1' }),
          expect.objectContaining({ key: 'session-2' }),
        ]),
      );
    });
  });

  describe('GET /api/sessions/:key', () => {
    it('returns 404 when session not found', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq(undefined, { key: 'nonexistent' });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/sessions/:key');
      handler.route.stack[0].handle(req, res);

      expect(res._status).toBe(404);
      expect(res._json).toEqual({ error: 'session not found' });
    });

    it('returns session and messages', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq(undefined, { key: 'session-1' });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/sessions/:key');
      handler.route.stack[0].handle(req, res);

      expect(res._json).toEqual({
        session: expect.objectContaining({ key: 'session-1' }),
        messages: expect.arrayContaining([
          expect.objectContaining({ id: 'msg-1' }),
          expect.objectContaining({ id: 'msg-2' }),
        ]),
      });
    });
  });

  describe('DELETE /api/sessions/:key', () => {
    it('archives session and returns ok', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq(undefined, { key: 'session-1' });
      const handlers = app._router.stack.filter((r: any) => r.route?.path === '/api/sessions/:key');
      const deleteHandler = handlers.find((h: any) => h.route.methods.delete);
      deleteHandler.route.stack[0].handle(req, res);

      expect(res._json).toEqual({ ok: true });
    });

    it('calls archiveSession when deleting a session', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq(undefined, { key: 'session-1' });
      const handlers = app._router.stack.filter((r: any) => r.route?.path === '/api/sessions/:key');
      const deleteHandler = handlers.find((h: any) => h.route.methods.delete);
      deleteHandler.route.stack[0].handle(req, res);

      expect(mockSessions.archiveSession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('GET /api/audit/:key', () => {
    it('returns 404 when session not found', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq(undefined, { key: 'nonexistent' });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/audit/:key');
      handler.route.stack[0].handle(req, res);

      expect(res._status).toBe(404);
      expect(res._json).toEqual({ error: 'session not found' });
    });

    it('returns session, messages, and checkpoint', () => {
      const app = createHttpServer({
        config: mockConfig,
        runner: mockRunner,
        sessions: mockSessions,
      });
      const res = mkRes();
      const req = mkReq(undefined, { key: 'session-1' });
      const handler = app._router.stack.find((r: any) => r.route?.path === '/api/audit/:key');
      handler.route.stack[0].handle(req, res);

      expect(res._json).toEqual({
        session: expect.objectContaining({ key: 'session-1' }),
        messageCount: 2,
        messages: expect.arrayContaining([
          expect.objectContaining({ id: 'msg-1' }),
          expect.objectContaining({ id: 'msg-2' }),
        ]),
        latestCheckpoint: expect.objectContaining({ id: 'cp-1' }),
      });
    });
  });
});
