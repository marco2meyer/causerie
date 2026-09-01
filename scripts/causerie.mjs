#!/usr/bin/env node
/* Read the live data from a terminal instead of through a browser.
 *
 * Everything this app stores lives behind a Supabase session: the cost ledger and the
 * event log are rows guarded by row-level security, and the synced memory is a Netlify
 * blob behind the access code. Reading any of it used to mean opening the app in Chrome
 * and evaluating JavaScript against localStorage, which is a strange way to answer
 * "what did the last ten calls look like".
 *
 * This signs in the same way the app does and prints JSON. It holds no secrets of its own:
 * credentials come from the environment or from .env.local, which is gitignored and which
 * this script only ever reads.
 *
 *   cp .env.example .env.local     # then fill it in — nothing here writes it for you
 *
 *   node scripts/causerie.mjs memory            the synced profile blob (sessions, deck, memory)
 *   node scripts/causerie.mjs sessions [n]      the last n conversations, compact
 *   node scripts/causerie.mjs transcript [n]    one conversation in full (default: latest)
 *   node scripts/causerie.mjs costs [days]      the cost ledger
 *   node scripts/causerie.mjs events [days]     the user event log (admin sees everyone)
 *   node scripts/causerie.mjs whoami            check the credentials work
 *
 * Every command prints JSON on stdout and nothing else, so it pipes into jq.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** .env.local, if present. Values already in the environment win. */
function loadEnv() {
  try {
    for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, '');
      if (v && !process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* no file: the environment is the only source */ }
}
loadEnv();

const SUPA_URL = process.env.SUPABASE_URL || 'https://zkvcfrmctxgslqeicmsn.supabase.co';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_dvwajJuqITMgTp8ObFnjOw_1Ic44rF-';
const SITE = process.env.CAUSERIE_SITE || 'https://causerie-marco.netlify.app';

const die = (msg) => { console.error(msg); process.exit(1); };

/** A user JWT, the same one the browser holds. Password grant against Supabase auth —
 *  the credentials never leave this process and are never printed. */
async function signIn() {
  const email = process.env.CAUSERIE_EMAIL;
  const password = process.env.CAUSERIE_PASSWORD;
  if (!email || !password) {
    die('Set CAUSERIE_EMAIL and CAUSERIE_PASSWORD in .env.local (see .env.example).');
  }
  const r = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: SUPA_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!r.ok) die('sign-in failed (' + r.status + '): ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  if (!j.access_token) die('sign-in returned no token');
  return { token: j.access_token, user: j.user };
}

async function rest(path, token) {
  const r = await fetch(SUPA_URL + '/rest/v1/' + path, {
    headers: { apikey: SUPA_KEY, authorization: 'Bearer ' + token }
  });
  if (!r.ok) die('query failed (' + r.status + '): ' + (await r.text()).slice(0, 300));
  return r.json();
}

/** The synced profile blob: not a table, a Netlify blob behind the access code. */
async function memory() {
  const token = process.env.CAUSERIE_SYNC_TOKEN;
  const code = process.env.CAUSERIE_ACCESS_CODE;
  if (!token) die('Set CAUSERIE_SYNC_TOKEN in .env.local (app → Profils → sync code).');
  const r = await fetch(SITE + '/api/user-data', {
    headers: { 'x-sync-token': token, ...(code ? { 'x-access-code': code } : {}) }
  });
  if (!r.ok) die('memory fetch failed (' + r.status + '): ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return j.data ?? j;
}

const since = (days) => new Date(Date.now() - days * 86400000).toISOString();
const out = (x) => process.stdout.write(JSON.stringify(x, null, 1) + '\n');

const [cmd, arg] = process.argv.slice(2);

switch (cmd) {
  case 'whoami': {
    const { user } = await signIn();
    out({ id: user.id, email: user.email, created_at: user.created_at });
    break;
  }
  case 'memory':
    out(await memory());
    break;
  case 'sessions': {
    const m = await memory();
    const n = Number(arg) || 10;
    out((m.sessions ?? []).slice(-n).map(s => ({
      id: s.id, date: s.date, topic: s.topic, minutes: s.minutes, seconds: s.seconds,
      level: s.level, wpm: s.wpm, tutorShare: s.tutorShare,
      wordGoals: s.wordGoals, materials: s.materials,
      turns: (s.transcript ?? []).filter(t => t.role === 'user').length,
      corrections: (s.analysis?.corrections ?? []).length,
      costUsd: Math.round((s.costs ?? []).reduce((a, l) => a + l.usd, 0) * 1000) / 1000
    })));
    break;
  }
  case 'transcript': {
    const m = await memory();
    const list = m.sessions ?? [];
    const s = arg ? list.find(x => x.id === arg || x.topic?.includes(arg)) : list[list.length - 1];
    if (!s) die('no such conversation');
    out({
      date: s.date, topic: s.topic, minutes: s.minutes, tutorShare: s.tutorShare,
      turns: (s.transcript ?? []).map(t => ({ role: t.role, text: t.text })),
      verbatim: s.verbatim ?? null,
      briefing: s.briefing ?? null
    });
    break;
  }
  case 'costs': {
    const { token } = await signIn();
    out(await rest('conversation_costs?select=*&created_at=gte.' + since(Number(arg) || 30)
      + '&order=created_at.desc&limit=2000', token));
    break;
  }
  case 'events': {
    const { token } = await signIn();
    out(await rest('user_events?select=*&created_at=gte.' + since(Number(arg) || 90)
      + '&order=created_at.desc&limit=5000', token));
    break;
  }
  default:
    die('usage: causerie.mjs <whoami|memory|sessions|transcript|costs|events> [arg]');
}
