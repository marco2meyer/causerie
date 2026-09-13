import type { GrammarDrill, GrammarState, GrammarTopic, Memory, Settings } from '../types';
import { band, BANDS } from './cefr';
import { compById, compLib, type CompItem } from './competencies';
import { pack } from '../lang';
import { sheetForComp } from './sheets';
import { norm, todayISO } from './utils';

/** Grammar taught outright.
 *
 *  The competency matrix has always known which grammar a learner is missing — the calls
 *  fill it in, cell by cell — and the app did nothing with that but whisper it to the tutor.
 *  This is the other half: take the worst cell at or below the learner's own band, teach it
 *  in five minutes, then keep asking about it inside the review sittings until it sticks.
 *
 *  Three things live here, all of them pure so they can be tested without a network or a
 *  browser: which concept is next (the queue), whether the one being drilled has been
 *  learned (the verdict), and which exercises go into tonight's sitting (the interleave).
 *  Everything that needs a model lives in lib/course.ts. */

/* ---------- constants ---------- */

/** Default share of a sitting given to grammar, in percent. Added to the cards, not taken
 *  from them: at the shipped eighteen-card sitting this is four or five exercises. */
export const GRAMMAR_SHARE = 25;

/** However big the sitting, never more than this many exercises in one of them. A review
 *  is still a review; past half a dozen interruptions it becomes a grammar lesson with
 *  cards in it. */
export const MAX_DRILLS = 6;

/** Days of drill tallies kept per concept. Long enough to see a fortnight of evidence,
 *  short enough that a concept relearned months later is judged on the relearning. */
export const DRILL_DAYS = 30;

/* ---------- mastery ---------- */

/** What it takes to call a concept learned. Deliberately as much about TIME as about
 *  accuracy: the whole point of drilling a rule across several sittings is that getting it
 *  right twice in one evening proves only that it is still in working memory. */
export const MASTERY = {
  /** Distinct days on which the concept was drilled. */
  days: 3,
  /** Exercises answered, all-time. */
  tries: 8,
  /** Share of the most recent RECENT tries that must be right. */
  accuracy: 0.8,
  /** How many recent tries the accuracy is measured over. */
  recent: 10
} as const;

const dayNo = (iso: string): number => Math.floor(Date.parse(iso + 'T12:00:00Z') / 86400000);

/** The day the concept was last TAUGHT — the redo if there was one, otherwise the course. */
export const taughtOn = (t: GrammarTopic): string => t.redoneAt || t.courseAt || '';

/** The drill days that count as evidence about the current teaching of this concept.
 *
 *  A redo, or a concept the student reopened by hand, is the app being told that what it
 *  thought had stuck has not. Answers from before that moment describe a student who no
 *  longer exists — judging the relearning on them re-masters the concept two days later on
 *  the strength of the very tallies that were already proved wrong. The history is kept, it
 *  is simply no longer evidence. */
export function activeDays(t: GrammarTopic): { d: string; ok: number; ko: number }[] {
  const from = taughtOn(t);
  return (t.days ?? []).filter(d => !from || d.d >= from);
}

/** Exercises answered for this concept since it was last taught, and how many were right. */
export function drillTally(t: GrammarTopic): { tries: number; ok: number } {
  let tries = 0, ok = 0;
  for (const d of activeDays(t)) { tries += d.ok + d.ko; ok += d.ok; }
  return { tries, ok };
}

/** Accuracy over the most recent `n` answers, oldest days dropped first. Null when there
 *  is nothing to measure. Days hold tallies rather than individual answers, so the window
 *  is taken a whole day at a time and the oldest day inside it is only partly counted. */
export function recentAccuracy(t: GrammarTopic, n: number = MASTERY.recent): number | null {
  const days = [...activeDays(t)].reverse();     // newest first
  let tries = 0, ok = 0;
  for (const d of days) {
    const total = d.ok + d.ko;
    if (total === 0) continue;
    const take = Math.min(total, n - tries);
    // Count the day's share proportionally rather than assuming its right answers came
    // first: a day half inside the window would otherwise read as perfect or as hopeless
    // depending only on which end of it the window happened to cut.
    ok += (d.ok / total) * take;
    tries += take;
    if (tries >= n) break;
  }
  return tries ? ok / tries : null;
}

/** Has this concept been learned? Manual marks and an already-set date short-circuit; the
 *  competency matrix is allowed to settle it early — a call in which the student simply
 *  USED the structure correctly is better evidence than any number of gap-fills, so an
 *  `ok` cell needs only half the drilling. */
export function isMastered(t: GrammarTopic, cellOk = false, today = todayISO()): boolean {
  if (t.masteredAt || t.manual) return true;
  const { tries } = drillTally(t);
  const days = activeDays(t).filter(d => d.ok + d.ko > 0).length;
  const acc = recentAccuracy(t);
  const elapsed = taughtOn(t) ? dayNo(today) - dayNo(taughtOn(t)) : 0;
  const need = cellOk
    ? { days: Math.ceil(MASTERY.days / 2), tries: Math.ceil(MASTERY.tries / 2), elapsed: 1 }
    : { days: MASTERY.days, tries: MASTERY.tries, elapsed: MASTERY.days - 1 };
  return days >= need.days && tries >= need.tries && elapsed >= need.elapsed
    && acc !== null && acc >= MASTERY.accuracy;
}

/* ---------- state helpers ---------- */

export const blankGrammar = (): GrammarState => ({ topics: {}, order: [], skipped: [] });

/** The grammar state, created on demand. Mutates `mem`. Every field is re-defaulted rather
 *  than trusted: this state can arrive from a device on an older build, through a sync that
 *  replaces the blob wholesale and never migrates it field by field. */
export function grammarState(mem: Memory): GrammarState {
  if (!mem.grammar) mem.grammar = blankGrammar();
  const g = mem.grammar;
  g.topics = g.topics ?? {};
  g.order = g.order ?? [];
  g.skipped = g.skipped ?? [];
  return g;
}

/** Read-only view, safe on a memory that has never met the feature. */
export const grammarOf = (mem: Memory): GrammarState => mem.grammar ?? blankGrammar();

/** Concepts taught and not yet mastered, oldest course first. These are the ones whose
 *  exercises are still owed a place in the sittings. */
export function learningTopics(mem: Memory): string[] {
  const g = grammarOf(mem);
  // Only concepts from THIS profile's own map. A memory that has been through more than one
  // target language still holds the other's ids, and an exercise on the French partitif has
  // no business in a Spanish sitting.
  const lib = compById(mem.profile.target);
  return Object.entries(g.topics)
    .filter(([id, t]) => lib[id] && !t.masteredAt && !t.manual)
    .sort((a, b) => taughtOn(a[1]).localeCompare(taughtOn(b[1])) || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}

/** Records one answer against a concept. Mutates `mem`; returns the topic. */
export function recordDrill(mem: Memory, topic: string, right: boolean, today = todayISO()): GrammarTopic | null {
  const g = grammarState(mem);
  const t = g.topics[topic];
  if (!t) return null;                       // an exercise for a concept no longer tracked
  t.days = t.days ?? [];
  const day = t.days.find(d => d.d === today) ?? (t.days.push({ d: today, ok: 0, ko: 0 }), t.days[t.days.length - 1]);
  if (right) day.ok++; else day.ko++;
  if (t.days.length > DRILL_DAYS) t.days = t.days.slice(-DRILL_DAYS);
  return t;
}

/** Days a concept is held after its lesson when there are no exercises to judge it by.
 *  Long enough for a call or two to have gone by — the matrix is then the only witness — and
 *  short enough that the strand keeps moving. */
export const NO_DRILL_DAYS = 4;

/** Marks every concept whose evidence now clears the bar. Mutates `mem`; returns the ids
 *  that changed, so the app can say so rather than silently moving the goalposts.
 *
 *  The second clause is the one that keeps the strand alive when the student has turned the
 *  exercises off. Mastery is normally earned by answering them, so with the share at zero a
 *  taught concept could never clear the bar, and the day screen would go on offering the
 *  same fiche for ever — the one thing this feature exists not to do. With no exercises
 *  possible, the app has taught what it can teach, and after a few days it moves on. */
export function settleMastery(mem: Memory, today = todayISO()): string[] {
  const g = grammarState(mem);
  const drilling = (mem.settings?.grammarShare ?? GRAMMAR_SHARE) > 0;
  const out: string[] = [];
  for (const [id, t] of Object.entries(g.topics)) {
    if (t.masteredAt || t.manual) continue;
    const taught = taughtOn(t);
    const elapsed = taught ? dayNo(today) - dayNo(taught) : 0;
    const stalled = !drilling && drillTally(t).tries === 0 && elapsed >= NO_DRILL_DAYS;
    if (stalled || isMastered(t, mem.comp?.[id]?.status === 'ok', today)) {
      t.masteredAt = today;
      out.push(id);
    }
  }
  return out;
}

/** Records a finished mini-course. Mutates `mem`. */
export function markCourseDone(mem: Memory, id: string, today = todayISO()): void {
  const g = grammarState(mem);
  const ex = g.topics[id];
  // A redo restarts the clock without throwing the history away: the student came back to
  // a rule that was not sticking, and the days before that are not evidence about the
  // version of them that has just been taught it again.
  if (ex) { ex.redoneAt = today; delete ex.masteredAt; delete ex.manual; }
  else g.topics[id] = { courseAt: today, days: [] };
  g.order = g.order.filter(x => x !== id);
  g.skipped = g.skipped.filter(x => x !== id);
}

/* ---------- the queue ---------- */

/** Whole-word matcher for one cell, built from its cheat-sheet keywords and its own label.
 *  The same bounded matching lib/course uses to pull the learner's own mistakes into a
 *  lesson: whole words only, keys of four letters or more — a four-letter key like "etre"
 *  matched as a substring hits half the French sentences ever written. */
export function cellMatcher(item: CompItem, lang?: string): (hay: string) => boolean {
  const sheet = sheetForComp(item.id, item.label, lang);
  const keys = [...(sheet?.match ?? []), item.label].map(norm).filter(k => k.length > 3);
  if (!keys.length) return () => false;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const res = keys.map(k => new RegExp('\\b' + esc(k) + '\\b'));
  return hay => res.some(r => r.test(hay));
}

/** Corrections from this many recent calls count towards a cell's pressure. Enough to see
 *  a fortnight of daily calls; old enough mistakes describe a learner who may be gone. */
const PRESSURE_SESSIONS = 14;

/** How hard the learner's own record leans on each grammar cell.
 *
 *  The matrix is not the only witness to a cell failing. The analysis also keeps tracked
 *  weaknesses — «prépositions», worked thirty-one calls running and still persisting — and
 *  a per-call correction log, and neither used to move the queue at all: a cell the matrix
 *  happened never to observe sat behind freshly-grey cells while the calls corrected it
 *  daily. Weaknesses weigh by how alive they are (persisting > new > improving; resolved
 *  not at all), each correction on the concept adds one. */
export function weaknessPressure(mem: Memory): Record<string, number> {
  const out: Record<string, number> = {};
  const sessions = (mem.sessions ?? []).slice(-PRESSURE_SESSIONS);
  for (const item of compLib(mem.profile.target)) {
    if (item.cat !== 'grammaire') continue;
    const hits = cellMatcher(item, mem.profile.target);
    let p = 0;
    for (const w of mem.weaknesses ?? []) {
      if (w.status === 'resolved' || !hits(norm(w.label))) continue;
      p += w.status === 'persisting' ? 3 : w.status === 'new' ? 2 : 1;
    }
    for (const s of sessions) {
      for (const c of s.analysis?.corrections ?? []) {
        if (c.category === 'grammar' && hits(norm(c.cefr_topic))) p++;
      }
    }
    if (p) out[item.id] = p;
  }
  return out;
}

/** How badly one cell wants teaching. Lower sorts first.
 *
 *  Failed outright beats mixed beats never-observed beats demonstrated, and inside each of
 *  those the lower band comes first: a learner who cannot manage the passé composé is not
 *  served by a lesson on the subjunctive, however loudly the subjunctive is failing. This
 *  is the same foundations-before-frontier rule the tutor's silent probes follow.
 *
 *  Pressure from the learner's own record can promote a cell: a documented persisting
 *  weakness is failure as surely as a red matrix cell, and a couple of corrections are at
 *  least a mixed showing. Within the same standing and band, the heavier-pressed cell
 *  comes first. */
function score(item: CompItem, mem: Memory, pressure: Record<string, number>): number {
  const st = mem.comp?.[item.id]?.status;
  let rank = st === 'ko' ? 0 : st === 'partial' ? 1 : st === undefined ? 2 : 3;
  const p = pressure[item.id] ?? 0;
  if (p >= 3) rank = 0;
  else if (p >= 1) rank = Math.min(rank, 1);
  return rank * 100 + BANDS.indexOf(item.band) * 10 + Math.max(0, 9 - p);
}

/** Grammar cells that are candidates at all: this language's grammar, at or below the
 *  learner's own band, not skipped, not already taught. Cells ABOVE the band are held back
 *  until everything below is done — the feature exists to close gaps, not to run ahead. */
function candidates(mem: Memory): CompItem[] {
  const g = grammarOf(mem);
  const taught = new Set(Object.keys(g.topics));
  const skipped = new Set(g.skipped);
  const lib = compLib(mem.profile.target).filter(c =>
    c.cat === 'grammaire' && !taught.has(c.id) && !skipped.has(c.id));
  const cur = BANDS.indexOf(band(mem.cefr.overall));
  const within = lib.filter(c => BANDS.indexOf(c.band) <= cur);
  // Everything at their level and below has been taught: let the next band up in, one step
  // at a time, so the strand does not simply stop for a student who keeps up with it.
  if (within.length) return within;
  return lib.filter(c => BANDS.indexOf(c.band) === cur + 1);
}

/** What to teach, best first: the student's own order at the front (those ids exactly, in
 *  their order), then everything else by how badly it is wanted. */
export function grammarQueue(mem: Memory): CompItem[] {
  const g = grammarOf(mem);
  const pool = candidates(mem);
  const byId = new Map(pool.map(c => [c.id, c]));
  const picked: CompItem[] = [];
  for (const id of g.order) {
    const c = byId.get(id);
    if (c) { picked.push(c); byId.delete(id); }
  }
  const pressure = weaknessPressure(mem);
  const rest = [...byId.values()].sort((a, b) =>
    score(a, mem, pressure) - score(b, mem, pressure) || a.id.localeCompare(b.id));
  return [...picked, ...rest];
}

/** The concept the grammar button is about right now.
 *
 *  A concept already taught and still being drilled holds the button — it is what the
 *  student is working on, and the button is where its fiche lives — until it is mastered.
 *  Only then does the queue hand over the next one. Null when there is nothing left. */
export function grammarFocus(mem: Memory): { item: CompItem; topic: GrammarTopic | null } | null {
  const lib = compLib(mem.profile.target);
  const byId = new Map(lib.map(c => [c.id, c]));
  const g = grammarOf(mem);
  for (const id of learningTopics(mem)) {
    const item = byId.get(id);
    if (item) return { item, topic: g.topics[id] };
  }
  const next = grammarQueue(mem)[0];
  return next ? { item: next, topic: null } : null;
}

/* ---------- interleaving ---------- */

/** Exercises to add to a sitting of `cards` cards. */
export function drillCount(s: Pick<Settings, 'grammarShare'>, cards: number): number {
  const pct = s.grammarShare ?? GRAMMAR_SHARE;
  if (pct <= 0 || cards <= 0) return 0;
  // Never more exercises than cards: that is what lets interleave promise it will never put
  // two of them back to back, and a sitting with more grammar in it than deck is not a
  // review sitting any more whatever the percentage says.
  return Math.min(cards, Math.max(1, Math.min(MAX_DRILLS, Math.round((cards * pct) / 100))));
}

/** Picks tonight's exercises from the banks of the concepts still being drilled.
 *
 *  Weighted towards the newest concept — it is the one the student is actually working on —
 *  but never only it: a rule learned last week that is about to be declared mastered still
 *  has to earn that, and a sitting that only ever asks about today's lesson can never tell
 *  the difference between learned and just-heard.
 *
 *  `banks` is keyed by competency id; a concept whose bank has not been generated (or has
 *  been evicted from the cache) is simply skipped. The rotation is by day so that two
 *  sittings on the same day differ, and the same three exercises do not come back nightly. */
export function pickDrills(
  mem: Memory, n: number, banks: Record<string, GrammarDrill[]>, today = todayISO(), round = 0
): GrammarDrill[] {
  if (n <= 0) return [];
  const learning = learningTopics(mem).filter(id => (banks[id] ?? []).length);
  if (!learning.length) return [];
  // Newest concept first, and given twice the slots of any other.
  const order = [...learning].reverse();
  const weights = order.map((_, i) => (i === 0 ? 2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  // Strictly increasing across sittings — day 0 round 0, then 1, 2, 3, then day 1 round 0 —
  // so consecutive sittings always land on a different window of the bank. A stride that
  // shared a factor with a bank's length (7 and a bank of 7, or 3 and a bank of 3) handed
  // the second sitting of the day exactly the exercises the first one had just asked.
  const off = dayNo(today) * 4 + Math.max(0, Math.min(3, round));
  const out: GrammarDrill[] = [];
  const taken: Record<string, number> = {};
  // The ring STARTS at a different place each sitting. Walked from zero every time, a
  // sitting with fewer slots than the ring is long never reaches its tail, so with three or
  // four concepts in the air the oldest is asked nothing, ever — and a concept that is never
  // asked can never be answered, never mastered, and never make way for the next.
  //
  // Advanced by DAY and round, one step at a time, rather than by `off`: `off` jumps four
  // per day, and a ring four long (two concepts plus the newest one's double weight) then
  // started in the same place every single day, which is the starvation this is here to stop.
  const start = (((dayNo(today) + round) % total) + total) % total;
  for (let i = start; out.length < n && i < start + total * 64; i++) {
    // Walk the weighted ring: with two concepts this gives newest, newest, older, newest…
    let k = i % total, pick = 0;
    for (let j = 0; j < order.length; j++) { if (k < weights[j]) { pick = j; break; } k -= weights[j]; }
    const id = order[pick];
    const bank = banks[id];
    const used = taken[id] ?? 0;
    if (used >= bank.length) {
      // This concept is exhausted for tonight; stop if every concept is.
      if (order.every(x => (taken[x] ?? 0) >= (banks[x]?.length ?? 0))) break;
      continue;
    }
    taken[id] = used + 1;
    out.push(bank[(off + used) % bank.length]);
  }
  return out;
}

/** Spreads `drills` through `cards`, returning the ids in sitting order.
 *
 *  Never first — a sitting opens on a card, because that is what the student came for — and
 *  never two in a row. Beyond that they sit as evenly as the arithmetic allows, so the
 *  grammar arrives as punctuation rather than as a block in the middle. */
export function interleave(cards: string[], drills: string[]): string[] {
  if (!drills.length) return [...cards];
  if (!cards.length) return [...drills];
  const out: string[] = [];
  const gap = (cards.length + 1) / (drills.length + 1);
  // Positions counted in CARDS already laid down, clamped to at least one and to one apart.
  const at: number[] = [];
  for (let i = 1; i <= drills.length; i++) {
    at.push(Math.max(i, Math.min(cards.length, Math.round(i * gap))));
  }
  let d = 0;
  for (let i = 0; i < cards.length; i++) {
    out.push(cards[i]);
    while (d < drills.length && at[d] === i + 1) out.push(drills[d++]);
  }
  while (d < drills.length) out.push(drills[d++]);   // more drills than room for them
  return out;
}

/** Ids of interleaved exercises carry this, so a review queue can hold both without the
 *  deck and the grammar bank having to agree about id shapes. */
export const DRILL_PREFIX = 'gx:';
export const drillId = (i: number): string => DRILL_PREFIX + i;
export const isDrillId = (id: string): boolean => id.startsWith(DRILL_PREFIX);
/** The index a drill id points at, or -1 if it is not one. */
export const drillIndex = (id: string): number => {
  if (!isDrillId(id)) return -1;
  const n = Number(id.slice(DRILL_PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : -1;
};

/* ---------- answer checking ---------- */

/** Typed answers are compared with their ACCENTS INTACT, which is why this does not go
 *  through utils.norm: norm folds "mangé" onto "mange", and the difference between those
 *  two is the whole of what a passé composé exercise is asking about. Everything a phone
 *  keyboard decides for itself — case, the shape of the apostrophe, a trailing full stop,
 *  doubled spaces — is forgiven. */
function tidy(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    // Ligatures are letters, not decoration, and almost no keyboard has them: a learner who
    // types "coeur" for « cœur » has spelled it. utils.norm folds these for the same reason.
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[’`´ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,!?;:«»"]+|[\s.,!?;:«»"]+$/g, '');
}

/** The letters with the accents taken off — except those the language counts as letters in
 *  their own right, which are protected so that « ano » can never be read as a near miss for
 *  « año ». */
function bare(s: string, distinct: string[]): string {
  let t = tidy(s);
  const keep = distinct.map(c => c.toLowerCase()).filter(Boolean);
  // Park the protected letters where NFD cannot reach them, then put them back.
  keep.forEach((ch, i) => { t = t.split(ch).join('\u0001' + i + '\u0001'); });
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  keep.forEach((ch, i) => { t = t.split('\u0001' + i + '\u0001').join(ch); });
  return t;
}

/** 'right', 'accent' (the letters are there and only the accents are wrong) or 'wrong'.
 *
 *  The middle answer exists because telling a learner that « j'ai mange » is simply wrong
 *  teaches them nothing, and marking it right teaches them something false. WHERE that line
 *  falls is a fact about the language rather than about this function, so it is read off the
 *  pack: which letters are not accents at all (Spanish ñ), and which pairs are two different
 *  words that merely look alike undressed (lang/types AnswerRules). */
export function checkAnswer(given: string, answer: string, lang?: string): 'right' | 'accent' | 'wrong' {
  const g = tidy(given), a = tidy(answer);
  if (!g) return 'wrong';
  if (g === a) return 'right';
  const rules = pack(lang).answers;
  if (bare(g, rules.distinct) !== bare(answer, rules.distinct)) return 'wrong';
  const pair = [g, a].sort().join('\u0001');
  return rules.homophones.some(([x, y]) => [tidy(x), tidy(y)].sort().join('\u0001') === pair)
    ? 'wrong' : 'accent';
}
