/**
 * `adkclaw rotate` — guided secret rotation runbook.
 *
 * Walks the operator through rotating each sensitive secret:
 *   - Gemini API key
 *   - Telegram bot token
 *   - Telegram webhook secret
 *   - Admin key
 *
 * Every step is just a printed gcloud command; the operator copy-pastes.
 * No automatic execution — security operations should be deliberate, not
 * one-keypress.
 */

const GREEN = '\x1b[0;32m';
const NC = '\x1b[0m';

const RUNBOOKS: Record<string, { title: string; steps: string[] }> = {
  gemini: {
    title: 'Gemini API key',
    steps: [
      'Generate a new key at https://aistudio.google.com/apikey',
      'echo -n "NEWKEY" | gcloud secrets versions add gemini-api-key --data-file=-',
      'gcloud run services update $SERVICE --region=$REGION --update-secrets=GEMINI_API_KEY=gemini-api-key:latest',
      'Send a test message via Telegram. Verify in Cloud Logs that no 401 errors land.',
      'Revoke the OLD key in https://aistudio.google.com/apikey',
    ],
  },
  telegram: {
    title: 'Telegram bot token',
    steps: [
      'Send /revoke to @BotFather on Telegram. Save the new token.',
      'echo -n "NEWTOKEN" | gcloud secrets versions add telegram-bot-token --data-file=-',
      'gcloud run services update $SERVICE --region=$REGION --update-secrets=TELEGRAM_BOT_TOKEN=telegram-bot-token:latest',
      'Re-register the webhook (replace $NEWTOKEN and $WEBHOOK_SECRET):',
      '  curl "https://api.telegram.org/bot$NEWTOKEN/setWebhook?url=$SERVICE_URL/webhook&secret_token=$WEBHOOK_SECRET"',
      'Send a test message. The bot should reply via the new token.',
    ],
  },
  webhook: {
    title: 'Telegram webhook secret',
    steps: [
      'WEBHOOK_SECRET=$(openssl rand -hex 32)',
      'echo -n "$WEBHOOK_SECRET" | gcloud secrets versions add telegram-webhook-secret --data-file=-',
      'gcloud run services update $SERVICE --region=$REGION --update-secrets=TELEGRAM_WEBHOOK_SECRET=telegram-webhook-secret:latest',
      'Re-register webhook with new secret (see `rotate telegram` step 4).',
      'unset WEBHOOK_SECRET',
    ],
  },
  admin: {
    title: 'Admin key',
    steps: [
      'NEW=$(openssl rand -hex 32)',
      'echo -n "$NEW" | gcloud secrets versions add admin-key --data-file=-',
      'gcloud run services update $SERVICE --region=$REGION --update-secrets=ADMIN_KEY=admin-key:latest',
      'Verify: curl -H "x-admin-key: $NEW" $SERVICE_URL/   # should 200',
      'Verify: curl $SERVICE_URL/                          # should 401',
      'unset NEW',
    ],
  },
};

export function rotate(which?: string): number {
  const target = (which ?? '').toLowerCase();
  if (!target || !RUNBOOKS[target]) {
    console.log('\nadkclaw rotate <secret>\n');
    console.log('Available secrets to rotate:');
    for (const [k, v] of Object.entries(RUNBOOKS)) {
      console.log(`  ${k.padEnd(10)} ${v.title}`);
    }
    console.log('\nExample: adkclaw rotate gemini\n');
    return target ? 1 : 0;
  }

  const book = RUNBOOKS[target];
  console.log(`\n🔄 Rotation runbook — ${book.title}\n`);
  book.steps.forEach((step, i) => {
    console.log(`${GREEN}${i + 1}.${NC} ${step}`);
  });
  console.log(
    `\nNo command auto-runs. Copy each line, run it, verify, proceed.\nDocument completion in RUNBOOK.md (commit it).\n`,
  );
  return 0;
}
