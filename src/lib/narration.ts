import type { Memory } from '../types';
import { grammarOf } from './grammar';
import { todayISO } from './utils';

/** The past-tense narration strand: the 4/3/2 retell, aimed at the past.
 *
 *  Narrating a connected story in the past is a B1 descriptor in its own right (the
 *  competency map has it as f-b1-recit), and nothing in the app forced it: the calls let
 *  the learner live in the present and the futur proche, and the plain retell repeats
 *  whatever tense the conversation happened to use. This strand asks for yesterday, in
 *  the past, once a week.
 *
 *  It is deliberately DOWNSTREAM of the grammar strand: the narration unlocks only when
 *  the past-tense modules have been sat through, because asking a learner to narrate with
 *  tenses nobody has taught them drills the errors in. While a past cell is still being
 *  drilled, the run leans on it — the retell screen shows that concept's fiche lines —
 *  so the week's narration and the evening's exercises pull in the same direction. */

/** The grammar cells that teach narrating the past, per target language. A language
 *  without an entry keeps the strand locked — the grammar courses are French-only for
 *  now, and this list should grow exactly when narration-relevant cells become teachable
 *  in another pack. */
export const NARRATION_CELLS: Record<string, string[]> = {
  fr: ['g-a2-passe-compose', 'g-b1-imparfait-pc']
};

/** Days between narrations: often enough to build the habit, rare enough that the day
 *  screen is not one card heavier every single day. */
export const NARRATION_EVERY = 7;

const dayNo = (iso: string): number => Math.floor(Date.parse(iso + 'T12:00:00Z') / 86400000);

/** Has the learner sat through the modules the narration exists to exercise? Taught,
 *  redone or marked known by hand all count — mastery does not have to have settled,
 *  because the narration IS part of the practice that settles it. */
export function narrationUnlocked(mem: Memory): boolean {
  const cells = NARRATION_CELLS[mem.profile.target] ?? [];
  if (!cells.length) return false;
  const topics = grammarOf(mem).topics;
  return cells.every(id => {
    const t = topics[id];
    return !!t && !!(t.courseAt || t.redoneAt || t.manual || t.masteredAt);
  });
}

/** The past cell to coach THIS run with: one still being drilled if there is one (newest
 *  teaching first — it is what the evenings are asking about), else the last of the list,
 *  which is the most advanced thing the learner has been taught about the past. */
export function narrationCoachCell(mem: Memory): string | null {
  const cells = NARRATION_CELLS[mem.profile.target] ?? [];
  if (!cells.length) return null;
  const topics = grammarOf(mem).topics;
  const open = cells.filter(id => topics[id] && !topics[id].masteredAt && !topics[id].manual);
  return open.length ? open[open.length - 1] : cells[cells.length - 1];
}

/** Date of the last past-tense run, or null if there has never been one. */
export function lastNarration(mem: Memory): string | null {
  const runs = mem.fluency ?? [];
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].past) return runs[i].date;
  }
  return null;
}

/** Is the weekly narration owed today? Only ever true once the strand is unlocked. */
export function narrationDue(mem: Memory, today = todayISO()): boolean {
  if (!narrationUnlocked(mem)) return false;
  const last = lastNarration(mem);
  return !last || dayNo(today) - dayNo(last) >= NARRATION_EVERY;
}
