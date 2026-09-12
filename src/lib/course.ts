import type { CourseStep, GrammarCourse, GrammarDrill, GrammarGuide, GrammarViz, Memory } from '../types';
import { api, OAI } from './api';
import { pack } from '../lang';
import type { CompItem } from './competencies';
import { SHEET_BY_ID } from './sheets';
import { activeProfile } from './profiles';
import { checkAnswer } from './grammar';
import { scrubHint } from './hints';
import { norm, todayISO } from './utils';

/** Writing the grammar lessons.
 *
 *  A five-minute course per concept, in the discovery order Brilliant made its name on: the
 *  examples come first and the learner works the rule out, then the rule is stated as the
 *  payoff rather than as the opening. Generated rather than hand-written because there are
 *  thirty-three grammar cells in the French map alone, and because a generated one can be
 *  built around THIS learner's own recorded mistakes — which is the part no textbook can do.
 *
 *  Courses, their exercise banks and the fiches are all cached in localStorage, per profile
 *  and per concept: regenerating one costs a fraction of a cent, and the memory blob — which
 *  syncs whole on every save, has no ceiling, and fails silently when it overruns the quota —
 *  is the wrong place for a few kB of prose. What syncs is only which concepts have been
 *  taught and how they are going (lib/grammar).
 *
 *  Nothing here is ever on the critical path of a review sitting: the exercise bank is
 *  written at the same time as the course, so an evening's drills are already on the device
 *  before the first card is turned over. */

/** Bump when the schema or the teaching shape changes, so stale courses are regenerated
 *  rather than rendered by a player that no longer understands them. */
const COURSE_REV = 2;   // v2: every gap carries the cue that makes it answerable

/** Exercises asked for per course. Two evenings' worth at the shipped share, so the bank
 *  outlives the few days a concept normally takes to master. */
const BANK_SIZE = 12;

/** Options a multiple-choice step or exercise may carry. The prompt asks for three; the
 *  validators reject more, because the players draw at most this many and an option that is
 *  never drawn can never be chosen. */
export const MAX_OPTIONS = 4;

const profileId = () => activeProfile()?.id ?? 'solo';
/** Keyed by CONCEPT, not by date: the shelf is bounded by the size of the competency map
 *  (thirty-three cells in French) rather than growing by one entry a day the way the
 *  story cache does.
 *
 *  `who` is passed explicitly wherever a key is needed AFTER an await. A generation takes
 *  several seconds, the student can switch profiles inside them, and a key resolved on the
 *  way back would then file one learner's lesson — written from their mistakes — under
 *  another learner's name. Reads resolve it now, which is correct; writes resolve it before
 *  the call and carry it across. */
const courseKey = (id: string, who = profileId()) => `causerie.gcourse${COURSE_REV}:${who}:${id}`;
const guideKey = (id: string, who = profileId()) => `causerie.gfiche${COURSE_REV}:${who}:${id}`;

/* ---------- the model call ---------- */

async function chat(body: unknown): Promise<string> {
  const r = api.useServer()
    ? await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...api.authHeaders() },
      body: JSON.stringify(body)
    })
    : await fetch(OAI() + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + api.getKey() },
      body: JSON.stringify(body)
    });
  if (!r.ok) {
    // The proxy forwards OpenAI's status AND its body on the non-streamed path, and the
    // body is the only thing that ever says WHY — a rejected schema names the offending
    // field. Throwing the status alone is what left this undiagnosable from a phone.
    const detail = await r.text().catch(() => '');
    throw new Error('llm ' + r.status + (detail ? ': ' + detail.replace(/\s+/g, ' ').slice(0, 200) : ''));
  }
  const j = await r.json();
  const choice = j.choices?.[0];
  // A reasoning model that runs out of room stops mid-object, and the JSON.parse that
  // follows fails with a syntax error that says nothing about the cause. Name it here.
  if (choice?.finish_reason === 'length') throw new Error('llm truncated (finish_reason=length)');
  if (choice?.message?.refusal) throw new Error('llm refused: ' + String(choice.message.refusal).slice(0, 120));
  return choice?.message?.content ?? '';
}

/** Parses a structured reply, saying which call failed rather than letting a bare
 *  SyntaxError reach the screen. */
function parseReply<T>(content: string, what: string): T {
  if (!content.trim()) throw new Error(what + ': empty reply');
  try { return JSON.parse(content) as T; } catch { throw new Error(what + ': unparseable reply'); }
}

/* ---------- schemas ---------- */

const S = (description?: string) => (description ? { type: 'string', description } : { type: 'string' });
const ARR = (items: unknown, description?: string) => ({ type: 'array', items, ...(description ? { description } : {}) });

const EXAMPLES = ARR({
  type: 'object', additionalProperties: false,
  properties: { t: S('the sentence, in the target language'), gloss: S('what it means, in the support language. ALWAYS give it: the learner is being asked to reason from these sentences, and one they cannot read is not evidence.') },
  required: ['t', 'gloss']
}, 'The sentences this step is ABOUT, printed above the question. REQUIRED — 3 or 4 of them — on every `discover` step and on any step whose wording refers to "these sentences": they ARE the evidence the learner reasons from, and a question about sentences that were never shown is a broken screen. Empty only on `rule`, `recap` and a bare `gap`.');

/** The fixed menu of drawings. Every field is required because the schema is strict; the
 *  ones the chosen `kind` does not use come back empty, which is what the renderer expects. */
const VIZ = {
  type: 'object', additionalProperties: false,
  description: 'A drawing, or kind "none". Choose one only when the picture says something the sentence under it cannot.',
  properties: {
    kind: { type: 'string', enum: ['none', 'timeline', 'table', 'chunks', 'split'] },
    caption: S('one line saying what to look at; empty when kind is none'),
    marks: ARR({
      type: 'object', additionalProperties: false,
      properties: {
        at: { type: 'number', description: '0-10 position on a left-to-right axis of time' },
        len: { type: 'number', description: 'length of the span; 0 draws a moment rather than a stretch' },
        label: S('short label, target language'),
        tone: { type: 'string', enum: ['a', 'b'], description: 'a and b are the two contrasted colours' }
      },
      required: ['at', 'len', 'label', 'tone']
    }, 'timeline only'),
    cols: ARR(S(), 'table only: the header row, 2-4 columns'),
    rows: ARR({
      type: 'object', additionalProperties: false,
      properties: { head: S('the row label'), cells: ARR(S()) },
      required: ['head', 'cells']
    }, 'table only: at most six rows, cells matching cols in length'),
    hi: ARR(S(), 'table only: cells to highlight, each "row,col" 0-based'),
    slots: ARR({
      type: 'object', additionalProperties: false,
      properties: {
        label: S('what this slot IS, support language, 1-2 words'),
        text: S('what goes in it, target language'),
        tone: { type: 'string', enum: ['a', 'b', 'c'] }
      },
      required: ['label', 'text', 'tone']
    }, 'chunks only: the slots of the pattern in order, at most five'),
    left: {
      type: 'object', additionalProperties: false,
      properties: { title: S(), items: ARR(S()) }, required: ['title', 'items']
    },
    right: {
      type: 'object', additionalProperties: false,
      properties: { title: S(), items: ARR(S()) }, required: ['title', 'items']
    }
  },
  required: ['kind', 'caption', 'marks', 'cols', 'rows', 'hi', 'slots', 'left', 'right']
};

const DRILL = {
  type: 'object', additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['gap', 'choice'] },
    prompt: S('short support-language cue saying what to produce'),
    text: S('one target-language sentence carrying exactly one ___'),
    cue: S('what the blank is FOR, in the support language, WITHOUT containing the answer: which word is being replaced (« ta voisine »), which form is wanted (« le participe de prendre »), which person. Say it whenever the sentence alone leaves more than one defensible answer — which, for a pronoun or an auxiliary, is nearly always. Empty string only when the sentence really does settle it.'),

    options: ARR(S(), 'choice: exactly three short options, one right. Empty array for a gap.'),
    answer: S('what fills the gap — that alone, never the whole sentence'),
    explain: S('one short support-language line saying WHY')
  },
  required: ['kind', 'prompt', 'text', 'cue', 'options', 'answer', 'explain']
};

/** The diagrams, lifted OUT of the steps they belong to.
 *
 *  Nested inside every step, a strict schema made each of the eight emit all nine viz
 *  fields even to say "no drawing here" — several hundred tokens of `[]` per lesson, on the
 *  one call that was already the largest thing this app asks for. As a short list at the top
 *  level, keyed by the step it belongs to, only the one or two steps that actually have a
 *  drawing cost anything, and the schema is two levels shallower besides. */
const VIZ_AT = {
  ...VIZ,
  properties: { step: { type: 'integer', description: '0-based index of the step this belongs to' }, ...VIZ.properties },
  required: ['step', ...VIZ.required]
};

export const LESSON_SCHEMA = {
  name: 'grammar_lesson',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: S('the concept named in the target language, short'),
      why: S('one support-language line on why this is worth five minutes to THIS learner'),
      steps: ARR({
        type: 'object', additionalProperties: false,
        properties: {
          kind: { type: 'string', enum: ['discover', 'choice', 'gap', 'rule', 'recap'] },
          prompt: S('the question, or the heading on a rule/recap screen; support language'),
          examples: EXAMPLES,
          options: ARR(S(), 'discover/choice: 3-4 short options, exactly one right. Empty otherwise.'),
          correct: { type: 'integer', description: '0-based index of the right option; 0 when there are none' },
          text: S('gap: the sentence with exactly one ___. Empty otherwise.'),
          cue: S('what the blank is FOR, in the support language, WITHOUT containing the answer: which word is being replaced (« ta voisine »), which form is wanted (« le participe de prendre »), which person. Say it whenever the sentence alone leaves more than one defensible answer — which, for a pronoun or an auxiliary, is nearly always. Empty string only when the sentence really does settle it.'),

          answer: S('gap: what fills it. Empty otherwise.'),
          lines: ARR(S(), 'rule/recap: at most five short lines. Empty otherwise.'),
          explain: S('shown once answered, or straight away on a rule screen: WHY, in 1-2 lines')
        },
        required: ['kind', 'prompt', 'examples', 'options', 'correct', 'text', 'cue', 'answer', 'lines', 'explain']
      }),
      viz: ARR(VIZ_AT, 'AT MOST TWO drawings for the whole lesson, each naming its step. Empty when none earns its place.')
    },
    required: ['title', 'why', 'steps', 'viz']
  }
} as const;

/** The exercise bank, asked for separately. It is not needed until the lesson has been sat
 *  through, and asking for it in the same breath doubled the size of the one response this
 *  app waits on — the proxy buffers a non-streamed reply, and a reply that takes too long to
 *  finish is a reply nobody ever sees. */
export const BANK_SCHEMA = {
  name: 'grammar_bank',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    properties: { bank: ARR(DRILL) },
    required: ['bank']
  }
} as const;

export const GUIDE_SCHEMA = {
  name: 'grammar_guide',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: S('the concept named in the target language'),
      pages: ARR({
        type: 'object', additionalProperties: false,
        properties: {
          title: S('what this page covers, support language'),
          lines: ARR(S(), 'the substance, at most eight short lines'),
          examples: EXAMPLES,
          traps: ARR(S(), 'mistakes a speaker of the learner’s language actually makes here')
        },
        required: ['title', 'lines', 'examples', 'traps']
      }),
      viz: ARR(VIZ_AT, 'at most one drawing per page, each naming its page in `step`. Empty when none earns its place.')
    },
    required: ['title', 'pages', 'viz']
  }
} as const;

/* ---------- what the model is told about this learner ---------- */

const nativeName = (mem: Memory) => (mem.profile.native === 'en' ? 'English' : 'German');

/** The learner's own recorded mistakes on this concept, newest first.
 *
 *  This is the whole reason the lesson is generated rather than looked up: a course on the
 *  partitif that quotes the sentence they actually got wrong last Tuesday is teaching them,
 *  and one that does not is a textbook page. Matched on the correction's own cefr_topic and
 *  on the cheat-sheet keywords for the cell, which is the same matching lib/sheets does. */
export function ownErrors(mem: Memory, item: CompItem, n = 5): { wrong: string; better: string }[] {
  const sheet = SHEET_BY_ID[item.id];
  const keys = [...(sheet?.match ?? []), item.label].map(norm).filter(k => k.length > 3);
  if (!keys.length) return [];
  // Whole words, and only against the correction's own CEFR topic — the label the analysis
  // gave it. Matched as bare substrings against the explanation as well, a four-letter key
  // like "etre" or "avoir" hits half the French sentences ever written, and the lesson then
  // opens on three mistakes that have nothing to do with the concept it is teaching. This is
  // the same bounded matching lib/sheets uses to pick a sheet for a call.
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = (hay: string) => keys.some(k => new RegExp('\\b' + esc(k) + '\\b').test(hay));
  const out: { wrong: string; better: string }[] = [];
  for (const s of [...(mem.sessions ?? [])].reverse()) {
    for (const c of s.analysis?.corrections ?? []) {
      if (out.length >= n) return out;
      if (c.category !== 'grammar') continue;
      if (!hits(norm(c.cefr_topic))) continue;
      if (out.find(x => norm(x.wrong) === norm(c.original))) continue;
      out.push({ wrong: c.original, better: c.besser });
    }
  }
  return out;
}

/** The canonical rule as the pack already states it, so the model teaches the French that
 *  is in the app rather than the French it feels like inventing today. */
function sheetBrief(item: CompItem): string {
  const s = SHEET_BY_ID[item.id];
  if (!s) return '(no house sheet for this cell — rely on standard grammar)';
  return [
    'House sheet «' + s.title + '»:',
    ...s.core.map(l => '  · ' + l),
    ...(s.traps ?? []).map(l => '  ! ' + l)
  ].join('\n');
}

function learnerBrief(mem: Memory, item: CompItem): string {
  const errs = ownErrors(mem, item);
  const interests = (mem.interests ?? []).slice(0, 4).map(i => i.label).join(', ');
  const cell = mem.comp?.[item.id];
  return [
    `Concept: «${item.label}» (${item.band}).`,
    sheetBrief(item),
    `Learner: native ${nativeName(mem)}, interests: ${interests || '(unknown)'}.`,
    cell ? `The matrix has this cell as ${cell.status}${cell.evidence ? ', from: «' + cell.evidence + '»' : ''}.`
      : 'The matrix has never seen this cell used.',
    errs.length
      ? 'Their own recent mistakes on it:\n' + errs.map(e => `  ✗ «${e.wrong}»  →  ✓ «${e.better}»`).join('\n')
      : 'No recorded mistakes on this exact point yet.'
  ].join('\n');
}

/* ---------- one call at a time ---------- */

const inFlight = new Map<string, Promise<unknown>>();
const failedAt = new Map<string, number>();
/** How long a concept is left alone after a failed attempt, so a flat network is not asked
 *  the same expensive question on every visit to the day screen. Same figure lib/topicgen
 *  settled on for the same reason. */
const RETRY_AFTER_MS = 10 * 60 * 1000;

/** Runs `work` once per key: a second caller joins the call already in the air instead of
 *  starting another.
 *
 *  This is the whole of what makes a warmed lesson worth warming. The day screen starts
 *  writing the lesson as soon as it knows which one the button means; if the student taps
 *  before it lands, the button AWAITS that same call rather than firing a duplicate — so the
 *  tap costs whatever is left of the wait, never a second one, and never a second bill. */
function share<T>(key: string, work: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = work()
    .catch(e => { failedAt.set(key, Date.now()); throw e; })
    .finally(() => { inFlight.delete(key); });
  inFlight.set(key, p);
  return p;
}

/** Is this key resting after a recent failure? Consulted only by the background warming —
 *  a student who taps the button is asking for it now, and gets a real attempt. */
const resting = (key: string): boolean => {
  const f = failedAt.get(key);
  return !!f && Date.now() - f < RETRY_AFTER_MS;
};

/* ---------- courses ---------- */

export function cachedCourse(id: string): GrammarCourse | null {
  try {
    const raw = localStorage.getItem(courseKey(id));
    if (!raw) return null;
    const c = JSON.parse(raw) as GrammarCourse;
    return c && Array.isArray(c.steps) && c.steps.length ? c : null;
  } catch { return null; }
}

function cacheCourse(c: GrammarCourse, who: string): void {
  try { localStorage.setItem(courseKey(c.id, who), JSON.stringify(c)); } catch { /* cache only */ }
}

/** The exercise banks for a set of concepts, read straight off the cache. Synchronous and
 *  never networked: a review sitting must be able to build its queue offline. */
export function banksFor(ids: string[]): Record<string, GrammarDrill[]> {
  const out: Record<string, GrammarDrill[]> = {};
  for (const id of ids) {
    const c = cachedCourse(id);
    if (c?.bank?.length) out[id] = c.bank.map(d => ({ ...d, topic: id }));
  }
  return out;
}

export function makeCourse(mem: Memory, item: CompItem, fresh = false): Promise<GrammarCourse> {
  if (!fresh) {
    const hit = cachedCourse(item.id);
    if (hit) return Promise.resolve(hit);
  }
  return share(courseKey(item.id) + (fresh ? ':fresh' : ''), () => writeCourse(mem, item, fresh));
}

async function writeCourse(mem: Memory, item: CompItem, _fresh: boolean): Promise<GrammarCourse> {
  const who = profileId();          // resolved BEFORE the call, not after it
  const P = pack(mem.profile.target);
  const support = nativeName(mem);
  const sys = [
    `You write a five-minute discovery lesson on ONE point of ${P.en} grammar, for one adult learner, in the style of Brilliant.org: the learner works the rule out from examples BEFORE anybody states it. A lesson that opens by naming the rule has failed, however clear the rest of it is.`,
    '',
    'The shape, in this order:',
    '1. `discover` — 3-4 short sentences in `examples` as EVIDENCE, and a question about what they share. The options describe patterns in plain words, never grammatical jargon the learner has not met yet. It must be answerable from the examples alone by somebody who has never heard the rule.',
    '2. `choice` — one new case following the same pattern, with the naive guess sitting there as one of the wrong options.',
    '3. `rule` — NOW say it, in at most five short lines. This is the payoff for having worked it out.',
    '4. `gap` — apply it; the learner types the missing piece.',
    `5. \`choice\` or \`gap\` — the trap a ${support} speaker actually falls into here.`,
    '6. `gap` — a harder case, close to something this learner would really say.',
    '7. `recap` — three lines worth carrying away.',
    '',
    'Rules:',
    '- 7 to 9 steps, in that order. About five minutes at a calm pace.',
    `- Every prompt, option, rule line, recap line and explanation is in ${support}. Every example sentence, gap sentence and answer is in ${P.en}.`,
    `- Every example carries BOTH halves: \`t\`, the sentence in ${P.en}, and \`gloss\`, what it means in ${support}. A sentence the learner cannot read is not evidence, and an empty \`gloss\` is the commonest way to hand them one.`,
    '- EVERY `discover` step carries 3-4 `examples`. This is the single most important rule here: the examples ARE the lesson, the question is only what points at them, and a `discover` step with an empty `examples` array is a screen asking about sentences nobody can see. Never write « these sentences » without giving them.',
    '- A `gap` text carries EXACTLY ONE ___ ; `answer` is only what fills it, never the whole sentence.',
    '- An exercise must be ANSWERABLE from what is on the screen. « Je ___ connais » has four defensible answers until something says whose neighbour is meant; « Je ___ ai vus » has several until something says what was seen. Put that in `cue` — the noun being replaced, the form wanted, the person — never in a way that contains the answer itself. An exercise the learner can only guess at teaches them that the app is arbitrary.',
    '- `options` holds 3 SHORT choices, all different, and `correct` is the index of the right one. Empty for any other kind.',
    '- Never name the tense or the rule before the `rule` step reveals it — not in a prompt, not in an option, not in an explanation.',
    '- Every `explain` says WHY in one or two lines. Never "Correct!", never "Well done".',
    '- Examples must be sentences THIS learner could plausibly say, at their band, about the things they talk about. Where their own recorded mistakes are given below, build at least two steps directly on them.',
    '- `viz` is a SHORT list, NEVER longer than two, each entry naming the step it belongs to in `step`. Pick the kind by what the point IS, not by what looks nice: `timeline` ONLY where the point is about WHEN things happen relative to each other — never for word order; `chunks` for the order words go in, which is what a question about placement always wants; `table` for a paradigm worth seeing whole; `split` for a two-way contrast. None at all where a drawing would only redraw the sentence under it — that is the usual answer. Fill only the fields the chosen kind uses; the rest come back empty.'
  ].join('\n');

  const content = await chat({
    model: 'gpt-5.4-mini',
    messages: [{ role: 'system', content: sys }, { role: 'user', content: learnerBrief(mem, item) }],
    response_format: { type: 'json_schema', json_schema: LESSON_SCHEMA },
    // Deliberately 'low', as every other generator in this app uses. The proxy BUFFERS a
    // non-streamed reply, and a lesson that thinks for a minute before writing a word is a
    // lesson the edge function is killed in the middle of. See netlify/edge-functions/analyze.
    reasoning_effort: 'low'
  });
  const raw = parseReply<Lesson>(content, 'lesson');
  if (!raw.steps?.length) throw new Error('lesson: no steps');

  // The drawings come back as their own short list; put each one back on the step it names.
  const steps: CourseStep[] = raw.steps.map(st => ({
    ...st, viz: noViz(),
    // Held to the same standard the deck holds its cloze hints to: a cue that names the
    // answer is worse than none, because it turns a question into a reading exercise.
    cue: st.kind === 'gap' || st.kind === 'choice' ? (scrubHint(st.cue, st.answer) ?? '') : ''
  }));
  for (const v of (raw.viz ?? []).slice(0, 2)) {
    const st = steps[v.step];
    if (st && v.kind && v.kind !== 'none') st.viz = { ...noViz(), ...v };
  }

  const course: GrammarCourse = {
    id: item.id,
    title: raw.title || item.label,
    why: raw.why ?? '',
    steps: steps.filter(usableStep),
    bank: [],
    madeAt: todayISO()
  };
  if (!course.steps.length) throw new Error('lesson: nothing usable came back');
  if (!teachesByExample(course.steps)) throw new Error('lesson: came back with no evidence to reason from');
  cacheCourse(course, who);
  // The exercises are not needed until the lesson has been sat through, so they are written
  // after it rather than in the same breath, and the student never waits on them.
  void ensureBank(mem, item).catch(() => { /* Today warms it again tomorrow */ });
  return course;
}

/** The shape the lesson call returns: steps without their drawings, and the drawings beside
 *  them naming the step each belongs to. */
interface Lesson {
  title: string;
  why: string;
  steps: Omit<CourseStep, 'viz'>[];
  viz: (GrammarViz & { step: number })[];
}

const noViz = (): GrammarViz => ({
  kind: 'none', caption: '', marks: [], cols: [], rows: [], hi: [], slots: [],
  left: { title: '', items: [] }, right: { title: '', items: [] }
});

/** Writes the exercise bank for a concept and files it with its lesson. A no-op once the
 *  bank is there, so the day screen can call it freely. */
export function ensureBank(mem: Memory, item: CompItem): Promise<GrammarDrill[]> {
  const have = cachedCourse(item.id);
  if (have?.bank?.length) return Promise.resolve(have.bank);
  return share('bank:' + courseKey(item.id), () => writeBank(mem, item));
}

async function writeBank(mem: Memory, item: CompItem): Promise<GrammarDrill[]> {
  const who = profileId();
  const P = pack(mem.profile.target);
  const support = nativeName(mem);
  const sys = [
    `You write ${BANK_SIZE} micro-exercises on ONE point of ${P.en} grammar, for the short review sittings of one adult learner who has just been taught it.`,
    '',
    '- One sentence each, answerable in ten seconds, covering the full range of the rule including its traps.',
    '- Roughly half `gap` (the learner types the missing piece) and half `choice` (three SHORT options, all different, one of them exactly the answer).',
    '- Every `text` carries EXACTLY ONE ___ ; `answer` is only what fills it, never the whole sentence.',
    '- An exercise must be ANSWERABLE from what is on the screen. « Je ___ connais » has four defensible answers until something says whose neighbour is meant; « Je ___ ai vus » has several until something says what was seen. Put that in `cue` — the noun being replaced, the form wanted, the person — never in a way that contains the answer itself. An exercise the learner can only guess at teaches them that the app is arbitrary.',
    `- \`prompt\` and \`explain\` are in ${support}; every sentence and answer is in ${P.en}.`,
    '- `explain` says WHY in one short line.',
    '- Sentences this learner could plausibly say, at their band. Where their own recorded mistakes are given below, build two of the exercises directly on them.'
  ].join('\n');

  const content = await chat({
    model: 'gpt-5.4-mini',
    messages: [{ role: 'system', content: sys }, { role: 'user', content: learnerBrief(mem, item) }],
    response_format: { type: 'json_schema', json_schema: BANK_SCHEMA },
    reasoning_effort: 'low'
  });
  const raw = parseReply<{ bank: GrammarDrill[] }>(content, 'bank');
  const bank = (raw.bank ?? [])
    .map(d => ({ ...d, topic: item.id, cue: scrubHint(d.cue, d.answer) ?? '' }))
    .filter(usableDrill);
  if (!bank.length) throw new Error('bank: nothing usable came back');
  const course = cachedCourse(item.id);
  if (course) cacheCourse({ ...course, bank }, who);
  return bank;
}

/** A step the player can actually render. A gap with no gap, or a choice whose correct
 *  index points past its options, would otherwise reach the learner as a dead screen. */
/** A short answer is a function word — a pronoun, an article, an auxiliary — and those are
 *  exactly the blanks a sentence cannot settle on its own: « Je ___ connais » is answerable
 *  four ways until something says whose neighbour, « Je ___ ai vus » several until something
 *  says what was seen. Long answers are content words, which their own sentence usually
 *  pins down. So the cue is required precisely where it was missing. */
const needsCue = (answer: string): boolean => answer.trim().length <= 5;

/** Gaps in this app are runs of two or more underscores (the deck's cloze convention), and
 *  a step or exercise carries exactly one: there is a single `answer` to fill it with, so a
 *  second blank would be unanswerable and unmarkable. */
const oneGap = (text: string): boolean => (text.match(/_{2,}/g) ?? []).length === 1;

const distinct = (options: string[]): boolean =>
  new Set(options.map(o => norm(o))).size === options.length;

export function usableStep(s: GrammarCourse['steps'][number]): boolean {
  if (s.kind === 'gap') {
    return oneGap(s.text) && !!s.answer.trim()
      && (!needsCue(s.answer) || !!s.cue.trim() || s.examples.length > 0);
  }
  if (s.kind === 'discover' || s.kind === 'choice') {
    const askable = s.options.length >= 2 && s.options.length <= MAX_OPTIONS
      && distinct(s.options) && s.correct >= 0 && s.correct < s.options.length;
    // A discovery step is its evidence. Without the sentences, the question — « what do
    // these sentences have in common? » — is pointing at an empty space, and no learner can
    // answer it however good the options are.
    if (s.kind === 'discover') return askable && s.examples.length >= 2;
    return askable && (s.examples.length > 0 || oneGap(s.text) || !!s.prompt.trim());
  }
  return s.lines.length > 0 || !!s.prompt.trim();
}

/** Did a lesson come back as a discovery lesson at all? One with no evidence anywhere is
 *  the model having written a textbook page: worth throwing away and asking again, because
 *  the examples-first order is the whole of what this feature is for. */
const teachesByExample = (steps: GrammarCourse['steps']): boolean =>
  steps.some(s => s.kind === 'discover') && steps.some(s => s.examples.length >= 2);

export function usableDrill(d: GrammarDrill): boolean {
  if (!oneGap(d.text) || !d.answer.trim()) return false;
  // A choice exercise shows its options, so the answer is findable among them; a typed one
  // shows nothing, and without a cue it is a guess.
  if (d.kind === 'gap' && needsCue(d.answer) && !d.cue.trim()) return false;
  if (d.kind === 'choice') {
    // A choice whose answer is not among its options cannot be got right — and the test has
    // to be the SAME accent-sensitive one the player grades with. Comparing through
    // utils.norm would pass a drill whose options are « mange » and « manger » against the
    // answer « mangé », and the learner would then be unable to get it right at all, which
    // is precisely the exercise a French grammar course most wants to set.
    // Bounded by what the player RENDERS, not by what came back: an answer sitting past the
    // last option drawn on screen cannot be picked, so the exercise would be unwinnable.
    return d.options.length >= 2 && d.options.length <= MAX_OPTIONS && distinct(d.options)
      && d.options.some(o => checkAnswer(o, d.answer) === 'right');
  }
  return true;
}

/* ---------- the fiche ---------- */

export function cachedGuide(id: string): GrammarGuide | null {
  try {
    const raw = localStorage.getItem(guideKey(id));
    if (!raw) return null;
    const g = JSON.parse(raw) as GrammarGuide;
    return g && Array.isArray(g.pages) && g.pages.length ? g : null;
  } catch { return null; }
}

/** Writes the detailed fiche. As many pages as the concept needs — one for a rule like the
 *  futur proche, four or five for the passé composé, which is three rules and an agreement
 *  wearing a single name. */
export function makeGuide(mem: Memory, item: CompItem, fresh = false): Promise<GrammarGuide> {
  if (!fresh) {
    const hit = cachedGuide(item.id);
    if (hit) return Promise.resolve(hit);
  }
  return share(guideKey(item.id) + (fresh ? ':fresh' : ''), () => writeGuide(mem, item));
}

async function writeGuide(mem: Memory, item: CompItem): Promise<GrammarGuide> {
  const who = profileId();          // resolved BEFORE the call, not after it
  const P = pack(mem.profile.target);
  const support = nativeName(mem);
  const sys = [
    `You write the reference page a learner of ${P.en} comes back to after being taught one point of grammar. Not a lesson — they have had the lesson. This is what they consult at the moment of using it.`,
    '',
    `- Split it into as many pages as the concept genuinely has parts: ONE page for a simple rule, four or five for something like the passé composé, which is three rules and an agreement wearing a single name. Never pad a simple concept out to fill pages.`,
    '- Each page: a title, at most eight short lines of substance, two or three examples, and the traps.',
    `- Lines, titles, glosses and traps are in ${support}; every example sentence is in ${P.en}.`,
    '- Lines are reference, not prose: forms, endings, the order things go in, the one-line conditions. A line a learner cannot use while mid-sentence does not belong.',
    `- The traps are the mistakes a ${support} speaker actually makes here, not a general list. Where this learner's own recorded mistakes are given below, one page must address them by name.`,
    '- `viz` is a short list beside the pages, each entry naming its page in `step`: at most one drawing per page, and only where it earns its place. `timeline` ONLY for when things happen relative to each other, never for word order; `chunks` for the order words go in; `table` for a paradigm; `split` for a two-way contrast. A conjugation table is almost always worth drawing; everything else usually is not.'
  ].join('\n');

  const content = await chat({
    model: 'gpt-5.4-mini',
    messages: [{ role: 'system', content: sys }, { role: 'user', content: learnerBrief(mem, item) }],
    response_format: { type: 'json_schema', json_schema: GUIDE_SCHEMA },
    reasoning_effort: 'low'
  });
  const raw = parseReply<{ title: string; pages: Omit<GrammarGuide['pages'][number], 'viz'>[]; viz: (GrammarViz & { step: number })[] }>(content, 'fiche');
  if (!raw.pages?.length) throw new Error('fiche: no pages');
  const pages = raw.pages.map(pg => ({ ...pg, viz: noViz() }));
  for (const v of raw.viz ?? []) {
    const pg = pages[v.step];
    if (pg && v.kind && v.kind !== 'none') pg.viz = { ...noViz(), ...v };
  }
  const guide: GrammarGuide = {
    id: item.id,
    title: raw.title || item.label,
    pages: pages.filter(pg => pg.lines.length || pg.examples.length),
    madeAt: todayISO()
  };
  if (!guide.pages.length) throw new Error('fiche: nothing usable came back');
  try { localStorage.setItem(guideKey(item.id, who), JSON.stringify(guide)); } catch { /* cache only */ }
  return guide;
}

/** Writes, in the background, whatever the grammar button would open if it were tapped now.
 *
 *  A lesson takes several seconds to write, and a button that spends them spinning has
 *  already eaten part of the five minutes it promises. The day screen knows which concept
 *  the button means the moment it renders, so the lesson is written then — and because
 *  makeCourse shares its call, a student who taps mid-write joins that call instead of
 *  starting a second one.
 *
 *  Never throws, and rests for ten minutes after a failure so a flat network is not asked
 *  the same expensive question on every visit to the day screen. */
export async function warm(mem: Memory, item: CompItem, want: 'course' | 'bank' | 'guide'): Promise<void> {
  const key = (want === 'guide' ? guideKey(item.id) : courseKey(item.id)) + ':warm:' + want;
  if (resting(key)) return;
  try {
    if (want === 'guide') await makeGuide(mem, item);
    else if (want === 'bank') await ensureBank(mem, item);
    else await makeCourse(mem, item);
  } catch {
    failedAt.set(key, Date.now());
  }
}

/** Drops the cached fiche so the next open writes a new one.
 *
 *  Called once a REDONE lesson has landed, never before: a fiche is written from the same
 *  brief as its lesson, so a new lesson makes the old fiche stale. Deliberately no companion
 *  that drops the course — the cached course is the only home of the concept's exercise
 *  bank, and deleting it up front would leave tonight's sitting with nothing to ask if the
 *  redo were abandoned or the replacement never arrived. makeCourse(fresh) overwrites it in
 *  place instead, so the bank is only ever replaced, never absent. */
export function forgetGuide(id: string): void {
  try { localStorage.removeItem(guideKey(id)); } catch { /* nothing cached, nothing to forget */ }
}
