#!/usr/bin/env node
/* What the reprise would have been — on calls that already happened.
 *
 * The two minutes a call now opens with (src/lib/recall.ts) are built out of the PREVIOUS
 * call's analysis, which means the only honest way to judge them is against real calls:
 * a fixture can be made to produce a good question, and a week of real conversations
 * cannot. This replays the last few calls in the synced memory, rebuilds each one's
 * opening from the calls that came before it, and prints what she would have said.
 *
 *   node scripts/recall-preview.mjs                    the last 3 calls, from the live blob
 *   node scripts/recall-preview.mjs --calls 5          more of them
 *   node scripts/recall-preview.mjs --file mem.json    a memory export instead of the blob
 *   node scripts/recall-preview.mjs --briefing         the whole briefing, not just the block
 *   node scripts/recall-preview.mjs --json             machine-readable, for diffing runs
 *
 * The blob comes the same way scripts/causerie.mjs reads it: CAUSERIE_SITE and
 * CAUSERIE_SYNC_TOKEN from the environment or .env.local. Nothing is written anywhere.
 *
 * ONE APPROXIMATION, stated rather than hidden. The sessions are rewound exactly — call n
 * sees only calls 1..n-1 — but the rest of the memory (open weaknesses, the period
 * direction, the deck) is today's, because the app keeps no snapshot of it. Weaknesses
 * only decide WHICH of two corrections is asked about first, so the effect is small; it is
 * not zero.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const TMP = path.join(root, '.rehearsals', '.build-recall');

/* ---- arguments and credentials ------------------------------------------------------ */

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const CALLS = Math.max(1, Number(arg('calls', 3)) || 3);
const FILE = arg('file', '');
const FULL = argv.includes('--briefing');
const JSON_OUT = argv.includes('--json');

function loadEnv() {
  try {
    for (const line of readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, '');
      if (v && !process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* the environment is the only source */ }
}
loadEnv();

const die = msg => { console.error(msg); process.exit(1); };

/** The synced profile blob, or a file the caller exported by hand. */
async function memory() {
  if (FILE) {
    const j = JSON.parse(readFileSync(path.resolve(FILE), 'utf8'));
    return j.data ?? j;
  }
  const site = process.env.CAUSERIE_SITE;
  const token = process.env.CAUSERIE_SYNC_TOKEN;
  if (!site || !token) {
    die('Set CAUSERIE_SITE and CAUSERIE_SYNC_TOKEN in .env.local (app → Profils → sync code),\n'
      + 'or pass --file with a memory export.');
  }
  const code = process.env.CAUSERIE_ACCESS_CODE;
  const r = await fetch(site + '/api/user-data', {
    headers: { 'x-sync-token': token, ...(code ? { 'x-access-code': code } : {}) }
  });
  if (!r.ok) die('memory fetch failed (' + r.status + '): ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return j.data ?? j;
}

/* ---- the app's own code, bundled out of the TypeScript ------------------------------- */

/** Same trick as scripts/rehearse.mjs: what is previewed has to be the code that runs,
 *  not a re-implementation of it that can drift. */
function buildAppBundle() {
  mkdirSync(TMP, { recursive: true });
  const entry = path.join(TMP, 'entry.ts');
  writeFileSync(entry, [
    "export { RECALL_MINUTES, recall, recallText } from '../../src/lib/recall';",
    "export { buildTutorPrompt, greetingPrompt } from '../../src/lib/prompts';",
    "export { pack, setTutor, setUiLang } from '../../src/lang';",
    "export { tutorOf } from '../../src/lib/tutors';",
    ''
  ].join('\n'));
  const config = path.join(TMP, 'vite.config.mjs');
  writeFileSync(config, `
import { defineConfig } from 'vite';
export default defineConfig({
  logLevel: 'error',
  build: {
    lib: { entry: ${JSON.stringify(entry)}, formats: ['es'], fileName: 'app' },
    outDir: ${JSON.stringify(path.join(TMP, 'out'))},
    emptyOutDir: true,
    minify: false,
    target: 'node22'
  }
});
`);
  execFileSync('npx', ['vite', 'build', '--config', config], { cwd: root, stdio: 'inherit' });
  return path.join(TMP, 'out', 'app.js');
}

/* The bundle reads localStorage (profiles, UI language) as soon as a briefing is built. */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
  key: i => [...store.keys()][i] ?? null,
  get length() { return store.size; }
};

/** Run `fn` as if today were `iso`. The prompt builders read the clock (how many days ago
 *  the last call was, which incidental facts rotate in today), so replaying an August call
 *  from September without this would date every reprise "la dernière fois". */
function atDate(iso, fn) {
  const Real = Date;
  const fixed = new Real(String(iso).slice(0, 10) + 'T09:00:00.000Z');
  globalThis.Date = new Proxy(Real, {
    construct: (t, a) => (a.length ? new t(...a) : new t(fixed)),
    get: (t, k) => (k === 'now' ? () => fixed.getTime() : Reflect.get(t, k))
  });
  try { return fn(); } finally { globalThis.Date = Real; }
}

/* ---- the replay ---------------------------------------------------------------------- */

const rule = (c = '─') => c.repeat(78);
const dash = s => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Where each question came from, so a bad one can be traced to the analysis that made it
 *  rather than argued about in the abstract. */
function provenance(q) {
  if (q.kind === 'vocab') return `new_vocab « ${q.item} » — ${q.gloss || 'no gloss'}`;
  if (q.kind === 'grammar') return `correction (grammar) « ${dash(q.wrong)} » → « ${dash(q.answer)} »`;
  return q.wrong ? `correction (phrase) « ${dash(q.wrong)} » → « ${dash(q.item)} »` : `highlight « ${dash(q.item)} »`;
}

async function main() {
  const mem = await memory();
  const sessions = (mem.sessions ?? []).filter(s => s && s.date);
  if (sessions.length < 2) die(`only ${sessions.length} call(s) in this memory — nothing to come back to.`);

  const app = await import(buildAppBundle());
  app.setUiLang(mem.profile?.target || 'fr');
  app.setTutor(app.tutorOf(mem));
  const tp = app.pack(mem.profile?.target || 'fr').tutor;

  // The last N calls that HAVE a call before them: call 1 has no reprise by definition.
  const idxs = sessions.map((_, i) => i).filter(i => i > 0).slice(-CALLS);
  const rows = [];

  for (const i of idxs) {
    const s = sessions[i];
    // The memory as it stood when that call started: the calls before it, and nothing of
    // the call itself (its own analysis had not been written yet).
    const before = { ...mem, sessions: sessions.slice(0, i) };
    const skip = (s.wordGoals ?? []).map(g => g.word).filter(Boolean);
    const built = atDate(s.date, () => {
      const r = app.recall(before, { skip });
      if (!r) return null;
      const sess = {
        topic: s.topic, topicFr: s.topic, mode: 'daily', targets: s.targets ?? [],
        minutes: (s.minutes ?? 8) + app.RECALL_MINUTES, wordGoals: (s.wordGoals ?? []).map(g => ({ word: g.word, gloss: '', why: 'fresh' }))
      };
      return { r, block: app.recallText(r, tp.recall), cue: app.greetingPrompt(before, sess),
        briefing: FULL ? app.buildTutorPrompt(before, sess) : null };
    });
    rows.push({ call: { date: s.date, topic: s.topic, minutes: s.minutes }, ...(built || { r: null }) });
  }

  if (JSON_OUT) { process.stdout.write(JSON.stringify(rows, null, 1) + '\n'); return; }

  for (const row of rows) {
    const { call, r, block, cue, briefing } = row;
    console.log('\n' + rule('═'));
    console.log(`CALL OF ${call.date} — « ${dash(call.topic)} »   (${call.minutes ?? '?'} min as it ran, ${(call.minutes ?? 8) + 2} min with the reprise)`);
    console.log(rule('═'));
    if (!r) { console.log('\n  (no previous call to come back to)\n'); continue; }
    console.log(`\ncomes back to the call of ${r.date} — « ${dash(r.topic)} » · ${r.days} day(s) earlier · ${r.questions.length} question(s)\n`);
    console.log('── what she is told to open with ' + '─'.repeat(45));
    console.log('\n' + cue + '\n');
    console.log('── the block in the briefing ' + '─'.repeat(49));
    console.log('\n' + block + '\n');
    if (r.questions.length) {
      console.log('── where each question came from ' + '─'.repeat(45));
      r.questions.forEach((q, n) => console.log(`  ${n + 1}. [${q.kind}] ${provenance(q)}`));
      console.log('');
    }
    if (briefing) {
      console.log('── the whole briefing ' + '─'.repeat(56));
      console.log('\n' + briefing + '\n');
    }
  }
  console.log(rule());
  console.log(`${rows.length} call(s) replayed. The reprise adds ${app.RECALL_MINUTES} minutes to each.`);
  console.log('Weaknesses and the period direction are today\'s, not that day\'s — see the header of this file.');
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => rmSync(TMP, { recursive: true, force: true }));
