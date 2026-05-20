import type { AgentTool } from '../types/index.js';
import { SkillsLoader } from '../skills/loader.js';

export function makeLoadSkillTool(): AgentTool {
  return {
    name: 'load_skill',
    description:
      'Load the full content of a markdown skill from the agent workspace. Skills teach you how to do specific tasks (their description appears in your system prompt). Call this BEFORE attempting a task that matches an available skill, to read the step-by-step instructions.',
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'Skill load request',
      properties: {
        name: { type: 'string', description: 'Skill name (without .md extension)' },
      },
      required: ['name'],
    },
    async execute(args, ctx) {
      const name = String(args.name ?? '').trim();
      if (!name) return { error: 'name is required' };
      const loader = new SkillsLoader({ workspacePath: ctx.workspacePath });
      const skill = await loader.load(name);
      if (!skill) return { error: `Skill not found: ${name}` };
      const header =
        `# Skill: ${skill.name}\n` +
        (skill.description ? `**Description:** ${skill.description}\n` : '') +
        (skill.whenToInvoke ? `**When to invoke:** ${skill.whenToInvoke}\n` : '');
      return {
        success: true,
        result: `${header}\n${skill.body}`,
      };
    },
  };
}

export function makeListSkillsTool(): AgentTool {
  return {
    name: 'list_skills',
    description:
      'List all skills currently available in the workspace, with their descriptions. Useful when you need to discover what capabilities you have for a given task.',
    permission: 'allow',
    parameters: {
      type: 'object',
      description: 'No arguments',
      properties: {},
      required: [],
    },
    async execute(_args, ctx) {
      const loader = new SkillsLoader({ workspacePath: ctx.workspacePath });
      const skills = await loader.list();
      if (skills.length === 0) return { success: true, result: '(no skills installed)' };
      const formatted = skills
        .map(
          (s) =>
            `- **${s.name}** — ${s.description}${s.whenToInvoke ? ` (invoke when: ${s.whenToInvoke})` : ''}`,
        )
        .join('\n');
      return { success: true, result: formatted };
    },
  };
}
