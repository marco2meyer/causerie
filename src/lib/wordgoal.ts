import type { Card, Deck, Memory, WordGoal } from '../types';
import { MATURE_DAYS } from './srs';
import { goalCore, norm, saysWord, words } from './utils';

// Re-exported: the stripping rule lives in lib/utils beside the other spoken-language
// matchers, because the deck now asks the same question of a card (see srs conceptKey).
export { goalCore };

/** Active-vocabulary push: one or two words a call asks the learner to actually SAY.
 *
 *  A deck teaches recall on a schedule the learner never chose; a conversation is where a
 *  word stops being an answer and becomes theirs. Between the two sits the gap this closes:
 *  words the deck says are known, and every transcript says are never used. Odile is told to
 *  build an opening for the word rather than to say it herself, and the screen shows the
 *  word until it is placed.
 *
 *  Deliberately rare — twice in ten minutes at most. A conversation that is really a
 *  vocabulary drill is no longer a conversation, and the point of the call is the talking. */

/** Goals a call of this length carries. Ten minutes gets two, anything shorter one. */
export function goalCount(minutes: number): number {
  return minutes >= 8 ? 2 : 1;
}

/** Fractions of the call at which each goal appears. Late enough that the conversation is
 *  running, early enough that there is room to place the word before the goodbyes. */
export const GOAL_AT = [0.3, 0.62];

/** How many recent calls' goals stay off the list, so the same word is not pushed twice
 *  running while the deck still has other candidates. */
export const GOAL_COOLDOWN_CALLS = 8;

/** The target-language side of a card, when it has one worth saying out loud. */
function targetSide(c: Card): { word: string; gloss: string } | null {
  if (c.type === 'de2fr') return { word: c.back, gloss: c.front };
  if (c.type === 'fr2de') return { word: c.front, gloss: c.back };
  if (c.type === 'cloze' && c.front.includes('___')) return { word: c.back, gloss: c.hint ?? '' };
  return null;
}

/** A word worth pushing: sayable, not a bare function word, not a whole sentence. */
function usable(word: string): boolean {
  const w = words(word);
  return w.length >= 1 && w.length <= 3 && norm(word).replace(/ /g, '').length >= 4;
}

/** Does the deck make this learner PRODUCE this word anywhere (as opposed to recognize it)? */
function hasProduction(deck: Deck, word: string): boolean {
  const n = norm(word);
  return deck.cards.some(c => (c.type === 'de2fr' || c.type === 'cloze') && norm(c.back) === n);
}

type Candidate = WordGoal & { score: number };

/** Every word the memory can offer, scored by how badly it is missing from active use.
 *  The order of the reasons is the whole argument: a word the learner recognizes but has
 *  never had to produce is the biggest gap, one they keep failing to produce is next, and a
 *  word already mature in the production direction is barely worth a push at all. */
export function goalCandidates(mem: Pick<Memory, 'deck' | 'vocab'>): WordGoal[] {
  const out = new Map<string, Candidate>();
  const offer = (c: Candidate) => {
    const key = norm(c.word);
    if (!key) return;
    const prev = out.get(key);
    if (!prev || c.score > prev.score) out.set(key, c);
  };

  for (const card of mem.deck?.cards ?? []) {
    const side = targetSide(card);
    if (!side || !usable(side.word)) continue;
    const base = { word: side.word.trim(), gloss: side.gloss.trim(), cardId: card.id };
    if (card.type === 'fr2de') {
      // Reading it is the half they already have; nothing in the deck asks for the other.
      if (hasProduction(mem.deck, side.word)) continue;
      offer({ ...base, why: 'passive', score: 6 });
      continue;
    }
    if (card.lapses > 0) { offer({ ...base, why: 'lapsed', score: 5 + Math.min(2, card.lapses) }); continue; }
    if (card.state === 'new') { offer({ ...base, why: 'unused', score: 4 }); continue; }
    // Mature in the deck means recalled on a schedule, which is still not the same as used.
    offer({ ...base, why: 'unused', score: card.interval >= MATURE_DAYS ? 1 : 3 });
  }

  for (const v of mem.vocab ?? []) {
    if (!usable(v.fr)) continue;
    if (out.has(norm(v.fr))) continue;
    offer({ word: v.fr.trim(), gloss: (v.de ?? '').trim(), why: 'fresh', score: 2 });
  }

  return [...out.values()]
    .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
    .map(({ score, ...g }) => g);
}

/** Words pushed in the recent calls, which sit out this one. */
export function recentGoalWords(mem: Pick<Memory, 'sessions'>, calls = GOAL_COOLDOWN_CALLS): Set<string> {
  const recent = (mem.sessions ?? []).filter(s => s.wordGoals?.length).slice(-calls);
  return new Set(recent.flatMap(s => (s.wordGoals ?? []).map(g => norm(g.word))));
}

/** The goals for one call: the highest-scoring candidates that are not on cooldown. */
export function pickWordGoals(mem: Pick<Memory, 'deck' | 'vocab' | 'sessions'>, n: number): WordGoal[] {
  if (n <= 0) return [];
  const skip = recentGoalWords(mem);
  const all = goalCandidates(mem);
  const fresh = all.filter(g => !skip.has(norm(g.word)));
  // Cooldown yields to an empty list: a small deck would otherwise stop offering anything.
  return (fresh.length >= n ? fresh : [...fresh, ...all.filter(g => skip.has(norm(g.word)))]).slice(0, n);
}

/** A goal is a WORD. The card it came from holds a dictionary entry, and the two are not
 *  the same string.
 *
 *  Three calls in a row recorded a miss on a word the learner had just used:
 *    "convenir à"           → "on peut convenir là des convenances à nous"
 *    "les ongles"           → "mes ongles sont très longs"
 *    "pertinent, pertinente" → "c'est un détail pertinent"
 *  A dictionary writes the preposition a verb governs next to it, puts a definite article
 *  in front of a noun, and lists both genders of an adjective separated by a comma. Nobody
 *  speaks any of those. Matching the entry word-for-word meant the learner said the word,
 *  the card stayed grey, and the call was recorded as a miss — which is the one failure
 *  this feature cannot afford, because it is the learner who is told they did not do it.
 *
 *  So a goal is matched against every form the entry could honestly take, most literal
 *  first. The scaffolding comes off the ENDS only, and never all of it: "à cet égard" keeps
 *  "cet égard", because "avoir des égards pour quelqu'un" is a different expression. */

/** Every form of a goal worth listening for. A card front that lists alternatives — both
 *  genders, two spellings — is several goals wearing one label, and any of them counts. */
export function goalForms(phrase: string): string[] {
  const out: string[] = [];
  const add = (w: string[]) => {
    const s = w.join(' ');
    if (s && !out.includes(s)) out.push(s);
  };
  for (const alt of (phrase || '').split(/[,;/]|\bou\b/)) {
    const w = words(alt);
    if (!w.length) continue;
    add(w);
    add(goalCore(alt));
  }
  return out;
}

/** Did the learner place the word? Inflection counts, the grammar a citation form carries
 *  counts, and with a language so do the forms no stem rule could reach ("aller" ticks on
 *  "je vais") — the point is using the word, not reciting the deck's entry for it. */
export function goalPlaced(spoken: string, goal: Pick<WordGoal, 'word'>, lang?: string): boolean {
  return goalForms(goal.word).some(f => saysWord(spoken, f, lang));
}
