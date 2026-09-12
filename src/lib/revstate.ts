import type { Grade, GrammarDrill } from '../types';
import { activeProfile } from './profiles';
import { drillId, isDrillId } from './grammar';
import { todayISO } from './utils';

/** Mid-session persistence for the review session: a reload (train transfer, tab
 *  discarded on iOS) must not cost the visible progress, XP or streak credit. The
 *  card SCHEDULING already persists per grade; this keeps the session itself. */

export interface RevState {
  queue: string[];
  seen: number;
  stats: Record<Grade, number>;
  initialLen: number;
  /** Distinct card ids graded at least once (the honest "cards done" count). */
  graded: string[];
  /** Seconds spent before the last save, so the log's duration survives the reload. */
  elapsed: number;
  date: string;
  /** The grammar exercises interleaved into this sitting, in queue order. They exist only
   *  for the sitting — there is no deck to look them up in — so the saved session has to
   *  carry them or a reload drops them out of a queue that still holds their ids. */
  drills?: GrammarDrill[];
  /** What those exercises showed, banked until the sitting ends and writes them to the
   *  concepts they belong to. */
  drillLog?: { topic: string; right: boolean }[];
}

const key = () => 'causerie.revstate:' + (activeProfile()?.id ?? 'solo');

export function saveRevState(s: RevState): void {
  try { localStorage.setItem(key(), JSON.stringify(s)); } catch { /* storage full: session still works */ }
}

/** The saved session, if it is from today and its cards still exist. */
export function loadRevState(existingIds: Set<string>): RevState | null {
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return null;
    const s = JSON.parse(raw) as RevState;
    if (s.date !== todayISO() || !Array.isArray(s.queue) || s.queue.length === 0) { clearRevState(); return null; }
    // A queue id is either a card, which must still be in the deck, or one of this sitting's
    // own grammar exercises, which live in the saved state rather than in the deck.
    const drills = new Set((s.drills ?? []).map((_, i) => drillId(i)));
    s.queue = s.queue.filter(id => (isDrillId(id) ? drills.has(id) : existingIds.has(id)));
    if (!s.queue.length) { clearRevState(); return null; }
    return s;
  } catch { return null; }
}

/** Cheap probe for the "Resume 3/8" labels, no deck needed. */
export function peekRevState(): { seen: number; initialLen: number } | null {
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return null;
    const s = JSON.parse(raw) as RevState;
    if (s.date !== todayISO() || !s.queue?.length) return null;
    return { seen: s.seen, initialLen: s.initialLen };
  } catch { return null; }
}

export function clearRevState(): void {
  try { localStorage.removeItem(key()); } catch { /* noop */ }
}
