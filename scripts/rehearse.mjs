/* Rehearsal — a scripted student, the real voice model, and the numbers the week's calls
 * were judged on.
 *
 *   OPENAI_API_KEY=sk-… node scripts/rehearse.mjs                 # both variants, all students
 *   … node scripts/rehearse.mjs --variants new --students marche  # one run
 *   … node scripts/rehearse.mjs --baseline 10cf41e                # what "old" means
 *   node scripts/rehearse.mjs --score                             # score what is on disk
 *   node scripts/rehearse.mjs --serve                             # hand the jobs to a browser
 *
 * The --score pass judges transcripts already in .rehearsals, wherever they came from:
 * scripts/rehearse.browser.mjs runs the same calls from inside the signed-in app, which
 * needs no key at all, and both are held to the rules by this one scorer.
 *
 * WHY IT EXISTS. The briefing is two thousand words of rules and the only evidence that any
 * of them are followed is the transcript of a real call, days later, one sample at a time.
 * This plays a fixed student at her over the same wire a call uses — a realtime voice
 * session, audio in, audio out — and counts what the rules say should and should not
 * happen: her share of the words, turns over twenty-five words, two questions in one turn,
 * German inside a French sentence, and whether the error planted on the day's objective
 * comes back recast. `old` vs `new` runs the same scripts against the briefing as it was
 * at a git ref, so a prompt change can be argued about with numbers.
 *
 * WHAT IT CANNOT SEE. A script cannot interrupt her, cannot go quiet on her, and does not
 * care how she sounds: barge-in, silence-tolerance and prosody stay a matter for real
 * calls. The student's audio is text-to-speech, so her transcription of it is cleaner than
 * a microphone in a kitchen ever is.
 *
 * COST. A run is a few minutes of realtime audio: roughly $0.15–0.25 per call, printed
 * from the usage the API reports. Six runs is the default and costs about a coffee.
 */
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GERMAN, STUDENTS } from './rehearse/students.mjs';
import { rehearsalMemory, withTalkHistory } from './rehearse/memory.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const OUT = path.join(root, '.rehearsals');
const TMP = path.join(OUT, '.build');

/* ---- arguments ------------------------------------------------------------------- */

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const VARIANTS = arg('variants', 'old,new').split(',').map(s => s.trim()).filter(Boolean);
const WANTED = arg('students', STUDENTS.map(s => s.id).join(',')).split(',').map(s => s.trim());
const BASELINE = arg('baseline', 'HEAD~1');
const MODEL = arg('model', 'gpt-realtime-2.1');
const VOICE = arg('voice', 'marin');
/** Build the briefings and stop: no audio, no spend — for checking what the two variants
 *  actually differ by before paying to hear them. */
const DRY = argv.includes('--dry');
/** The modes that never call OpenAI from here: --dry builds briefings, --score reads
 *  transcripts, --serve hands the work to a signed-in browser that has its own key. */
const KEYLESS = DRY || argv.includes('--score') || argv.includes('--serve');
const KEY = process.env.OPENAI_API_KEY || '';
if (!KEY && !KEYLESS) {
  console.error('OPENAI_API_KEY is not set. Put it in the environment (it is never written anywhere by this script).');
  process.exit(2);
}

/* ---- the app's own prompt builder, bundled out of the TypeScript ------------------- */

/** vite builds src/lib/prompts.ts (and what it imports) into one ESM file we can import:
 *  the briefing under test has to be the one the app actually sends, not a copy of it. */
function buildAppBundle() {
  mkdirSync(TMP, { recursive: true });
  const entry = path.join(TMP, 'entry.ts');
  writeFileSync(entry, [
    "export { buildTutorPrompt, greetingPrompt } from '../../src/lib/prompts';",
    "export { blankMem } from '../../src/lib/storage';",
    "export { talkAlert } from '../../src/lib/talk';",
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

/* The bundle reads localStorage (profiles, UI language) the moment a briefing is built. */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
  key: i => [...store.keys()][i] ?? null,
  get length() { return store.size; }
};

/* ---- the two briefings ------------------------------------------------------------ */

/**
 * The template a variant runs on, or undefined for the one in the working tree:
 *   new           the briefing as it is now
 *   old           the briefing at --baseline (a git ref)
 *   <name>        scripts/rehearse/templates/<name>.fr.txt — a candidate being tried out,
 *                 which is how a rewrite gets measured before anyone lives with it
 */
function templateFor(variant, baselineTemplate) {
  if (variant === 'new') return undefined;
  if (variant === 'old') return baselineTemplate;
  const f = path.join(here, 'rehearse', 'templates', variant + '.fr.txt');
  if (!existsSync(f)) throw new Error(`no template for variant "${variant}" (looked in ${path.relative(root, f)})`);
  return readFileSync(f, 'utf8').replace(/\n+$/, '');
}

/** The French template as it stood at a git ref — what `old` means. */
function templateAt(ref) {
  const src = execFileSync('git', ['show', `${ref}:src/lang/fr.ts`], { cwd: root, encoding: 'utf8', maxBuffer: 8 << 20 });
  const m = src.match(/const template = `([\s\S]*?)`;\n/);
  if (!m) throw new Error(`no tutor template in ${ref}:src/lang/fr.ts`);
  return m[1];
}

/** Sentences the new build added OUTSIDE the template (the day block, the opening cue).
 *  The old variant has to lose them too, or the comparison is only half a comparison. */
const ADDED_OUTSIDE = [
  'UNE consigne à la fois. Si le sujet appelle un jeu de rôle ou une tâche, dis en une phrase qui tu es et ce qu’il fait en premier — rien d’autre —, et attends que ce soit fait avant la consigne suivante. Trois consignes d’un coup et il ne sait plus laquelle suivre.',
  'Aucune consigne d’exercice dans cette ouverture : elle vient après son accord, et une seule à la fois.'
];
const stripAdded = text => ADDED_OUTSIDE.reduce((s, a) => s.split(a).join('').replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' '), text);

/* ---- speech ------------------------------------------------------------------------ */

/** The student's line as audio: 24 kHz mono PCM, which is what the realtime input wants.
 *  The accent and the hesitancy are asked for in `instructions` — a learner read at news
 *  pace is not what she has to understand on a real call. */
async function speak(text) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts', voice: 'ash', input: text, response_format: 'pcm', speed: 0.95,
      instructions: 'Parle français avec un accent allemand net, à voix un peu hésitante, comme un élève de niveau A2 qui cherche parfois ses mots. Débit lent.'
    })
  });
  if (!r.ok) throw new Error('tts ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

/* ---- one call ---------------------------------------------------------------------- */

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * runCall({ instructions, greeting, lines }) → { turns, usage, ended }
 *   Opens a realtime session with the briefing under test, plays the opening cue the app
 *   plays, then feeds each scripted line as audio and waits for her answer. Turn detection
 *   is off: the script decides when a turn ends, which is the only way a fixed student can
 *   drive a model that is listening for a pause.
 */
async function runCall({ instructions, greeting, lines, onTurn }) {
  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODEL)}`,
    ['realtime', 'openai-insecure-api-key.' + KEY, 'openai-beta.realtime-v1']);
  const turns = [];
  const usage = { input: 0, output: 0, audio_in: 0, audio_out: 0 };
  const errors = [];
  let ended = false;          // she hung up with end_call
  let transcript = '';
  let waiting = null;         // resolve of the turn in flight

  const send = o => ws.send(JSON.stringify(o));
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', e => rej(new Error('socket: ' + (e.message || 'failed'))), { once: true });
  });

  ws.addEventListener('message', ev => {
    let e;
    try { e = JSON.parse(ev.data); } catch { return; }
    if (e.type === 'error') { errors.push(e.error?.message || JSON.stringify(e.error || e).slice(0, 200)); return; }
    if (e.type?.endsWith('audio_transcript.delta') && typeof e.delta === 'string') transcript += e.delta;
    if (e.type === 'response.done') {
      const r = e.response || {};
      const out = Array.isArray(r.output) ? r.output : [];
      // The transcript comes either as deltas or on the finished item, depending on the
      // API generation; take whichever arrived.
      const said = transcript.trim() || out.flatMap(i => (i.content || []).map(c => c.transcript || c.text || '')).join(' ').trim();
      if (out.some(i => i.type === 'function_call' && i.name === 'end_call')) ended = true;
      const u = r.usage || {};
      usage.input += u.input_tokens || 0;
      usage.output += u.output_tokens || 0;
      usage.audio_in += u.input_token_details?.audio_tokens || 0;
      usage.audio_out += u.output_token_details?.audio_tokens || 0;
      transcript = '';
      const turn = { role: 'assistant', text: said };
      turns.push(turn);
      onTurn?.(turn);
      waiting?.(turn);
      waiting = null;
    }
  });

  /** Her answer, or an empty turn if she says nothing within the wait. */
  const herTurn = async (ms = 60000) => {
    const t = await Promise.race([
      new Promise(r => { waiting = r; }),
      sleep(ms).then(() => null)
    ]);
    return t || { role: 'assistant', text: '' };
  };

  send({
    type: 'session.update',
    session: {
      type: 'realtime',
      output_modalities: ['audio'],
      instructions,
      tools: [{
        type: 'function', name: 'end_call',
        description: 'Hang up the call. Use ONLY after the goodbyes have been exchanged: you have said your final goodbye AND the student has said goodbye (or clearly asked to stop). Say your final goodbye first, in your usual tone, THEN call this in the same turn. Never call it mid-conversation.',
        parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
      }],
      tool_choice: 'auto',
      audio: {
        input: { format: { type: 'audio/pcm', rate: 24000 }, turn_detection: null },
        output: { voice: VOICE, speed: 0.95 }
      }
    }
  });
  await sleep(400);

  // The opening, exactly as the app kicks off: a system item, then a bare response.create.
  send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: greeting }] } });
  send({ type: 'response.create' });
  await herTurn();

  for (const line of lines) {
    const pcm = await speak(line.text);
    for (let i = 0; i < pcm.length; i += 32000) {
      send({ type: 'input_audio_buffer.append', audio: pcm.subarray(i, i + 32000).toString('base64') });
    }
    send({ type: 'input_audio_buffer.commit' });
    send({ type: 'response.create' });
    turns.push({ role: 'user', text: line.text, expect: line.expect || null });
    const t = await herTurn();
    if (ended && !line.goodbye) errors.push('hung up mid-conversation after: ' + line.text.slice(0, 40));
    if (ended) break;
  }

  ws.close();
  return { turns, usage, ended, errors };
}

/* ---- scoring ------------------------------------------------------------------------ */

const words = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const sentences = t => String(t || '').split(/(?<=[.!?…])\s+/).filter(s => s.trim());
const FRENCH = /\b(je|tu|il|elle|vous|nous|est|c'est|c’est|les|des|une|un|dans|pour|avec|pas|que|qui|quoi|alors|bon|oui|non)\b/i;
/** Two questions in one turn is rarely two question marks: it is « qui fait ça, et comment
 *  vous décidez ? ». Counting interrogatives inside a question is the only way to see it. */
const ASK = /\b(qui|que|qu(’|')est-ce|comment|quand|où|pourquoi|combien|quel|quelle)\b/gi;
const asks = t => (String(t || '').match(ASK) || []).length;
const CORRECTION_MARK = /(on dit|le mot,? c(’|')est|plutôt|en français,? c(’|')est|on écrit)/gi;

/** Every rule the transcript can be held to without asking a model. */
function score(turns) {
  const her = turns.filter(t => t.role === 'assistant' && t.text);
  const his = turns.filter(t => t.role === 'user');
  const herWords = her.reduce((a, t) => a + words(t.text), 0);
  const hisWords = his.reduce((a, t) => a + words(t.text), 0);
  const mixed = her.filter(t => sentences(t.text).some(s => GERMAN.test(s) && FRENCH.test(s)));
  const checks = [];

  turns.forEach((t, i) => {
    if (t.role !== 'user' || !t.expect) return;
    const next = turns.slice(i + 1).find(x => x.role === 'assistant');
    const text = next?.text || '';
    const e = t.expect;
    let ok = true;
    if (e.recast) ok = ok && e.recast.test(text);
    if (e.says) ok = ok && e.says.test(text);
    if (e.noMixedSentence) ok = ok && !sentences(text).some(s => GERMAN.test(s) && FRENCH.test(s));
    if (e.maxGloss) ok = ok && (text.match(new RegExp(GERMAN.source, 'gi')) || []).length <= 2;
    if (e.noNewQuestion) ok = ok && asks(text) <= 1 && words(text) <= 16;
    if (e.atMostOneCorrection) ok = ok && (text.match(CORRECTION_MARK) || []).length <= 1;
    checks.push({ label: e.label, ok, her: text.slice(0, 120), after: t.text.slice(0, 60) });
  });

  return {
    herTurns: her.length,
    share: herWords + hisWords ? herWords / (herWords + hisWords) : 0,
    herWords, hisWords,
    over25: her.filter(t => words(t.text) > 25).length,
    twoQuestions: her.filter(t => asks(t.text) >= 2 && /\?/.test(t.text)).length,
    perTurn: her.length ? Math.round((herWords / her.length) * 10) / 10 : 0,
    stageDirections: her.filter(t => /\b(continue|raconte|décris|dis-moi|commence|vas-y)\b/i.test(t.text)).length,
    germanTurns: her.filter(t => GERMAN.test(t.text)).length,
    mixedSentences: mixed.length,
    parExemple: her.filter(t => /\bpar exemple\b/i.test(t.text)).length,
    checks,
    checksOk: checks.filter(c => c.ok).length,
    checksTotal: checks.length
  };
}

/* ---- the run ------------------------------------------------------------------------ */

const pct = x => Math.round(x * 100) + '%';

/** One line per variant, and the rules each run kept or broke: the table the decision is
 *  made from. */
function report(rows, stamp = new Date().toISOString().replace(/[:.]/g, '-')) {
  const variants = [...new Set(rows.map(r => r.variant))];
  const summary = {};
  for (const v of variants) {
    const r = rows.filter(x => x.variant === v);
    const sum = k => r.reduce((a, x) => a + x[k], 0);
    summary[v] = {
      calls: r.length, herTurns: sum('herTurns'),
      share: sum('herWords') / Math.max(1, sum('herWords') + sum('hisWords')),
      over25: sum('over25'), twoQuestions: sum('twoQuestions'), stageDirections: sum('stageDirections'),
      perTurn: Math.round((sum('herWords') / Math.max(1, sum('herTurns'))) * 10) / 10,
      germanTurns: sum('germanTurns'), mixedSentences: sum('mixedSentences'), parExemple: sum('parExemple'),
      rules: sum('checksOk') + '/' + sum('checksTotal')
    };
  }
  writeFileSync(path.join(OUT, `${stamp}-summary.json`), JSON.stringify({ summary, rows }, null, 2));
  console.log('\n' + '─'.repeat(78));
  for (const [v, a] of Object.entries(summary)) {
    console.log(`${v.padEnd(4)} ${a.calls} calls · ${a.herTurns} turns · ${a.perTurn} mots/turn · ${pct(a.share)} hers · >25 mots ${a.over25} · 2 questions ${a.twoQuestions} · German ${a.germanTurns} (${a.mixedSentences} mixed) · consignes ${a.stageDirections} · rules ${a.rules}`);
  }
  console.log('');
  for (const r of rows) {
    for (const c of r.checks) console.log(`${(r.variant + '/' + r.student).padEnd(14)} ${c.ok ? '✓' : '✗'} ${c.label}${c.ok ? '' : '  → « ' + c.her.replace(/\s+/g, ' ').slice(0, 80) + ' »'}`);
  }
  console.log(`\nDetail: ${path.relative(root, OUT)}/${stamp}-summary.json`);
}

/** Score transcripts already on disk (the browser runner writes the same shape): each file
 *  is { variant, student, turns }, and the student's `expect` markers are re-attached here
 *  from scripts/rehearse/students.mjs, so a run recorded elsewhere is judged by these rules
 *  and not by its own. */
function scoreSaved() {
  const files = readdirSync(OUT).filter(f => f.endsWith('.turns.json'));
  if (!files.length) { console.error('nothing to score in ' + path.relative(root, OUT)); process.exit(1); }
  const rows = files.map(f => {
    const j = JSON.parse(readFileSync(path.join(OUT, f), 'utf8'));
    const student = STUDENTS.find(s => s.id === j.student);
    let n = 0;
    const turns = j.turns.map(t => (t.role === 'user' ? { ...t, expect: student?.lines[n++]?.expect || null } : t));
    return { variant: j.variant, student: j.student, file: f, ...score(turns) };
  });
  return rows;
}

/**
 * --serve: the jobs over http://127.0.0.1, for scripts/rehearse.browser.mjs.
 *   A run needs an OpenAI key; the signed-in app already has one behind its own server, so
 *   the browser can do the talking and this process only hands out the briefings and keeps
 *   the transcripts. Loopback only, no key, nothing to leak; the private-network headers are
 *   what lets an https page reach it at all.
 */
async function serve(app, port = Number(arg('port', 8787))) {
  const base = rehearsalMemory(app.blankMem);
  const oldTemplate = VARIANTS.includes('old') ? templateAt(BASELINE) : null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jobs = [];
  for (const variant of VARIANTS) {
    for (const student of STUDENTS.filter(s => WANTED.includes(s.id))) {
      const mem = withTalkHistory({ ...base, tutorTemplate: templateFor(variant, oldTemplate) });
      const sess = { topic: student.topic, targets: student.targets, minutes: 10, mode: 'daily' };
      let instructions = app.buildTutorPrompt(mem, sess);
      let greeting = app.greetingPrompt(mem, sess);
      if (variant === 'old') { instructions = stripAdded(instructions); greeting = stripAdded(greeting); }
      jobs.push({ id: `${variant}-${student.id}`, variant, student: student.id, instructions, greeting,
        lines: student.lines.map(l => ({ text: l.text, goodbye: !!l.goodbye })) });
    }
  }
  const done = new Set();
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-private-network': 'true',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  };
  const server = createServer((req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.url.startsWith('/jobs')) {
      res.writeHead(200, { ...cors, 'content-type': 'application/json' });
      return res.end(JSON.stringify(jobs));
    }
    if (req.url.startsWith('/result') && req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; });
      return req.on('end', () => {
        let j; try { j = JSON.parse(body); } catch { res.writeHead(400, cors); return res.end('bad json'); }
        const file = path.join(OUT, `${stamp}-${j.variant}-${j.student}.turns.json`);
        writeFileSync(file, JSON.stringify(j, null, 2));
        done.add(j.id);
        console.log(`✓ ${j.id}: ${j.turns.filter(t => t.role === 'assistant').length} of her turns` + (j.errors?.length ? ' · ' + j.errors.join(' | ') : ''));
        res.writeHead(200, { ...cors, 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, remaining: jobs.length - done.size }));
        if (done.size === jobs.length) {
          console.log('\nAll runs in. Scoring:\n');
          report(scoreSaved(), stamp);
          server.close();
          rmSync(TMP, { recursive: true, force: true });
          setTimeout(() => process.exit(0), 50);
        }
      });
    }
    res.writeHead(404, cors); res.end('no');
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`${jobs.length} jobs at http://127.0.0.1:${port}/jobs — waiting for the browser to run them.`);
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (argv.includes('--score')) { report(scoreSaved()); return; }
  if (argv.includes('--serve')) { await serve(await import(buildAppBundle())); return; }
  const app = await import(buildAppBundle());
  const base = rehearsalMemory(app.blankMem);
  const oldTemplate = VARIANTS.includes('old') ? templateAt(BASELINE) : null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rows = [];

  for (const variant of VARIANTS) {
    for (const student of STUDENTS.filter(s => WANTED.includes(s.id))) {
      // The talk history is part of the briefing under test: the new build is supposed to
      // put the last bad call in front of her, the old one averaged it away.
      const mem = withTalkHistory({ ...base, tutorTemplate: templateFor(variant, oldTemplate) });
      const sess = { topic: student.topic, targets: student.targets, minutes: 10, mode: 'daily' };
      let instructions = app.buildTutorPrompt(mem, sess);
      let greeting = app.greetingPrompt(mem, sess);
      if (variant === 'old') { instructions = stripAdded(instructions); greeting = stripAdded(greeting); }

      process.stdout.write(`\n▶ ${variant} · ${student.id} — briefing ${instructions.length} chars, ${student.lines.length} student turns\n`);
      if (DRY) {
        const f = path.join(OUT, `${stamp}-${variant}-${student.id}.briefing.txt`);
        writeFileSync(f, greeting + '\n\n' + '─'.repeat(72) + '\n\n' + instructions);
        const alert = app.talkAlert(mem);
        process.stdout.write(`  talk alert: ${alert === null ? 'silent' : Math.round(alert * 100) + '%'} · objectives: ${student.targets.length} · written to ${path.relative(root, f)}\n`);
        continue;
      }
      const t0 = Date.now();
      const call = await runCall({
        instructions, greeting, lines: student.lines,
        onTurn: t => process.stdout.write('  ' + (t.text || '(silence)').slice(0, 96).replace(/\s+/g, ' ') + '\n')
      });
      const s = score(call.turns);
      const row = { variant, student: student.id, seconds: Math.round((Date.now() - t0) / 1000), ...s, usage: call.usage, errors: call.errors, ended: call.ended };
      rows.push(row);
      writeFileSync(path.join(OUT, `${stamp}-${variant}-${student.id}.json`),
        JSON.stringify({ ...row, instructions, greeting, turns: call.turns }, null, 2));
      process.stdout.write(`  → ${pct(s.share)} hers · ${s.over25} long · ${s.twoQuestions} double-questions · ${s.germanTurns} German · ${s.checksOk}/${s.checksTotal} rules kept\n`);
      if (call.errors.length) process.stdout.write('  ! ' + call.errors.slice(0, 3).join(' | ') + '\n');
    }
  }

  /* ---- the table the decision is made from ---- */
  const agg = v => {
    const r = rows.filter(x => x.variant === v);
    if (!r.length) return null;
    const sum = k => r.reduce((a, x) => a + x[k], 0);
    return {
      calls: r.length,
      share: sum('herWords') / (sum('herWords') + sum('hisWords')),
      over25: sum('over25'), twoQuestions: sum('twoQuestions'),
      germanTurns: sum('germanTurns'), mixedSentences: sum('mixedSentences'), parExemple: sum('parExemple'),
      rules: sum('checksOk') + '/' + sum('checksTotal'),
      herTurns: sum('herTurns')
    };
  };
  if (DRY) { rmSync(TMP, { recursive: true, force: true }); return; }
  report(rows, stamp);
  rmSync(TMP, { recursive: true, force: true });
}

main().catch(e => { console.error(e); process.exit(1); });
