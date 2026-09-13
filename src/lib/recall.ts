import type { Analysis, Correction, Memory, SessionRecord } from '../types';
import { norm, todayISO } from './utils';

/** The two minutes before the day's subject.
 *
 *  A call used to open on the topic of the day and the previous conversation was never
 *  mentioned again except as one line in the briefing's list of past calls — a line she was
 *  told to reference "de temps en temps, sans en faire toute une histoire", which in
 *  practice meant never. Everything the last call produced went into the deck instead, to
 *  be met again as a card, silently, hours later or not at all. The one thing a spaced
 *  repetition schedule is worst at is the thing a tutor is best at: asking for it out loud,
 *  the next morning, in a sentence, and hearing whether it comes.
 *
 *  So the call now opens on yesterday. She says what it was about and asks one to three
 *  short questions off the material that call actually produced — a word, a form, a turn of
 *  phrase — then moves on. Two minutes, added to the call rather than taken out of it.
 *
 *  Nothing here is generated: every question is built from the previous session's own
 *  analysis, which already holds the words that came up (`new_vocab`), the mistakes worth
 *  making a card of (`corrections`, gap and answer included) and what he got right
 *  (`highlights`). A call with no analysis — an import, a failed pass — still gets an
 *  opening, just an open question about the subject instead of three specific ones. */

/** Minutes the reprise adds to a call. Long enough for three questions and an answer
 *  apiece, short enough that the day's subject still gets its full time. */
export const RECALL_MINUTES = 2;

/** Three is already at the edge: past that the opening reads as a test rather than as two
 *  people picking a conversation back up. */
export const MAX_RECALL_QUESTIONS = 3;

export type RecallKind = 'vocab' | 'grammar' | 'phrase';

export interface RecallQuestion {
  kind: RecallKind;
  /** What she has to get out of him: a word, a gapped sentence, a turn of phrase. */
  item: string;
  /** The form that counts as right — what goes in the gap, or the item itself. */
  answer: string;
  /** Native-language cue, for the moment he dries up. Never the answer in disguise: the
   *  analysis is already forbidden from putting the answer's stem in a hint. */
  gloss?: string;
  /** The sentence it came up in last time — her way into it. */
  example?: string;
  /** What he actually said. In the briefing so she recognises it, never to be spoken. */
  wrong?: string;
  /** The analysis's own one-line reason, in the target language. */
  note?: string;
}

export interface Recall {
  /** The call being recalled. */
  id: string;
  date: string;
  /** Whole days between that call and today, for the phrasing ("hier", "il y a 4 jours"). */
  days: number;
  topic: string;
  /** What that call was about, off the analysis's own list. Preferred over `gist`. */
  topics: string[];
  /** Fallback for a call with no analysis: the stored summary, trimmed. */
  gist: string;
  questions: RecallQuestion[];
}

/** Strings the block is written from, in the target language (see lang/types TutorPack). */
export interface RecallLabels {
  ago: (days: number) => string;
  /** Introduces the list of subjects, e.g. "Thèmes : ". Same wording the session record
   *  uses, so the reprise reads like the debrief the student already saw. */
  themes: string;
  block: (a: { when: string; topic: string; gist: string; questions: string[] }) => string;
  ask: {
    vocab: (q: RecallQuestion) => string;
    grammar: (q: RecallQuestion) => string;
    phrase: (q: RecallQuestion) => string;
  };
  nothing: string;
}

/** Past this the summary stops being a reminder and becomes a paragraph she reads out. */
const GIST_MAX = 200;

/** Enough to place the conversation, not enough to be a table of contents. */
const MAX_TOPICS = 4;

const clean = (s: string | null | undefined): string => String(s ?? '').replace(/\s+/g, ' ').trim();

/** A quoted sentence keeps its own full stop and then takes the sentence's as well —
 *  « … sur l'étagère. ». — so the one it came with goes. */
const unstop = (s: string): string => s.replace(/\s*[.!?]+$/, '');

/** The stored summary, for a call that has no analysis to take subjects off.
 *
 *  Only ever a fallback, and deliberately so: the summary is written TO THE STUDENT — it
 *  carries `hauptpunkt` ("Tu peux décrire une maison avec beaucoup de détails") and the
 *  homework line after it. Dropped into a briefing addressed to the tutor, the second
 *  person changes who it is about, and she reads an instruction to him as an instruction
 *  to her. `analysis.topics` is the same call described in noun phrases, and is used
 *  instead wherever it exists. */
function gistOf(s: SessionRecord): string {
  const full = clean(s.summary);
  if (full.length <= GIST_MAX) return full;
  const cut = full.slice(0, GIST_MAX);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('… '), cut.lastIndexOf('; '));
  return (stop > 60 ? cut.slice(0, stop + 1) : cut.replace(/\s\S*$/, '') + '…').trim();
}

/** Whole days between two ISO dates, read as calendar days rather than as instants: two
 *  calls an hour apart either side of midnight are a day apart, which is how he will
 *  remember them. */
function daysBetween(from: string, to: string): number {
  const day = (iso: string) => Date.parse(String(iso).slice(0, 10) + 'T00:00:00Z');
  const d = (day(to) - day(from)) / 86_400_000;
  return Number.isFinite(d) ? Math.max(0, Math.round(d)) : 0;
}

/** The call to pick back up: the most recent one that had something in it. Conversations
 *  from before a handover belong to the previous tutor and are never referenced again —
 *  the same rule the briefing's list of past calls follows. */
export function lastCall(mem: Memory, today = todayISO()): SessionRecord | null {
  const after = mem.handover?.date;
  const list = (mem.sessions ?? []).filter(s =>
    s && s.date <= today && (!after || s.date >= after) && (clean(s.topic) || clean(s.summary)));
  return list.length ? list[list.length - 1] : null;
}

/** A word he is being asked to place TODAY is not a word to quiz him on first: the goal
 *  card would be sitting on the screen with the answer on it. */
const skipSet = (words: string[] | undefined): Set<string> =>
  new Set((words ?? []).map(w => norm(w)).filter(Boolean));

/** Two questions are the same question when one contains the other, not only when they
 *  match: the vocabulary question is a bare word and a later candidate is the whole
 *  sentence it sits in, so comparing them whole never collides.
 *
 *  Containment counts only from four characters up. Below that the shorter string is a
 *  function word — "en", "y", "une" — that turns up inside half the sentences in the call
 *  and would rule them all out. */
function overlaps(item: string, used: Set<string>): boolean {
  const a = norm(item);
  if (!a) return true;
  for (const b of used) {
    if (!b) continue;
    if (a === b) return true;
    const short = a.length < b.length ? a : b;
    if (short.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  }
  return false;
}

function vocabQuestion(an: Analysis, skip: Set<string>): RecallQuestion | null {
  for (const v of an.new_vocab ?? []) {
    const item = clean(v?.fr);
    if (!item || skip.has(norm(item))) continue;
    return { kind: 'vocab', item, answer: item, gloss: clean(v?.de) || undefined, example: unstop(clean(v?.ex)) || undefined };
  }
  return null;
}

/** Corrections worth asking again, in the order they are worth asking: one that touches a
 *  weakness the memory still has open comes before one that does not, because that is the
 *  one the app is already trying to close. */
function rankedCorrections(mem: Memory, an: Analysis, cats: Correction['category'][]): Correction[] {
  const open = (mem.weaknesses ?? []).filter(w => w.status !== 'resolved').map(w => norm(w.label)).filter(Boolean);
  // Substring either way, but only on something long enough to mean anything: a topic
  // normalised down to "a" is inside every weakness label there has ever been.
  const touches = (c: Correction) => {
    const t = norm(c.cefr_topic);
    return t.length >= 4 && open.some(w => w.includes(t) || (w.length >= 4 && t.includes(w)));
  };
  return (an.corrections ?? [])
    .filter(c => c && cats.includes(c.category) && (clean(c.cloze_text) || clean(c.besser)))
    .map((c, i) => ({ c, i, hit: touches(c) }))
    .sort((a, b) => Number(b.hit) - Number(a.hit) || a.i - b.i)
    .map(x => x.c);
}

function grammarQuestion(mem: Memory, an: Analysis, used: Set<string>): RecallQuestion | null {
  for (const c of rankedCorrections(mem, an, ['grammar'])) {
    const gap = clean(c.cloze_text);
    // A gapped sentence keeps its full stop — it is being completed, not quoted inside
    // another sentence. A bare corrected phrase is quoted, so it loses its.
    const item = gap.includes('___') ? gap : unstop(clean(c.besser));
    if (!item || overlaps(item, used)) continue;
    return {
      kind: 'grammar',
      item,
      answer: clean(c.cloze_answer) || unstop(clean(c.besser)),
      gloss: clean(c.hint) || undefined,
      wrong: unstop(clean(c.original)) || undefined,
      note: clean(c.erklaerung) || undefined
    };
  }
  return null;
}

/** A turn of phrase: a phrasing he got wrong and was given a better one for, or one he
 *  pitched wrong for the situation; failing both, something he actually said well, which is
 *  worth hearing a second time in a sentence of his own.
 *
 *  `vocab` corrections are NOT in that list, though they look like candidates. The analysis
 *  double-books a code-switch on purpose — "correct it with category vocab, and ALSO add it
 *  to new_vocab" — so every one of them is already the vocabulary question, and taking it
 *  again spent two of three questions on one word ("lave-vaisselle" twice in the same
 *  opening). Their shape is wrong here too: `original` is the bare English word and
 *  `besser` is the whole repaired sentence, which pairs up as « il avait dit
 *  "mother-in-law" là où on dit "Ma belle-mère joue avec Eva" ». */
function phraseQuestion(mem: Memory, an: Analysis, used: Set<string>): RecallQuestion | null {
  for (const c of rankedCorrections(mem, an, ['phrase', 'register'])) {
    const item = unstop(clean(c.besser));
    if (!item || overlaps(item, used)) continue;
    return {
      kind: 'phrase', item, answer: item,
      wrong: unstop(clean(c.original)) || undefined,
      note: clean(c.erklaerung) || undefined
    };
  }
  for (const h of an.highlights ?? []) {
    const item = unstop(clean(h?.quote));
    if (!item || overlaps(item, used)) continue;
    // `kommentar` stays out. It is praise written TO HIM in the second person — "Tu
    // organises la description avec des repères de lieu clairs" — and in a briefing
    // addressed to the tutor that sentence lands on her instead. It tells her nothing
    // the quote has not already told her.
    return { kind: 'phrase', item, answer: item };
  }
  return null;
}

/**
 * What she opens the call with, or null when there is no previous call to open on — the
 * very first conversation, and the first one after a handover.
 *
 * @param skip  words the day's own goals already ask him to place.
 */
export function recall(mem: Memory, opts: { today?: string; skip?: string[] } = {}): Recall | null {
  const today = opts.today ?? todayISO();
  const prev = lastCall(mem, today);
  if (!prev) return null;
  const an = prev.analysis ?? null;
  const questions: RecallQuestion[] = [];
  if (an) {
    const skip = skipSet(opts.skip);
    const used = new Set<string>();
    const take = (q: RecallQuestion | null) => {
      if (!q || questions.length >= MAX_RECALL_QUESTIONS) return;
      questions.push(q);
      used.add(norm(q.item));
    };
    // Word, then form, then turn of phrase: the order they were learnt in, and the order
    // that lets the first question be the easy one.
    take(vocabQuestion(an, skip));
    take(grammarQuestion(mem, an, used));
    take(phraseQuestion(mem, an, used));
  }
  return {
    id: prev.id,
    date: prev.date,
    days: daysBetween(prev.date, today),
    topic: clean(prev.topic),
    topics: (an?.topics ?? []).map(clean).filter(Boolean).slice(0, MAX_TOPICS),
    gist: gistOf(prev),
    questions
  };
}

/** The reprise as the briefing reads it. `labels` comes from the pack, so a Portuguese
 *  profile gets a Portuguese block. */
export function recallText(r: Recall, labels: RecallLabels): string {
  const lines = r.questions.map(q => labels.ask[q.kind](q));
  return labels.block({
    when: labels.ago(r.days),
    topic: r.topic,
    // The subjects the analysis listed, phrased the way the debrief phrased them. Only a
    // call with no analysis falls back to the summary — see gistOf for why that is a
    // fallback and not the first choice.
    gist: r.topics.length ? labels.themes + r.topics.join(', ') + '.' : r.gist,
    questions: lines.length ? lines : [labels.nothing]
  });
}
