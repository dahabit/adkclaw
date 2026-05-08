# Extension — Voice tutor (Gemini Live API)

**Difficulty:** Medium · **Time:** 4–5 hours · **What you'll learn:** stream bidirectional voice between a browser and your agent using Gemini Live.

## Why this matters

Typing is fine. Talking is better. Gemini's Live API streams audio in both directions with sub-second latency, so your agent can answer mid-sentence while you're still speaking. By the end of this extension, you have a tiny web page that captures your microphone, talks to your Cloud Run agent, and plays the response back as voice.

## What you'll build

- `src/channels/voice.ts` — Live API streaming adapter (replaces text-in / text-out with audio chunks)
- `extensions/voice-tutor/web/index.html` — minimal browser frontend (mic capture + audio playback via WebSocket)
- A WebSocket route on your Cloud Run agent that proxies between the browser and the Live API

## Prerequisites

- Completed Levels 1–4
- Microphone-enabled device (any laptop)
- Browser with WebSocket + MediaRecorder support (Chrome, Safari, Firefox — all fine)

## Steps

### 1. Wire the Live API

```typescript
// src/channels/voice.ts
import { GoogleGenAI, Modality } from '@google/genai';

const client = new GoogleGenAI();

export async function startSession() {
  return await client.live.connect({
    model: 'gemini-2.5-flash',
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: 'You are a friendly voice tutor. Keep replies under 30 seconds.',
    },
  });
}
```

The `live.connect()` returns a duplex stream. Send audio chunks in, receive audio chunks out.

### 2. Build the WebSocket bridge

In `src/server/index.ts`, add a `ws://` route at `/api/voice/stream`. The bridge:
- Accepts a browser WebSocket connection
- Calls `startSession()` for that user
- Pipes browser → Live API (PCM audio, 16-bit mono 16kHz)
- Pipes Live API → browser (audio chunks back)
- Tears down on disconnect

### 3. Build the browser

`extensions/voice-tutor/web/index.html`:
- Single button: "Hold to talk"
- On press: open `MediaRecorder` on the mic, send chunks to the WebSocket
- On Live API audio response: play through `AudioContext`
- Show captions if the Live API also emits a text transcript (set `responseModalities: [Modality.AUDIO, Modality.TEXT]`)

### 4. Test locally

```bash
npm run dev               # starts the WebSocket route
open extensions/voice-tutor/web/index.html
# Hold the button, speak. Release. Listen.
```

### 5. Deploy

The WebSocket route works on Cloud Run (gen2 supports WebSockets up to 60 minutes per connection). No special config needed beyond your existing Level 4 deploy.

## Success criteria

- [ ] You can hold the button, speak, release, and hear the agent reply within 2 seconds
- [ ] Sessions are isolated per browser (no audio bleeds between users)
- [ ] Disconnect cleanly closes the Live API session (no leaked sessions on the server)
- [ ] Captions show below the audio (optional but recommended)
- [ ] Existing Telegram + CLI channels still work — voice is additive

## Stretch

- Keyword wake-word ("Hey Dudu") instead of hold-to-talk
- Multi-language support — let the user pick a language at the start
- Conversation history persisted across sessions (the agent remembers your voice conversation tomorrow)
- Multi-participant rooms (two users + the agent in one Live session)

## Common pitfalls

| Symptom | Fix |
|---|---|
| Audio plays as static | Sample-rate mismatch — Live API expects 16kHz mono PCM, not the browser's default 48kHz. Resample on the client. |
| WebSocket disconnects every minute | You're idle past Cloud Run's 60-min timeout, OR the Live API session expired. Reconnect on disconnect. |
| Browser blocks mic access | Page must be served over HTTPS or `localhost`. File-URL access won't work. |
| Latency is 5+ seconds | You're buffering audio before sending — flush on every chunk (`MediaRecorder.start(250)` for 250ms intervals). |
