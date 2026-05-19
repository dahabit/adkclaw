import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeLoadSkillTool, makeListSkillsTool } from './skills.js';
import type { ToolContext } from '../types/index.js';

let workspace: string;

function ctx(): ToolContext {
  return {
    session: {
      key: 's',
      kind: 'main',
      parentKey: null,
      channel: null,
      target: null,
      senderId: null,
      createdAt: 0,
      updatedAt: 0,
      lastMessageAt: null,
      model: '',
      totalTokens: 0,
      isArchived: false,
    },
    workspacePath: workspace,
    config: {} as never,
  };
}

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'adkclaw-skills-'));
  // Create skills directory
  mkdirSync(join(workspace, 'skills'), { recursive: true });
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function createSkill(name: string, content: string, description?: string) {
  const skillsDir = join(workspace, 'skills');
  mkdirSync(skillsDir, { recursive: true });
  const filename = join(skillsDir, `${name}.md`);
  const frontmatter = description
    ? `---\ndescription: ${description}\nwhen_to_invoke: test condition\n---\n`
    : '';
  writeFileSync(filename, `${frontmatter}${content}`);
}

describe('load_skill tool', () => {
  it('has correct metadata', () => {
    const tool = makeLoadSkillTool();
    expect(tool.name).toBe('load_skill');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('Load');
    expect(tool.parameters.required).toEqual(['name']);
  });

  it('loads a skill by name', async () => {
    createSkill('test-skill', '# Instructions\nDo this and that.', 'How to test');
    const tool = makeLoadSkillTool();
    const result = await tool.execute({ name: 'test-skill' }, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('Skill: test-skill');
    expect(result.result).toContain('How to test');
    expect(result.result).toContain('Do this and that');
  });

  it('includes description in result when present', async () => {
    createSkill('described', 'Body text', 'A cool skill');
    const tool = makeLoadSkillTool();
    const result = await tool.execute({ name: 'described' }, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('**Description:** A cool skill');
  });

  it('includes when_to_invoke when present', async () => {
    createSkill('invokable', 'Body', 'Desc');
    const tool = makeLoadSkillTool();
    const result = await tool.execute({ name: 'invokable' }, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('**When to invoke:** test condition');
  });

  it('returns error when skill not found', async () => {
    const tool = makeLoadSkillTool();
    const result = await tool.execute({ name: 'nonexistent' }, ctx());
    expect(result.error).toContain('not found');
    expect(result.error).toContain('nonexistent');
  });

  it('rejects missing name', async () => {
    const tool = makeLoadSkillTool();
    const result = await tool.execute({ name: '' }, ctx());
    expect(result.error).toContain('required');
  });

  it('trims whitespace from name', async () => {
    createSkill('whitespace-skill', 'Content', 'Test');
    const tool = makeLoadSkillTool();
    const result = await tool.execute({ name: '  whitespace-skill  ' }, ctx());
    expect(result.success).toBe(true);
  });

  it('loads skill with complex body content', async () => {
    const complexBody = `
# Instructions

## Step 1
Do something first.

## Step 2
Then do another thing.

- Bullet point
- Another bullet
`;
    createSkill('complex', complexBody, 'Complex skill');
    const tool = makeLoadSkillTool();
    const result = await tool.execute({ name: 'complex' }, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('Step 1');
    expect(result.result).toContain('Step 2');
    expect(result.result).toContain('Bullet point');
  });

  it('formats header correctly', async () => {
    createSkill('formatted', 'Body', 'Test description');
    const tool = makeLoadSkillTool();
    const result = await tool.execute({ name: 'formatted' }, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toMatch(/# Skill: formatted/);
  });
});

describe('list_skills tool', () => {
  it('has correct metadata', () => {
    const tool = makeListSkillsTool();
    expect(tool.name).toBe('list_skills');
    expect(tool.permission).toBe('allow');
    expect(tool.description).toContain('List');
    expect(tool.parameters.required).toEqual([]);
  });

  it('returns no skills message when empty', async () => {
    const tool = makeListSkillsTool();
    const result = await tool.execute({}, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('no skills installed');
  });

  it('lists a single skill', async () => {
    createSkill('solo-skill', 'Content', 'A solo skill');
    const tool = makeListSkillsTool();
    const result = await tool.execute({}, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('solo-skill');
    expect(result.result).toContain('A solo skill');
  });

  it('lists multiple skills', async () => {
    createSkill('skill1', 'Content1', 'First skill');
    createSkill('skill2', 'Content2', 'Second skill');
    createSkill('skill3', 'Content3', 'Third skill');
    const tool = makeListSkillsTool();
    const result = await tool.execute({}, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('skill1');
    expect(result.result).toContain('skill2');
    expect(result.result).toContain('skill3');
    expect(result.result).toContain('First skill');
    expect(result.result).toContain('Second skill');
    expect(result.result).toContain('Third skill');
  });

  it('includes when_to_invoke in list when present', async () => {
    createSkill('invokable-skill', 'Content', 'Desc');
    const tool = makeListSkillsTool();
    const result = await tool.execute({}, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('invoke when: test condition');
  });

  it('formats skills with markdown bold', async () => {
    createSkill('formatted-skill', 'Content', 'Test description');
    const tool = makeListSkillsTool();
    const result = await tool.execute({}, ctx());
    expect(result.success).toBe(true);
    expect(result.result).toContain('**formatted-skill**');
  });

  it('handles skills without description gracefully', async () => {
    // Create skill without frontmatter description
    const skillsDir = join(workspace, 'skills');
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, 'no-desc.md'), 'Just body content');

    const tool = makeListSkillsTool();
    const result = await tool.execute({}, ctx());
    expect(result.success).toBe(true);
  });

  it('lists skills in consistent order', async () => {
    createSkill('aaa', 'Content', 'A');
    createSkill('zzz', 'Content', 'Z');
    createSkill('mmm', 'Content', 'M');

    const tool = makeListSkillsTool();
    const result = await tool.execute({}, ctx());
    expect(result.success).toBe(true);
    // All should be present
    expect(result.result).toContain('aaa');
    expect(result.result).toContain('zzz');
    expect(result.result).toContain('mmm');
  });
});
