import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve, join, relative } from 'node:path';
import { stringify as yamlStringify } from 'yaml';

const TONE_PRESETS: Record<string, string> = {
  direct: 'Direct, concise, opinionated. Says "I don\'t know" rather than guess. Takes initiative.',
  friendly:
    'Warm and approachable, but still direct. Uses humor sparingly. Honest about uncertainty.',
  formal: 'Professional and measured. Plain language, no slang. Always polite.',
  playful: "Witty and a little irreverent — never at the user's expense. Loves a clever turn.",
};

async function prompt(
  rl: readline.Interface,
  question: string,
  fallback?: string,
): Promise<string> {
  const hint = fallback ? ` [${fallback}]` : '';
  const answer = (await rl.question(`${question}${hint}: `)).trim();
  return answer || fallback || '';
}

/**
 * Recursively copy a directory tree, substituting placeholder strings in file contents.
 * Skips .gitkeep files. Exported for testing.
 */
export async function copyDirectoryWithSubstitutions(
  src: string,
  dst: string,
  substitutions: Record<string, string>,
): Promise<void> {
  const s = await stat(src);
  if (s.isDirectory()) {
    await mkdir(dst, { recursive: true });
    const entries = await readdir(src);
    for (const entry of entries) {
      if (entry === '.gitkeep') continue;
      await copyDirectoryWithSubstitutions(join(src, entry), join(dst, entry), substitutions);
    }
    return;
  }
  let content = await readFile(src, 'utf8');
  for (const [k, v] of Object.entries(substitutions)) {
    content = content.split(k).join(v);
  }
  await writeFile(dst, content);
}

export interface SetupResult {
  envPath: string;
  agentYamlPath: string;
  workspacePath: string;
  agentName: string;
}

export async function runSetup(): Promise<SetupResult> {
  const projectRoot = resolve(process.cwd());
  const workspaceExample = resolve(projectRoot, 'workspace.example');
  const workspaceDir = resolve(projectRoot, 'workspace');
  const envPath = resolve(projectRoot, '.env');
  const agentYamlPath = resolve(projectRoot, 'agent.yaml');

  const rl = readline.createInterface({ input, output });

  console.log('🤖 AdkClaw setup wizard');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (existsSync(envPath)) {
    const ow = await prompt(rl, '`.env` already exists. Overwrite? (yes/no)', 'no');
    if (!/^y/i.test(ow)) {
      console.log('Aborted. No files changed.');
      rl.close();
      return { envPath, agentYamlPath, workspacePath: workspaceDir, agentName: '' };
    }
  }

  console.log('\n--- Agent identity ---');
  const agentName = await prompt(rl, "What is your agent's name?", 'AdkClaw');
  const userName = await prompt(
    rl,
    'What is YOUR name? (the agent will refer to you this way)',
    'friend',
  );
  console.log('\nTone presets:');
  for (const [k, v] of Object.entries(TONE_PRESETS)) {
    console.log(`  ${k.padEnd(10)} — ${v}`);
  }
  const agentTone = (
    await prompt(rl, 'Pick a tone (or type a custom one)', 'direct')
  ).toLowerCase();
  const agentToneDescription = TONE_PRESETS[agentTone] ?? agentTone;

  console.log('\n--- Required keys ---');
  console.log('  Gemini API key:  https://aistudio.google.com/apikey');
  const geminiApiKey = await prompt(rl, 'GEMINI_API_KEY');

  console.log('  Telegram bot:    https://t.me/BotFather  (use /newbot)');
  const telegramBotToken = await prompt(rl, 'TELEGRAM_BOT_TOKEN');

  console.log('  Telegram user ID: send /start to your bot — it will reply with your numeric ID.');
  console.log('  (Must be a number like 5025183377, NOT a username like @dahabdev)');
  const allowedSenders = await prompt(rl, 'ALLOWED_SENDERS (numeric ID)', '');

  console.log('\n--- Optional ---');
  const googleCloudProject = await prompt(rl, 'GOOGLE_CLOUD_PROJECT (skip for v1)', '');

  rl.close();

  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const envContent =
    [
      `GEMINI_API_KEY=${geminiApiKey}`,
      `TELEGRAM_BOT_TOKEN=${telegramBotToken}`,
      `ALLOWED_SENDERS=${allowedSenders}`,
      '',
      'PORT=3000',
      'HOST=localhost',
      '',
      'WORKSPACE_PATH=./workspace',
      'DATABASE_PATH=./data/adkclaw.db',
      '',
      'DEFAULT_MODEL=gemini-3.1-pro-preview',
      'FALLBACK_MODEL=gemini-3-flash-preview',
      'MAX_TOOL_ROUNDS=15',
      'COMPACTION_THRESHOLD=0.8',
      'HEARTBEAT_INTERVAL_MS=1800000',
      `TIMEZONE=${detectedTz}`,
      'DAILY_TOKEN_BUDGET=500000',
      '',
      `GOOGLE_CLOUD_PROJECT=${googleCloudProject}`,
      'GOOGLE_CLOUD_REGION=us-central1',
    ].join('\n') + '\n';
  await writeFile(envPath, envContent);
  console.log(`\n✓ Wrote ${relative(projectRoot, envPath)}`);

  const traits = agentToneDescription
    .split(/\.\s+/)
    .map((t) => t.replace(/\.$/, '').trim())
    .filter(Boolean);
  const agentYaml = yamlStringify({ name: agentName, tone: agentTone, traits });
  await writeFile(agentYamlPath, agentYaml);
  console.log(`✓ Wrote ${relative(projectRoot, agentYamlPath)}`);

  await copyDirectoryWithSubstitutions(workspaceExample, workspaceDir, {
    '{{AGENT_NAME}}': agentName,
    '{{USER_NAME}}': userName,
    '{{AGENT_TONE}}': agentToneDescription,
  });
  console.log(`✓ Populated ${relative(projectRoot, workspaceDir)}/`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✨ Setup complete. Your agent is named ${agentName}.\n`);
  console.log('Next:');
  console.log('  npm run dev     # start the daemon (Telegram + HTTP)');
  console.log('  npm run chat    # open the terminal REPL (in another window)');
  console.log('  Or message your bot on Telegram from one of the allowed senders.\n');

  return { envPath, agentYamlPath, workspacePath: workspaceDir, agentName };
}

const isDirectExecution = (() => {
  const url = process.argv[1];
  return Boolean(url && import.meta.url.endsWith(url.replace(/^file:\/\//, '')));
})();

if (isDirectExecution) {
  runSetup().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
