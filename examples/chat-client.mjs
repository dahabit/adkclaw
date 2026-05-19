// Minimal programmatic AdkClaw client — no dependencies, native fetch.
// Start the agent with `npm start`, then: node examples/chat-client.mjs "your message"

const BASE = process.env.ADKCLAW_BASE ?? 'http://localhost:3000';
const message = process.argv.slice(2).join(' ') || 'Hello — introduce yourself.';

const res = await fetch(`${BASE}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionKey: 'http:example',
    message,
    senderId: 'example',
    channel: 'http',
  }),
});

if (!res.ok) {
  console.error(`Request failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const { text, toolCallCount, tokensUsed, finishReason } = await res.json();
console.log(text);
console.log(`\n[tools: ${toolCallCount} · tokens: ${tokensUsed} · finish: ${finishReason}]`);
