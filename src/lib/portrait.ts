import type { Fact, FactCategory, Memory } from '../types';

/** Who the student IS, as opposed to eight things they happened to mention.
 *
 *  The briefing used to hand the tutor the last eight facts in flat chronological order.
 *  Nothing in that list said which of them mattered: "Marco enseigne la philosophie" and
 *  "Marco a mangé une mauvaise tarte mardi" arrived as equals, so she treated them as
 *  equals — asking after the tarte and forgetting the philosophy. What she needs first is
 *  a portrait: the handful of things that are true about him every week, sorted so they
 *  read as a person. The incidental ones are still worth having, but as garnish, and
 *  never all at once.
 *
 *  The signal separating the two is already in the data. A fact the analysis has seen on
 *  more than one day has been confirmed by use; a fact recorded once and never again was
 *  an aside. No new field, no model call, no guesswork. */

/** Reading order of the basics: what he does, who he is to other people, where he is,
 *  then the softer things. A portrait that opened on "aime les tartes" would be a list
 *  again. */
export const CAT_ORDER: FactCategory[] = ['arbeit', 'familie', 'orte', 'alltag', 'vorlieben', 'sonstiges'];

/** At most this many basics per category, so one talkative category cannot crowd out
 *  the rest of the person. */
const PER_CAT = 2;
/** …and this many in total. Past about seven lines the tutor stops treating it as a
 *  portrait and starts treating it as a list to work through. */
const MAX_BASICS = 7;
/** Incidental facts offered per call. Deliberately few: the brief says at most one of
 *  them should ever surface, and offering twelve invites her to tour them. */
const PASSING = 3;

export interface PortraitGroup { cat: FactCategory; facts: Fact[] }
export interface Portrait {
  /** The settled ones, grouped and ordered. */
  basics: PortraitGroup[];
  /** A rotating few one-offs, different from call to call. */
  passing: Fact[];
}

const day10 = (s: string): string => (s || '').slice(0, 10);

/** True once a fact has come up on more than one day. That is the whole difference
 *  between something the student is and something the student said. */
export const settled = (f: Fact): boolean =>
  !!f.firstSaid && !!f.lastSaid && day10(f.lastSaid) !== day10(f.firstSaid);

/** Oldest first: the things said early and still true are the bedrock of a portrait. */
const byAge = (a: Fact, b: Fact): number => String(a.firstSaid).localeCompare(String(b.firstSaid));

/**
 * @param dayIdx  whole days since the epoch; rotates the incidental facts so two calls in
 *                one day agree with each other and two calls in one week do not.
 */
export function portrait(mem: Memory, dayIdx = Math.floor(Date.now() / 86_400_000)): Portrait {
  const facts = (mem.facts ?? []).filter(f => (f.text || '').trim());
  let anchored = facts.filter(settled);
  // A profile three calls old has nothing confirmed yet, and an empty portrait would be
  // worse than an imperfect one — she would open every call as a stranger. Below the
  // floor, the oldest facts stand in: said early, never contradicted.
  if (anchored.length < 3) {
    const rest = facts.filter(f => !settled(f)).sort(byAge);
    anchored = [...anchored, ...rest].slice(0, Math.max(3, anchored.length));
  }
  const chosen = new Set<string>();
  const basics: PortraitGroup[] = [];
  let n = 0;
  for (const cat of CAT_ORDER) {
    if (n >= MAX_BASICS) break;
    const inCat = anchored.filter(f => f.category === cat).sort(byAge).slice(0, PER_CAT);
    const take = inCat.slice(0, MAX_BASICS - n);
    if (!take.length) continue;
    take.forEach(f => chosen.add(f.id));
    basics.push({ cat, facts: take });
    n += take.length;
  }
  // Everything the portrait did not take, rotated so the same three do not ride along on
  // every call for a month.
  const pool = facts.filter(f => !chosen.has(f.id));
  const passing: Fact[] = [];
  for (let i = 0; passing.length < Math.min(PASSING, pool.length) && i < pool.length; i++) {
    const f = pool[(dayIdx * 5 + i) % pool.length];
    if (!passing.find(x => x.id === f.id)) passing.push(f);
  }
  return { basics, passing };
}

/** The portrait as the briefing reads it, in the target language.
 *  `labels` comes from the pack so a Spanish profile gets Spanish headings. */
export function portraitText(
  p: Portrait,
  labels: { cats: Record<string, string>; basics: string; passing: string; none: string }
): string {
  const lines: string[] = [];
  if (p.basics.length) {
    lines.push(labels.basics);
    for (const g of p.basics) {
      lines.push('- ' + (labels.cats[g.cat] ?? g.cat) + ' : ' + g.facts.map(f => f.text.replace(/\.$/, '')).join(' ; '));
    }
  }
  if (p.passing.length) {
    if (lines.length) lines.push('');
    lines.push(labels.passing);
    p.passing.forEach(f => lines.push('- ' + f.text));
  }
  return lines.join('\n') || labels.none;
}
