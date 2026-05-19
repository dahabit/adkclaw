import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramAdapter } from './telegram.js';
import type { Config } from '../types/index.js';
import type { AgentRunner } from '../agent/runner.js';

// Capture the handlers the adapter registers on the Telegraf bot so tests can
// drive `bot.start(...)` and `bot.on('message', ...)` directly.
type Handler = (ctx: unknown) => unknown;
let startHandler: Handler | undefined;
let messageHandler: Handler | undefined;

const mockBot = {
  start: vi.fn((h: Handler) => {
    startHandler = h;
  }),
  on: vi.fn((evt: string, h: Handler) => {
    if (evt === 'message') messageHandler = h;
  }),
  launch: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  telegram: {
    sendMessage: vi.fn().mockResolvedValue({ ok: true }),
  },
};

vi.mock('telegraf', () => ({
  Telegraf: vi.fn(() => mockBot),
}));

function makeConfig(overrides?: Partial<Config>): Config {
  return {
    server: { port: 0, host: 'localhost' },
    paths: { workspace: '/tmp', database: ':memory:' },
    gemini: {
      apiKey: 'test',
      defaultModel: 'gemini-3-flash',
      fallbackModel: 'gemini-3-flash',
    },
    telegram: {
      botToken: 'fake-token',
      allowedSenders: ['123456', '789012'],
    },
    agent: {
      name: 'TestAgent',
      tone: 'direct',
      traits: [],
      maxToolRounds: 5,
      compactionThreshold: 0.8,
      heartbeatIntervalMs: 0,
      timezone: 'UTC',
      dailyTokenBudget: 100_000,
    },
    vertex: { project: null, region: 'us-central1' },
    ...overrides,
  } as Config;
}

function makeRunner(result?: { text?: string; error?: string | null }): AgentRunner {
  return {
    run: vi.fn().mockResolvedValue({
      ok: !result?.error,
      text: result?.text ?? 'Test response',
      error: result?.error ?? null,
    }),
  } as unknown as AgentRunner;
}

interface CtxOverrides {
  from?: unknown;
  chat?: unknown;
  message?: unknown;
  reply?: ReturnType<typeof vi.fn>;
  sendChatAction?: ReturnType<typeof vi.fn>;
}

function makeCtx(overrides: CtxOverrides = {}) {
  return {
    from: 'from' in overrides ? overrides.from : { id: 123456, username: 'alice' },
    chat: 'chat' in overrides ? overrides.chat : { id: 999 },
    message: 'message' in overrides ? overrides.message : { text: 'hello agent' },
    reply: overrides.reply ?? vi.fn().mockResolvedValue(undefined),
    sendChatAction: overrides.sendChatAction ?? vi.fn().mockResolvedValue(undefined),
  };
}

describe('TelegramAdapter', () => {
  let runner: AgentRunner;
  let config: Config;

  beforeEach(() => {
    vi.clearAllMocks();
    startHandler = undefined;
    messageHandler = undefined;
    runner = makeRunner();
    config = makeConfig();
  });

  describe('initialization', () => {
    it('registers a /start handler and a message handler', () => {
      new TelegramAdapter({ config, runner });
      expect(mockBot.start).toHaveBeenCalledWith(expect.any(Function));
      expect(mockBot.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(startHandler).toBeTypeOf('function');
      expect(messageHandler).toBeTypeOf('function');
    });
  });

  describe('/start handler', () => {
    it('replies with the sender numeric id in an HTML code block', async () => {
      new TelegramAdapter({ config, runner });
      const reply = vi.fn().mockResolvedValue(undefined);
      await startHandler!({ from: { id: 555111, username: 'bob' }, reply });

      expect(reply).toHaveBeenCalledOnce();
      const [body, opts] = reply.mock.calls[0] as [string, { parse_mode: string }];
      expect(body).toContain('<code>555111</code>');
      expect(body).toContain('@bob');
      expect(body).toContain('ALLOWED_SENDERS=555111');
      expect(opts.parse_mode).toBe('HTML');
    });

    it('swallows a failing reply without throwing', () => {
      new TelegramAdapter({ config, runner });
      const reply = vi.fn().mockRejectedValue(new Error('network'));
      expect(() => startHandler!({ from: { id: 1 }, reply })).not.toThrow();
    });
  });

  describe('message handling — sender allowlist', () => {
    it('runs the agent for an allowed sender and replies with the response', async () => {
      runner = makeRunner({ text: 'Here is your answer' });
      new TelegramAdapter({ config, runner });
      const ctx = makeCtx({ from: { id: 123456, username: 'alice' } });

      await messageHandler!(ctx);

      expect(runner.run).toHaveBeenCalledOnce();
      const runArg = (runner.run as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(runArg.sessionKey).toBe('telegram:123456');
      expect(runArg.channel).toBe('telegram');
      expect(runArg.message).toBe('hello agent');
      expect(ctx.reply).toHaveBeenCalledWith('Here is your answer');
    });

    it('rejects a sender not in ALLOWED_SENDERS and never runs the agent', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      new TelegramAdapter({ config, runner });
      const ctx = makeCtx({ from: { id: 424242, username: 'mallory' } });

      await messageHandler!(ctx);

      expect(runner.run).not.toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('424242'));
      warn.mockRestore();
    });

    it('rejects every sender when ALLOWED_SENDERS is empty', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      config = makeConfig({ telegram: { botToken: 't', allowedSenders: [] } });
      new TelegramAdapter({ config, runner });

      await messageHandler!(makeCtx({ from: { id: 123456 } }));

      expect(runner.run).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('ignores a message with no sender id', async () => {
      new TelegramAdapter({ config, runner });
      await messageHandler!(makeCtx({ from: undefined }));
      expect(runner.run).not.toHaveBeenCalled();
    });
  });

  describe('message handling — content', () => {
    it('ignores a non-text message', async () => {
      new TelegramAdapter({ config, runner });
      await messageHandler!(makeCtx({ message: { photo: [] } }));
      expect(runner.run).not.toHaveBeenCalled();
    });

    it('ignores an empty-text message', async () => {
      new TelegramAdapter({ config, runner });
      await messageHandler!(makeCtx({ message: { text: '' } }));
      expect(runner.run).not.toHaveBeenCalled();
    });

    it('prefixes a runner error with a warning sign', async () => {
      runner = makeRunner({ error: 'budget exceeded' });
      new TelegramAdapter({ config, runner });
      const ctx = makeCtx();

      await messageHandler!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('⚠️ budget exceeded');
    });

    it('replies with a placeholder when the agent returns no text', async () => {
      runner = makeRunner({ text: '' });
      new TelegramAdapter({ config, runner });
      const ctx = makeCtx();

      await messageHandler!(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('(no response)');
    });

    it('splits a long response into 4000-char chunks', async () => {
      runner = makeRunner({ text: 'x'.repeat(9000) });
      new TelegramAdapter({ config, runner });
      const ctx = makeCtx();

      await messageHandler!(ctx);

      expect(ctx.reply.mock.calls.length).toBe(3);
    });

    it('falls back to the sender id when the chat id is missing', async () => {
      new TelegramAdapter({ config, runner });
      await messageHandler!(makeCtx({ chat: undefined }));
      const runArg = (runner.run as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(runArg.target).toBe('123456');
    });

    it('proceeds even when the typing indicator fails', async () => {
      new TelegramAdapter({ config, runner });
      const ctx = makeCtx({ sendChatAction: vi.fn().mockRejectedValue(new Error('flood')) });

      await messageHandler!(ctx);

      expect(runner.run).toHaveBeenCalledOnce();
      expect(ctx.reply).toHaveBeenCalled();
    });

    it('stops sending further chunks once a reply fails', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      runner = makeRunner({ text: 'y'.repeat(9000) });
      new TelegramAdapter({ config, runner });
      const reply = vi.fn().mockRejectedValueOnce(new Error('blocked'));
      const ctx = makeCtx({ reply });

      await messageHandler!(ctx);

      expect(reply).toHaveBeenCalledOnce();
      expect(err).toHaveBeenCalledWith('Telegram reply error:', expect.any(Error));
      err.mockRestore();
    });

    it('catches a handler error inside the message wrapper', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      // ctx.from throws when accessed -> handleMessage rejects -> wrapper catches.
      new TelegramAdapter({ config, runner });
      const ctx = {
        get from() {
          throw new Error('boom');
        },
      };
      await expect(messageHandler!(ctx)).resolves.toBeUndefined();
      expect(err).toHaveBeenCalledWith('Telegram handler error:', expect.any(Error));
      err.mockRestore();
    });
  });

  describe('launch', () => {
    it('launches the bot with dropPendingUpdates', async () => {
      const adapter = new TelegramAdapter({ config, runner });
      await adapter.launch();
      expect(mockBot.launch).toHaveBeenCalledWith({ dropPendingUpdates: true });
    });

    it('launches the underlying bot only once across repeated calls', async () => {
      const adapter = new TelegramAdapter({ config, runner });
      await adapter.launch();
      await adapter.launch();
      expect(mockBot.launch).toHaveBeenCalledTimes(1);
    });

    it('rejects and logs when the bot crashes', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockBot.launch.mockRejectedValueOnce(new Error('Launch failed'));
      const adapter = new TelegramAdapter({ config, runner });

      await expect(adapter.launch()).rejects.toThrow('Launch failed');
      expect(err).toHaveBeenCalledWith('Telegram bot crashed:', expect.any(Error));
      err.mockRestore();
    });
  });

  describe('deliver', () => {
    it('sends a message to a numeric chat id', async () => {
      const adapter = new TelegramAdapter({ config, runner });
      await adapter.deliver('123456', 'Test message');
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(123456, 'Test message');
    });

    it('ignores an empty chat id', async () => {
      const adapter = new TelegramAdapter({ config, runner });
      await adapter.deliver('', 'test');
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('ignores empty text', async () => {
      const adapter = new TelegramAdapter({ config, runner });
      await adapter.deliver('123', '');
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('throws on a non-numeric chat id', async () => {
      const adapter = new TelegramAdapter({ config, runner });
      await expect(adapter.deliver('not-a-number', 'test')).rejects.toThrow(
        'Invalid Telegram chat id',
      );
    });

    it('chunks a long delivered message', async () => {
      const adapter = new TelegramAdapter({ config, runner });
      await adapter.deliver('123456', 'a'.repeat(10000));
      expect(mockBot.telegram.sendMessage.mock.calls.length).toBe(3);
    });
  });

  describe('stop', () => {
    it('stops the bot with the given reason', () => {
      const adapter = new TelegramAdapter({ config, runner });
      adapter.stop('test shutdown');
      expect(mockBot.stop).toHaveBeenCalledWith('test shutdown');
    });

    it('defaults the stop reason to "shutdown"', () => {
      const adapter = new TelegramAdapter({ config, runner });
      adapter.stop();
      expect(mockBot.stop).toHaveBeenCalledWith('shutdown');
    });

    it('catches and logs a stop error', () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockBot.stop.mockImplementationOnce(() => {
        throw new Error('Stop failed');
      });
      const adapter = new TelegramAdapter({ config, runner });
      adapter.stop();
      expect(err).toHaveBeenCalledWith('Telegram bot stop error:', expect.any(Error));
      err.mockRestore();
    });
  });
});
