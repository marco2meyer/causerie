import type { Memory } from '../types';
import { pack, PACKS } from '../lang';
import type { Topic } from '../lang/types';
import { band, BANDS } from './cefr';
import { norm } from './utils';

/** Topic catalogues live in the language packs; this module stays abstract. */

export type { Topic };

/* Back-compat (seed, tests): the French catalogues under their historic names. */
export const TOPICS: Topic[] = PACKS.fr.topics;
export const INTRO_TOPICS = PACKS.fr.introTopics;

/** The fixed agenda for the three getting-to-know-you calls, per target language. */
export const introTopics = (lang?: string) => pack(lang).introTopics;

export interface TopicSuggestion {
  t: string;
  fr?: string;
  lv: string;
  tags: string[];
  why: string;
  kind: 'interest' | 'level' | 'fresh';
  /** Why THIS learner, in their own language. Only generated proposals carry one; the
   *  catalogue has nothing personal to say and says nothing. */
  note?: string;
}

/** How far back the fallback looks before it will offer a subject again. Two was the old
 *  value, which is fewer than the number of eligible topics, so a learner with a handful of
 *  interests met the same three in rotation and never ran out of nothing to say. */
export const REPEAT_WINDOW = 12;

/** Odile's daily proposal list: interests first (skipping recent call topics), then
 *  level-appropriate library topics. suggestions[0] is the default proposal. */
export function suggestTopics(mem: Memory): TopicSuggestion[] {
  // A wide window is right until it empties the shelf: the top bands hold as few as three
  // eligible topics per language, and twelve calls would strike all of them out, leaving
  // the shuffle button inert on exactly the offline day the fallback exists for. So the
  // window is relaxed until something survives, rather than being held on principle.
  for (const w of [REPEAT_WINDOW, 4, 2, 0]) {
    const out = suggestWithin(mem, w);
    if (out.length) return out;
  }
  return [];
}

function suggestWithin(mem: Memory, window: number): TopicSuggestion[] {
  const bd = band(mem.cefr.overall);
  const bandN = BANDS.indexOf(bd);
  // Imported Duolingo rows are not conversations and must not use up the window.
  const recent = (mem.sessions ?? []).filter(s => s.source === 'causerie')
    .slice(-window).map(s => norm(s.topic));
  const out: TopicSuggestion[] = [];

  const day = Math.floor(Date.now() / 86400000);
  const ints = (mem.interests ?? []).slice().sort((a, b) => b.weight - a.weight);
  const rotated = ints.length ? [...ints.slice(day % ints.length), ...ints.slice(0, day % ints.length)] : [];
  for (const i of rotated) {
    if (recent.includes(norm(i.label))) continue;
    out.push({ t: i.label, lv: bd, tags: [], why: 'interest', kind: 'interest' });
  }

  for (const t of pack(mem.profile.target).topics) {
    if (Math.abs(BANDS.indexOf(t.lv) - bandN) > 1) continue;
    if (recent.includes(norm(t.t))) continue;
    out.push({ t: t.t, fr: t.fr, lv: t.lv, tags: t.tags, why: 'level', kind: 'level' });
  }
  return out;
}
