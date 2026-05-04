/**
 * src/server/http.ts — HTTP Gateway + Admin Dashboard.
 *
 * Built in Codelab 1 (chat + sessions endpoints), extended in Codelab 3 (admin
 * dashboard + audit), extended in Codelab 4 (Telegram webhook + cron firing
 * endpoint for Cloud Scheduler).
 *
 * One agent runtime, three interfaces:
 *
 *   - Telegram      → polls/webhooks the bot, normalizes, calls runner.run()
 *   - Terminal CLI  → POSTs to /api/chat (REPL is a thin client over HTTP)
 *   - HTTP API      → any external client can integrate
 *
 * All three eventually call the SAME AgentRunner.run() with the same session-key
 * pattern. Memory, history, and tools are channel-agnostic.
 *
 * Endpoints (10):
 *
 *   GET  /                       Admin dashboard (HTML, auto-refreshes every 8s)
 *   GET  /api/health             Liveness check (returns {ok:true})
 *   GET  /api/status             Sessions, tokens, uptime, channels (JSON)
 *   POST /api/chat               Send a message {sessionKey, message} → response
 *   GET  /api/sessions           List all sessions
 *   GET  /api/sessions/:key      Session + messages
 *   DELETE /api/sessions/:key    Archive a session
 *   GET  /api/audit/:key         Full audit dump: session + messages + checkpoints
 *
 *   (added in Codelab 4)
 *   POST /api/telegram           Telegram webhook (cloud-mode only)
 *   POST /api/cron/fire          Cloud Scheduler trigger (with OIDC verification)
 *
 * Security:
 *
 *   - The dashboard at GET / is intended for localhost / authenticated cloud
 *     deployments. Production should put it behind IAP or basic auth.
 *   - The /api/chat endpoint enforces no auth at this layer (channels enforce
 *     senderId via their adapter). Cloud deployments add Cloud Run ingress auth.
 *
 * Dashboard rendering note:
 *
 *   All dynamic values are set via textContent or createElement in the inline
 *   JS — never innerHTML with external data. Channel names come from our session
 *   store (enum-like), not user input — but we still avoid innerHTML to be safe.
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import type { AgentRunner } from '../agent/runner.js';
import type { Config } from '../types/index.js';
import type { SessionStore } from '../sessions/store.js';

export interface HttpServerOptions {
  config: Config;
  runner: AgentRunner;
  sessions: SessionStore;
}

const startTime = Date.now();

// Admin dashboard served at GET /
// All dynamic values are set via textContent or createElement — never innerHTML with external data.
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>AdkClaw — Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;padding:24px}
h1{font-size:1.5rem;font-weight:700;display:flex;align-items:center;gap:10px}
.dot{width:10px;height:10px;border-radius:50%;background:#3fb950;display:inline-block;box-shadow:0 0 8px #3fb950}
.agent-name{color:#58a6ff}
.subtitle{color:#8b949e;font-size:.85rem;margin-top:4px;margin-bottom:28px}
.model-tag{background:#21262d;border-radius:4px;padding:2px 6px;font-size:.75rem;color:#8b949e;font-family:monospace}
.header-row{display:flex;justify-content:space-between;align-items:flex-start}
.refresh-note{color:#8b949e;font-size:.75rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:18px 20px}
.card .label{color:#8b949e;font-size:.75rem;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
.card .value{font-size:1.8rem;font-weight:700}
.green{color:#3fb950} .blue{color:#58a6ff} .yellow{color:#d29922}
.tokens-bar{height:6px;background:#21262d;border-radius:3px;margin-top:6px;overflow:hidden}
.tokens-fill{height:100%;background:linear-gradient(90deg,#3fb950,#58a6ff);border-radius:3px;transition:width .5s}
.section{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:18px 20px;margin-bottom:16px}
.section h2{font-size:.9rem;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px}
.pills{display:flex;gap:8px;flex-wrap:wrap}
.pill{background:#21262d;border-radius:99px;padding:4px 12px;font-size:.8rem;color:#8b949e;display:flex;align-items:center;gap:6px}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:.75rem;font-weight:500}
.badge-tg{background:#1a3a5c;color:#58a6ff}
.badge-cli{background:#1a3a2a;color:#3fb950}
.badge-http{background:#3a2a1a;color:#d29922}
.badge-other{background:#2a1a3a;color:#bc8cff}
table{width:100%;border-collapse:collapse;font-size:.875rem}
th{text-align:left;color:#8b949e;font-weight:500;padding:6px 10px;border-bottom:1px solid #30363d}
td{padding:8px 10px;border-bottom:1px solid #21262d;vertical-align:middle}
tr:last-child td{border-bottom:none}
.key-code{font-size:.8rem;color:#8b949e;font-family:monospace}
.empty{color:#8b949e;font-size:.85rem;font-style:italic}
</style>
</head>
<body>
<div class="header-row">
  <div>
    <h1><span class="dot" id="dot"></span>&nbsp;AdkClaw —&nbsp;<span class="agent-name" id="agentName">…</span></h1>
    <p class="subtitle">Admin dashboard&nbsp;·&nbsp;<span id="model" class="model-tag">…</span>&nbsp;·&nbsp;<span id="uptime"></span></p>
  </div>
  <div class="refresh-note" id="refreshNote">Loading…</div>
</div>

<div class="grid">
  <div class="card"><div class="label">Active Sessions</div><div class="value green" id="activeSessions">—</div></div>
  <div class="card"><div class="label">Total Sessions</div><div class="value blue" id="totalSessions">—</div></div>
  <div class="card">
    <div class="label">Tokens (all time)</div>
    <div class="value yellow" id="totalTokens">—</div>
    <div class="tokens-bar"><div class="tokens-fill" id="tokensBar" style="width:0%"></div></div>
  </div>
  <div class="card"><div class="label">Uptime</div><div class="value" id="uptimeNum">—</div></div>
</div>

<div class="section">
  <h2>Sessions by Channel</h2>
  <div class="pills" id="channelPills"></div>
</div>

<div class="section">
  <h2>Active Sessions</h2>
  <table>
    <thead><tr><th>Session Key</th><th>Channel</th><th>Tokens</th><th>Last Active</th></tr></thead>
    <tbody id="sessionTable"></tbody>
  </table>
</div>

<script>
'use strict';
function fmt(n){if(n>=1e6)return(n/1e6).toFixed(2)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return String(n)}
function fmtTime(iso){if(!iso)return'—';const diff=Math.round((Date.now()-new Date(iso).getTime())/1000);if(diff<60)return diff+'s ago';if(diff<3600)return Math.round(diff/60)+'m ago';return Math.round(diff/3600)+'h ago'}
function fmtUptime(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h?h+'h '+m+'m':m?m+'m '+sec+'s':sec+'s'}

function makeBadge(ch){
  const map={telegram:'badge-tg',cli:'badge-cli',http:'badge-http'};
  const el=document.createElement('span');
  el.className='badge '+(map[ch]||'badge-other');
  el.textContent=ch||'?';
  return el;
}

function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}

async function refresh(){
  try{
    const d=await fetch('/api/status').then(r=>r.json());

    setText('agentName',d.agentName||'AdkClaw');
    setText('model',d.defaultModel||'?');
    setText('activeSessions',String(d.activeSessionCount??0));
    setText('totalSessions',String(d.totalSessionCount??0));
    setText('totalTokens',fmt(d.totalTokensAllTime??0));
    setText('uptimeNum',fmtUptime(d.uptimeSec??0));
    setText('uptime','up '+fmtUptime(d.uptimeSec??0));
    document.getElementById('tokensBar').style.width=Math.min(100,((d.totalTokensAllTime??0)/5e6)*100)+'%';

    const pillsEl=document.getElementById('channelPills');
    while(pillsEl.firstChild)pillsEl.removeChild(pillsEl.firstChild);
    const by=d.sessionsByChannel||{};
    const chKeys=Object.keys(by);
    if(chKeys.length===0){
      const e=document.createElement('span');e.className='empty';e.textContent='No active sessions';pillsEl.appendChild(e);
    } else {
      chKeys.forEach(k=>{
        const pill=document.createElement('div');pill.className='pill';
        pill.appendChild(makeBadge(k));
        const cnt=document.createElement('strong');cnt.textContent=String(by[k]);
        pill.appendChild(cnt);
        pillsEl.appendChild(pill);
      });
    }

    const tbody=document.getElementById('sessionTable');
    while(tbody.firstChild)tbody.removeChild(tbody.firstChild);
    const sess=d.sessions||[];
    if(sess.length===0){
      const tr=document.createElement('tr');
      const td=document.createElement('td');td.colSpan=4;td.className='empty';td.textContent='No active sessions';
      tr.appendChild(td);tbody.appendChild(tr);
    } else {
      sess.forEach(s=>{
        const tr=document.createElement('tr');
        const tdKey=document.createElement('td');
        const code=document.createElement('code');code.className='key-code';code.textContent=s.key;
        tdKey.appendChild(code);
        const tdCh=document.createElement('td');tdCh.appendChild(makeBadge(s.channel));
        const tdTok=document.createElement('td');tdTok.textContent=fmt(s.totalTokens||0);
        const tdTime=document.createElement('td');tdTime.textContent=fmtTime(s.lastMessageAt);
        tr.append(tdKey,tdCh,tdTok,tdTime);tbody.appendChild(tr);
      });
    }

    document.getElementById('dot').style.background='#3fb950';
    setText('refreshNote','Refreshed '+new Date().toLocaleTimeString());
  } catch(e) {
    document.getElementById('dot').style.background='#f85149';
    setText('refreshNote','Daemon unreachable — is it running?');
  }
}
refresh();
setInterval(refresh,8000);
</script>
</body>
</html>`;

export function createHttpServer(opts: HttpServerOptions): Express {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(DASHBOARD_HTML);
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/status', (_req: Request, res: Response) => {
    const sessions = opts.sessions.listSessions({ limit: 200 });
    const activeSessions = sessions.filter((s) => !s.isArchived);
    const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
    const byChannel: Record<string, number> = {};
    for (const s of activeSessions) {
      const ch = s.channel ?? 'unknown';
      byChannel[ch] = (byChannel[ch] ?? 0) + 1;
    }
    res.json({
      ok: true,
      uptimeSec: Math.round((Date.now() - startTime) / 1000),
      agentName: opts.config.agent.name,
      defaultModel: opts.config.gemini.defaultModel,
      activeSessionCount: activeSessions.length,
      totalSessionCount: sessions.length,
      totalTokensAllTime: totalTokens,
      sessionsByChannel: byChannel,
      sessions: activeSessions.slice(0, 50).map((s) => ({
        key: s.key,
        channel: s.channel,
        totalTokens: s.totalTokens,
        lastMessageAt: s.lastMessageAt,
      })),
    });
  });

  app.post('/api/chat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        sessionKey?: string;
        message?: string;
        senderId?: string;
        channel?: string;
        target?: string;
      };
      if (!body.sessionKey || !body.message) {
        res.status(400).json({ error: 'sessionKey and message are required' });
        return;
      }
      const result = await opts.runner.run({
        sessionKey: body.sessionKey,
        message: body.message,
        channel: body.channel ?? 'http',
        target: body.target ?? body.sessionKey,
        senderId: body.senderId ?? 'http',
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/sessions', (_req: Request, res: Response) => {
    res.json(opts.sessions.listSessions({ limit: 200 }));
  });

  app.get('/api/sessions/:key', (req: Request, res: Response) => {
    const session = opts.sessions.getSession(req.params.key ?? '');
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    const messages = opts.sessions.listMessages(session.key, { limit: 500 });
    res.json({ session, messages });
  });

  app.delete('/api/sessions/:key', (req: Request, res: Response) => {
    opts.sessions.archiveSession(req.params.key ?? '');
    res.json({ ok: true });
  });

  app.get('/api/audit/:key', (req: Request, res: Response) => {
    const key = req.params.key ?? '';
    const session = opts.sessions.getSession(key);
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    const messages = opts.sessions.listMessages(key, { limit: 5000 });
    const checkpoint = opts.sessions.getLatestCheckpoint(key);
    res.json({
      session,
      messageCount: messages.length,
      messages,
      latestCheckpoint: checkpoint,
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('HTTP error', err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
