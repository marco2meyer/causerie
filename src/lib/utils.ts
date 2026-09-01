import { irregularForms } from './irregular';
export const uid = (p = 'x'): string => p + Math.random().toString(36).slice(2, 9);

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** Set by the language pack (src/lang) so dates follow the UI language. */
let dateLocale = 'fr-FR';
export const setDateLocale = (l: string): void => { dateLocale = l; };

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return iso;
  }
}

/** "12 août" — the day a card or a scene came from. La Troupe puts provenance on
 *  everything (a card is what you failed to say on a particular morning), and a
 *  two-digit year in that sentence reads like an invoice. */
export function fmtDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' });
  } catch {
    return iso;
  }
}

/** "août" — the month a grid of days belongs to. */
export function fmtMonth(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString(dateLocale, { month: 'long' });
  } catch {
    return iso.slice(0, 7);
  }
}

export function fmtDur(sec: number): string {
  const s = Math.round(sec || 0);
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

/** Accent/case/punctuation-insensitive normalization for fuzzy label matching. */
export function norm(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    // Ligatures are letters, not punctuation. NFD leaves them whole and the strip below
    // then turned them into a space, so "cœur", "sœur", "œuf" and "l'œil" normalised to
    // fragments and could never match anything a learner said.
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words of a string, normalized (accent/case/punctuation-insensitive). */
export function words(s: string | null | undefined): string[] {
  return norm(s).split(' ').filter(Boolean);
}

/** Do two words share a stem? Inflection-tolerant matching for a language app: "contester"
 *  and "contesté" are the same word, "voir" and "voiture" are not. Both are normalized
 *  first, then a long common prefix decides — with a length guard, because without it every
 *  short word is a prefix of some unrelated longer one.
 *
 *  Deliberately not a stemmer: a real one needs a per-language rule set, and everything that
 *  reads this (hint leaks, spoken-word detection) only ever asks "is this the same word the
 *  learner was meant to produce", where a prefix of that length is answer enough. */
export function stemsMatch(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = Math.min(x.length, y.length);
  const long = Math.max(x.length, y.length);
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  /** The shorter word IS the beginning of the longer one. This is the whole distinction
   *  between an inflection and a coincidence: "travailler" starts "travaillerais", while
   *  "voir" does not start "voiture" — it only shares three letters with it. */
  const whole = i === short;
  // A plural or a feminine hung on a short word: vie/vies, ami/amie, son/sons. Short words
  // are otherwise left alone, because everything is a prefix of something at three letters.
  if (whole && short >= 3 && long - short <= 1) return true;
  if (short < 4) return false;
  // Stem plus ending, which is what a conjugation looks like. Five characters of ending
  // covers what a French infinitive can grow: travailler → travaille, travaillons,
  // travaillerais, travailleraient. It is bounded, and it is bounded on the WHOLE shorter
  // word, so "porte" cannot reach "portugais" (their shared prefix stops at "port").
  if (whole && short >= 5 && long - short <= 5) return true;
  if (long - short > 2) return false; // voir / voiture is not one word
  // Three letters is enough once the length guard has already ruled out the long unrelated
  // neighbours: it is what lets "vois" count as "voir". It also lets a rare pair like
  // prix/pris through, which is the cheaper mistake — a word goal that ticks when it should
  // not is invisible, one that refuses to tick after the learner said it is not.
  return i >= 3 && i >= short - 2;
}

/** Reflexive pronouns a citation form carries at the front ("se promener"). */
const LEADING_PRONOUNS = new Set(['se', 's', 'me', 'te', 'nous', 'vous', 'si']);
/** Articles a dictionary puts in front of a noun ("les ongles", "la cuisine"). */
const LEADING_ARTICLES = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du']);
/** Prepositions a verb governs, written next to it and spoken anywhere ("convenir à"). */
const EDGE_PREPOSITIONS = new Set(['a', 'de', 'd', 'du', 'des', 'en', 'y', 'au', 'aux']);

const isScaffolding = (w: string): boolean =>
  LEADING_PRONOUNS.has(w) || LEADING_ARTICLES.has(w) || EDGE_PREPOSITIONS.has(w);

/** The phrase with its grammatical scaffolding taken off the ends. Empty when nothing but
 *  scaffolding is left — that is the signal to ignore it rather than match on "à". */
export function goalCore(phrase: string): string[] {
  let w = words(phrase);
  if (w.length > 1 && (LEADING_PRONOUNS.has(w[0]) || LEADING_ARTICLES.has(w[0]))) w = w.slice(1);
  while (w.length > 1 && EDGE_PREPOSITIONS.has(w[0])) w = w.slice(1);
  while (w.length > 1 && EDGE_PREPOSITIONS.has(w[w.length - 1])) w = w.slice(0, -1);
  return w.length === 1 && isScaffolding(w[0]) ? [] : w;
}

/** How many words of the sentence may sit between the words of the phrase being looked
 *  for. Nobody says "se concentrer sur" with nothing in the middle: they say "je me
 *  concentre BEAUCOUP sur la réunion", and a verb is routinely separated from the
 *  preposition it governs by an adverb or an object. Requiring the words to be adjacent
 *  meant the phrase could only tick when it was recited rather than used.
 *
 *  Two, and counted across the whole phrase rather than per gap, so the span stays short
 *  enough that three words scattered through a sentence do not add up to a match. */
const MAX_SKIPPED = 2;

/** Is `said` the word `target` asks for? The stem rule first, and then the short list of
 *  words in this language whose forms do not look like the word (lib/irregular): no prefix
 *  rule connects "aller" to "vais" or "be" to "was", so those are simply listed.
 *
 *  Directional on purpose. `target` is the word the deck is asking for — a citation form —
 *  and `said` is whatever the learner produced, so the table is only ever consulted one
 *  way round. Without a language nothing is looked up and the stem rule stands alone. */
export function sameWord(said: string, target: string, lang?: string): boolean {
  return stemsMatch(said, target) || irregularForms(target, lang).includes(norm(said));
}

/** Does `text` contain `phrase` as spoken language: same words, in order, inflection
 *  tolerated, a couple of words allowed in between, and — given a language — the forms
 *  that inflection alone never explains. */
export function saysWord(text: string, phrase: string, lang?: string): boolean {
  const hay = words(text);
  const needle = words(phrase);
  if (!hay.length || !needle.length) return false;
  for (let i = 0; i < hay.length; i++) {
    if (!sameWord(hay[i], needle[0], lang)) continue;
    let k = 1, j = i + 1, skipped = 0;
    while (k < needle.length && j < hay.length) {
      if (sameWord(hay[j], needle[k], lang)) k++;
      else if (++skipped > MAX_SKIPPED) break;
      j++;
    }
    if (k === needle.length) return true;
  }
  return false;
}

export function download(name: string, text: string): void {
  const b = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export const deepClone = <T>(x: T): T =>
  typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x));

/** Word-level diff (LCS): the words of `after` that differ from `before`, for the
 *  recast-noticing exercise ("what did Odile change?").
 *
 *  Both sides are coerced rather than trusted. This runs inside the debrief's render, over
 *  a correction that came out of a model and has been sitting in the memory ever since, and
 *  a `.split` of undefined there does not lose a diff — it throws out of render and takes
 *  the whole screen with it, which is how one malformed correction turned a conversation's
 *  analysis into a blank page. A missing side is an empty sentence: the panel shows what it
 *  has. */
export function changedWords(before: string | null | undefined, after: string | null | undefined): { w: string; ch: boolean }[] {
  const a = String(before ?? '').split(/\s+/).filter(Boolean);
  const b = String(after ?? '').split(/\s+/).filter(Boolean);
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = norm(a[i]) === norm(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { w: string; ch: boolean }[] = [];
  let i = 0, j = 0;
  while (j < n) {
    if (i < m && norm(a[i]) === norm(b[j])) { out.push({ w: b[j], ch: false }); i++; j++; }
    else if (i < m && dp[i + 1][j] >= dp[i][j + 1]) i++;
    else { out.push({ w: b[j], ch: true }); j++; }
  }
  return out;
}
