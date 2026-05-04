import { Telegraf, type Context } from 'telegraf';
import type { AgentRunner } from '../agent/runner.js';
import type { Config } from '../types/index.js';

export interface TelegramAdapterOptions {
  config: Config;
  runner: AgentRunner;
}

const TELEGRAM_MAX_CHARS = 4000;

function chunkText(s: string, max: number): string[] {
  if (s.length <= max) return [s];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += max) {
    out.push(s.slice(i, i + max));
  }
  return out;
}

export class TelegramAdapter {
  private readonly bot: Telegraf;
  private readonly runner: AgentRunner;
  private readonly config: Config;
  private launchPromise: Promise<void> | null = null;

  constructor(opts: TelegramAdapterOptions) {
    this.config = opts.config;
    this.runner = opts.runner;
    this.bot = new Telegraf(this.config.telegram.botToken);

    // /start — tells the user their numeric Telegram ID so they can add it to ALLOWED_SENDERS
    this.bot.start((ctx) => {
      const id = ctx.from?.id;
      const username = ctx.from?.username ? `@${ctx.from.username}` : '';
      ctx
        .reply(
          [
            `👋 Hi${username ? ` ${username}` : ''}! Your numeric Telegram ID is:`,
            ``,
            `<code>${id}</code>`,
            ``,
            `Add it to ALLOWED_SENDERS in .env, then restart the daemon.`,
            `Example: ALLOWED_SENDERS=${id}`,
          ].join('\n'),
          { parse_mode: 'HTML' },
        )
        .catch(() => null);
    });

    this.bot.on('message', async (ctx) => {
      try {
        await this.handleMessage(ctx);
      } catch (e) {
        console.error('Telegram handler error:', e);
      }
    });
  }

  private isAllowed(senderId: string): boolean {
    if (this.config.telegram.allowedSenders.length === 0) return false;
    return this.config.telegram.allowedSenders.includes(senderId);
  }

  private async handleMessage(ctx: Context): Promise<void> {
    const senderId = String(ctx.from?.id ?? '');
    if (!senderId) return;

    if (!this.isAllowed(senderId)) {
      console.warn(
        `[telegram] Rejected message from sender ${senderId}` +
          ` (username: @${ctx.from?.username ?? 'unknown'}).` +
          ` ALLOWED_SENDERS = [${this.config.telegram.allowedSenders.join(', ')}].` +
          ` Add ${senderId} to ALLOWED_SENDERS in .env to allow this user.`,
      );
      return;
    }

    const message = ctx.message;
    if (!message || !('text' in message)) return;
    const text = message.text;
    if (!text) return;

    const chatId = String(ctx.chat?.id ?? senderId);
    const sessionKey = `telegram:${senderId}`;

    try {
      await ctx.sendChatAction('typing');
    } catch {
      // ignore — typing is best-effort
    }

    const response = await this.runner.run({
      sessionKey,
      channel: 'telegram',
      target: chatId,
      senderId,
      message: text,
    });

    const replyText = response.error ? `⚠️ ${response.error}` : response.text || '(no response)';

    for (const chunk of chunkText(replyText, TELEGRAM_MAX_CHARS)) {
      try {
        await ctx.reply(chunk);
      } catch (e) {
        console.error('Telegram reply error:', e);
        break;
      }
    }
  }

  async launch(): Promise<void> {
    if (this.launchPromise) return this.launchPromise;
    this.launchPromise = new Promise<void>((resolveStarted, rejectStarted) => {
      this.bot.launch({ dropPendingUpdates: true }).catch((err) => {
        console.error('Telegram bot crashed:', err);
        rejectStarted(err);
      });
      setTimeout(() => resolveStarted(), 100);
    });
    return this.launchPromise;
  }

  async deliver(chatId: string, text: string): Promise<void> {
    if (!chatId || !text) return;
    const id = Number(chatId);
    if (!Number.isFinite(id)) {
      throw new Error(`Invalid Telegram chat id: ${chatId}`);
    }
    for (const chunk of chunkText(text, TELEGRAM_MAX_CHARS)) {
      await this.bot.telegram.sendMessage(id, chunk);
    }
  }

  stop(reason = 'shutdown'): void {
    try {
      this.bot.stop(reason);
    } catch (e) {
      console.error('Telegram bot stop error:', e);
    }
  }
}
