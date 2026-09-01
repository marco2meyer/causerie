import { describe, expect, it } from 'vitest';
import type { Card, Deck, Memory, ReviewLogEntry } from '../../src/types';
import { observedSittings, sittingPlan } from '../../src/lib/budget';
import { buildSession } from '../../src/lib/srs';
import { blankMem } from '../../src/lib/storage';

const TODAY = '2026-08-29';
const day = (b: number) => new Date(Date.parse(TODAY + 'T00:00:00Z') - b * 86400000).toISOString().slice(0, 10);

const due = (i: number): Card => ({
  id: 'd' + i, type: 'de2fr', front: 'f' + i, back: 'b' + i, sourceKind: 'vocab',
  createdAt: '2026-08-01', state: 'review', ease: 2.5, interval: 4, reps: 2, lapses: 0, due: '2026-08-20'
});
const fresh = (i: number): Card => ({ ...due(i), id: 'n' + i, state: 'new', reps: 0, due: '2026-08-01' });
const sat = (date: string, n = 1): ReviewLogEntry[] => Array.from({ length: n }, () =>
  ({ date, total: 12, again: 0, hard: 0, good: 12, easy: 0, seconds: 300, xp: 12 }));

function mem(cards: Card[], log: ReviewLogEntry[] = [], over: Partial<Memory['settings']> = {}): Memory {
  const m = blankMem();
  m.deck = { cards, log } as Deck;
  m.settings = { ...m.settings, sessionSize: 18, sessionsPerDay: 2, ...over };
  return m;
}

/* The first sitting used to take every card that was owed. The second then found nothing
 * owed and offered the two new cards it was allowed, and the third filled up again as the
 * cards failed in the first came back round: long, stub, long. Nobody designed that. */
describe('sittingPlan', () => {
  it('splits the day between the sittings that will happen', () => {
    const m = mem(Array.from({ length: 22 }, (_, i) => due(i)), sat(day(1), 2));
    const first = sittingPlan(m, 0, TODAY);
    expect(first.sittings).toBe(2);
    expect(first.dueCap).toBe(11);
  });

  it('gives the last sitting everything still owed, so nothing slides to tomorrow', () => {
    // Eleven left after the first sitting took its half.
    const m = mem(Array.from({ length: 11 }, (_, i) => due(i)), sat(day(1), 2));
    expect(sittingPlan(m, 1, TODAY).dueCap).toBe(11);
  });

  /* The guard that matters most: dividing a day in two for somebody who only ever sits
   * down once does not pace them, it loses them half their reviews. */
  it('does not split the day for a learner who does one sitting a day', () => {
    const m = mem(Array.from({ length: 22 }, (_, i) => due(i)), [...sat(day(1)), ...sat(day(2)), ...sat(day(3))]);
    const plan = sittingPlan(m, 0, TODAY);
    expect(plan.sittings).toBe(1);
    expect(plan.dueCap).toBe(22);
  });

  it('does not split ten cards into two sittings of five', () => {
    const m = mem(Array.from({ length: 8 }, (_, i) => due(i)), sat(day(1), 2));
    expect(sittingPlan(m, 0, TODAY).sittings).toBe(1);
  });

  it('falls back to the setting before there is any history to read', () => {
    const m = mem(Array.from({ length: 30 }, (_, i) => due(i)));
    expect(sittingPlan(m, 0, TODAY).sittings).toBe(2);
    expect(sittingPlan(m, 0, TODAY).dueCap).toBe(15);
  });

  it('never plans more sittings than the setting allows', () => {
    const m = mem(Array.from({ length: 60 }, (_, i) => due(i)), sat(day(1), 5));
    expect(sittingPlan(m, 0, TODAY).sittings).toBe(2);
  });
});

describe('observedSittings', () => {
  it('averages over the days they reviewed, not over the calendar', () => {
    // Two sittings on one day, nothing the rest of the week: two, not two-sevenths.
    expect(observedSittings(mem([], sat(day(2), 2)), TODAY)).toBe(2);
  });

  it('ignores the pre-call warm-up, which is not one of the day’s sittings', () => {
    const warm = { ...sat(day(1))[0], warmup: 1 as const };
    expect(observedSittings(mem([], [...sat(day(1)), warm]), TODAY)).toBe(1);
  });
});

describe('buildSession with a share', () => {
  const cards = [...Array.from({ length: 22 }, (_, i) => due(i)), ...Array.from({ length: 6 }, (_, i) => fresh(i))];

  it('takes its share of what is owed, plus its new cards', () => {
    const q = buildSession({ cards, log: [] }, 18, 2, TODAY, false, 11);
    expect(q.filter(c => c.state !== 'new')).toHaveLength(11);
    expect(q.filter(c => c.state === 'new')).toHaveLength(2);
  });

  it('still takes everything when no share is given', () => {
    // The old behaviour, unchanged: every card owed, up to the backlog autoscale — which is
    // also what a one-sitting learner still gets, because their plan is one sitting.
    expect(buildSession({ cards, log: [] }, 18, 2, TODAY).filter(c => c.state !== 'new')).toHaveLength(22);
  });

  it('keeps a pinned card in the share rather than slicing it out', () => {
    const pinned = { ...due(99), starred: true, due: '2026-08-28' };  // newest, so last by date
    const q = buildSession({ cards: [...cards, pinned], log: [] }, 18, 2, TODAY, false, 3);
    expect(q.map(c => c.id)).toContain('d99');
  });
});
