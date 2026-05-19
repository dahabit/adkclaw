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

  //REPLACE-CHANNEL-TELEGRAM
  private async handleMessage(ctx: Context): Promise<void> {
    // Extract the message, check permissions, call the agent, save history, and reply.
    // Fill this in from level_1/codelab.md §6.
    throw new Error('REPLACE-CHANNEL-TELEGRAM not implemented — see level_1/codelab.md §6');
  }

  async launch(): Promise<void> {
    // bot.launch() resolves only when the bot stops — start it in the
    // background so the daemon keeps booting.
    void this.bot.launch();
    console.log('[telegram] bot online');
  }
}
