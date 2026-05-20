// src/channels/telegram.ts
import { Telegraf, type Context } from 'telegraf';
import type { AgentRunner } from '../agent/runner.js';
import type { ContextEngine } from '../context/manager.js';
import type { Compactor } from '../context/compaction.js';
import type { SessionStore } from '../sessions/store.js';
import type { Config } from '../types/index.js';

const MAX_MESSAGE_LENGTH = 4000;

export class TelegramAdapter {
  private readonly bot: Telegraf;

  constructor(
    private readonly config: Config,
    private readonly runner: AgentRunner,
    private readonly contextEngine: ContextEngine,
    private readonly sessions: SessionStore,
    private readonly compactor: Compactor,
  ) {
    this.bot = new Telegraf(config.telegram.botToken);

    // The /start command — students send this to discover their numeric ID.
    this.bot.start(async (ctx) => {
      const id = ctx.from?.id;
      await ctx.reply(
        `Welcome! Your Telegram numeric ID is ${id}.\n\n` +
          `Add it to ALLOWED_SENDERS in your .env, restart, and I will talk back.`,
      );
    });

    this.bot.on('message', (ctx) => this.handleMessage(ctx));
  }

  private async handleMessage(ctx: Context): Promise<void> {
    const senderId = ctx.from?.id;
    if (!senderId) return;
    const senderIdStr = String(senderId);

    // ALLOWED_SENDERS holds numeric IDs only — silently reject everyone else.
    if (!this.config.telegram.allowedSenders.includes(senderIdStr)) {
      console.log(`[telegram] rejected sender ${senderIdStr}`);
      return;
    }

    const message = ctx.message;
    const text = message && 'text' in message ? message.text : '';
    if (!text) return;

    const session = this.sessions.ensureSession(
      `telegram:${senderIdStr}`,
      'telegram',
      senderIdStr,
      this.config.gemini.defaultModel,
    );

    // Compact old turns before reading history, so the run stays under budget.
    await this.compactor.maybeCompact(session.key);
    const history = this.sessions.history(session.key);

    const result = await this.runner.run({
      session,
      systemPrompt: this.contextEngine.bootstrap().systemPrompt,
      history,
      userText: text,
    });

    this.sessions.appendAll(session.key, result.newHistory.slice(history.length));

    // Telegram caps messages at ~4000 chars — chunk if needed.
    let reply = result.reply || '(no reply)';
    while (reply.length > 0) {
      await ctx.reply(reply.slice(0, MAX_MESSAGE_LENGTH));
      reply = reply.slice(MAX_MESSAGE_LENGTH);
    }
  }

  // Long-poll mode (local dev). In webhook mode (Cloud Run) this is a no-op —
  // mount webhookCallback() on the HTTP server instead.
  async launch(): Promise<void> {
    if (process.env['TELEGRAM_MODE'] === 'webhook') {
      console.log('[telegram] webhook mode — mount webhookCallback() on the HTTP server');
      return;
    }
    // bot.launch() resolves only when the bot stops — start it in the
    // background so the daemon keeps booting.
    void this.bot.launch();
    console.log('[telegram] bot online (long-poll)');
  }

  // Express middleware for webhook mode. telegraf validates the
  // X-Telegram-Bot-Api-Secret-Token header against the secret given here.
  webhookCallback(path: string) {
    const secret = process.env['TELEGRAM_WEBHOOK_SECRET'];
    return this.bot.webhookCallback(path, secret ? { secretToken: secret } : undefined);
  }

  // Push a message to a chat unprompted — used by cron jobs and the heartbeat.
  async deliver(chatId: string, text: string): Promise<void> {
    if (!chatId || !text) return;
    const id = Number(chatId);
    if (!Number.isFinite(id)) {
      throw new Error(`Invalid Telegram chat id: ${chatId}`);
    }
    for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
      await this.bot.telegram.sendMessage(id, text.slice(i, i + MAX_MESSAGE_LENGTH));
    }
  }
}
