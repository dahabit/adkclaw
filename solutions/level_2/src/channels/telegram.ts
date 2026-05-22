// src/channels/telegram.ts
import { Telegraf, type Context } from 'telegraf';
import type { AgentRunner } from '../agent/runner.js';
import type { ContextEngine } from '../context/manager.js';
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
    const history = this.sessions.history(session.key);

    const result = await this.runner.run({
      session,
      systemPrompt: this.contextEngine.bootstrap(),
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

  async launch(): Promise<void> {
    // bot.launch() resolves only when the bot stops — start it in the
    // background so the daemon keeps booting.
    void this.bot.launch();
    console.log('[telegram] bot online');
  }
}
