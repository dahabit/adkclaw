import type { AgentTool } from '../types/index.js';
import type { CronEngine } from '../cron/engine.js';
import type { DeliveryFn } from '../cron/types.js';

export function makeCronAddTool(engine: CronEngine): AgentTool {
  return {
    name: 'cron_add',
    description:
      'Schedule a recurring task. The cron expression follows standard 5-field syntax (minute hour dom month dow). When the schedule fires, the agent runs the task and delivers the result back to the user.',
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'Cron job definition',
      properties: {
        name: { type: 'string', description: 'Human-friendly name (e.g. "Daily Flutter watch")' },
        schedule: {
          type: 'string',
          description: 'Cron expression — e.g. "0 9 * * *" for 9am daily',
        },
        task: { type: 'string', description: 'What the agent should do when the cron fires' },
      },
      required: ['name', 'schedule', 'task'],
    },
    async execute(args, ctx) {
      const name = String(args.name ?? '');
      const schedule = String(args.schedule ?? '');
      const task = String(args.task ?? '');
      if (!name || !schedule || !task) {
        return { error: 'name, schedule, and task are required' };
      }
      try {
        const job = engine.add({
          name,
          schedule,
          task,
          sessionKey: ctx.session.key,
          ...(ctx.session.channel ? { channel: ctx.session.channel } : {}),
          ...(ctx.session.target ? { target: ctx.session.target } : {}),
        });
        return { success: true, result: `Scheduled job ${job.id}: ${job.name} (${job.schedule})` };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

export function makeCronRemoveTool(engine: CronEngine): AgentTool {
  return {
    name: 'cron_remove',
    description: 'Delete a scheduled job by id.',
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'Job removal',
      properties: {
        id: { type: 'string', description: 'Job id to remove' },
      },
      required: ['id'],
    },
    async execute(args) {
      const id = String(args.id ?? '');
      if (!id) return { error: 'id is required' };
      try {
        engine.remove(id);
        return { success: true, result: `Removed ${id}` };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

export function makeCronListTool(engine: CronEngine): AgentTool {
  return {
    name: 'cron_list',
    description: 'List all scheduled jobs (id, name, schedule, enabled, last run).',
    permission: 'allow',
    parameters: { type: 'object', description: 'No arguments', properties: {}, required: [] },
    async execute() {
      const jobs = engine.list();
      if (jobs.length === 0) return { success: true, result: '(no scheduled jobs)' };
      const formatted = jobs
        .map(
          (j) =>
            `- ${j.id} · ${j.enabled ? '✓' : '✗'} · ${j.schedule} · ${j.name ?? '(unnamed)'}\n    task: ${j.task.slice(0, 80)}\n    last_run: ${j.lastRunAt ? new Date(j.lastRunAt).toISOString() : 'never'}`,
        )
        .join('\n');
      return { success: true, result: formatted };
    },
  };
}

export function makeMessageUserTool(delivery: DeliveryFn | null): AgentTool {
  return {
    name: 'message_user',
    description:
      'Proactively send a message to the user via their channel. Use sparingly — only for important updates the user has asked you to surface (cron results, important findings).',
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'Outbound message',
      properties: {
        text: { type: 'string', description: 'What to say' },
      },
      required: ['text'],
    },
    async execute(args, ctx) {
      const text = String(args.text ?? '');
      if (!text) return { error: 'text is required' };
      if (!delivery) return { error: 'no delivery channel configured for this agent' };
      const channel = ctx.session.channel;
      const target = ctx.session.target;
      if (!channel || !target) {
        return { error: 'session has no channel/target — cannot deliver proactively' };
      }
      try {
        await delivery(channel, target, text);
        return { success: true, result: `Delivered ${text.length} chars to ${channel}:${target}` };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
