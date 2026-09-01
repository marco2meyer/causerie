import { describe, expect, it } from 'vitest';
import { reviewXp, weekStart, weekXp, xpByDay, XP_REVIEW_BASE } from '../../src/lib/gamify';
import type { Memory } from '../../src/types';

const mem = (sessions: { date: string; xp?: number }[], log: { date: string; xp: number }[]) =>
  ({ sessions, deck: { cards: [], log } } as unknown as Pick<Memory, 'sessions' | 'deck'>);

describe('the XP week', () => {
  it('starts on Monday, whatever day you ask about', () => {
    expect(weekStart('2026-08-19')).toBe('2026-08-17'); // Wednesday
    expect(weekStart('2026-08-17')).toBe('2026-08-17'); // Monday itself
    expect(weekStart('2026-08-23')).toBe('2026-08-17'); // Sunday still belongs to it
    expect(weekStart('2026-08-24')).toBe('2026-08-24'); // next Monday
  });

  it('survives the DST changeover, where midnight arithmetic does not', () => {
    expect(weekStart('2026-03-29')).toBe('2026-03-23'); // clocks forward, Europe
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // clocks back
  });

  it('adds up both things that award XP, and nothing else', () => {
    const m = mem(
      [{ date: '2026-08-17', xp: 100 }, { date: '2026-08-17', xp: 20 }, { date: '2026-08-10', xp: 90 },
       { date: '2026-08-19' }], // a pre-XP record contributes nothing rather than a guess
      [{ date: '2026-08-17', xp: 20 }, { date: '2026-08-19', xp: 18 }]
    );
    expect(xpByDay(m)).toEqual({ '2026-08-17': 140, '2026-08-10': 90, '2026-08-19': 18 });
  });

  it('counts only the current week, Monday to Sunday', () => {
    const m = mem([{ date: '2026-08-16', xp: 500 }, { date: '2026-08-17', xp: 120 }], // 16th is last week
                  [{ date: '2026-08-19', xp: 18 }, { date: '2026-08-24', xp: 99 }]);  // 24th is next week
    const w = weekXp(m, '2026-08-19');
    expect(w.from).toBe('2026-08-17');
    expect(w.earned).toBe(138);
    expect(w.days.map(x => x.date)).toEqual([
      '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'
    ]);
    expect(w.days.map(x => x.xp)).toEqual([120, 0, 18, 0, 0, 0, 0]);
  });

  it('reports what was actually earned, however far past any threshold', () => {
    // The bar clamps itself; the number must not, or a strong week reads as an average one.
    const w = weekXp(mem([{ date: '2026-08-17', xp: 4000 }], []), '2026-08-19');
    expect(w.earned).toBe(4000);
  });

  it('prices a review round the way the session awards it', () => {
    expect(reviewXp(15)).toBe(XP_REVIEW_BASE + 15);
    expect(reviewXp(0)).toBe(XP_REVIEW_BASE);
  });
});
