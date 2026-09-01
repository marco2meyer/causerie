import { describe, expect, it } from 'vitest';
import {
  judgeWeek, rankAdvance, rankMaintain, rankOf, settleRank, touchStreak,
  RANK_MAX, REPAIR_EVERY, REPAIR_MAX
} from '../../src/lib/gamify';
import type { Memory } from '../../src/types';

const mem = (over: Partial<Memory> = {}): Memory => ({
  xp: 0, streak: { count: 0, last: null }, sessions: [], deck: { cards: [], log: [] },
  ...over
} as unknown as Memory);

const call = (date: string, xp: number) => ({ id: 's' + date + xp, date, topic: 't', source: 'causerie' as const, minutes: 8, xp });

describe('rank thresholds', () => {
  it('cost more the higher the rank goes', () => {
    expect(rankMaintain(1)).toBe(100);            // one conversation plus one review
    expect(rankMaintain(RANK_MAX)).toBe(650);
    for (let l = 2; l <= RANK_MAX; l++) expect(rankMaintain(l)).toBeGreaterThan(rankMaintain(l - 1));
  });

  it('ask a quarter more to climb than to hold', () => {
    expect(rankAdvance(1)).toBe(125);
    expect(rankAdvance(RANK_MAX)).toBeGreaterThan(rankMaintain(RANK_MAX));
  });

  it('judges a week against the rank it was lived at', () => {
    expect(judgeWeek(1, 130)).toBe('up');
    expect(judgeWeek(1, 100)).toBe('hold');
    expect(judgeWeek(1, 99)).toBe('down');
    // The top rung cannot climb, however good the week.
    expect(judgeWeek(RANK_MAX, 99999)).toBe('hold');
  });
});

describe('weekly settlement', () => {
  it('judges only weeks that have ended, and each of them once', () => {
    const m = mem({ sessions: [call('2026-08-10', 400), call('2026-08-19', 900)] });
    // Monday 17th is the current week: live, so not judged. The week of the 10th is over.
    expect(settleRank(m, '2026-08-19')).toEqual(['up']);
    expect(m.rank!.level).toBe(2);
    expect(m.rank!.settled).toBe('2026-08-17');
    expect(settleRank(m, '2026-08-19')).toEqual([]);   // idempotent within the week
    expect(m.rank!.level).toBe(2);
  });

  it('keeps what each judged week did, at the level it was lived at', () => {
    // The verdict used to be returned and thrown away, so nothing downstream could say
    // "you dropped a rank last week" — least of all the periodic check-in.
    const m = mem({ sessions: [call('2026-08-03', 900)], rank: { level: 6, settled: '2026-08-03' } });
    settleRank(m, '2026-08-24');
    expect(m.rank!.history).toEqual([
      { week: '2026-08-03', verdict: 'up', level: 6, xp: 900 },
      { week: '2026-08-10', verdict: 'down', level: 7, xp: 0 },
      { week: '2026-08-17', verdict: 'down', level: 6, xp: 0 }
    ]);
    // Settling again adds nothing: the weeks are already judged.
    settleRank(m, '2026-08-24');
    expect(m.rank!.history).toHaveLength(3);
  });

  it('keeps half a year of weeks and no more', () => {
    const m = mem({ sessions: [call('2025-01-06', 900)], rank: { level: 6, settled: '2025-01-06' } });
    settleRank(m, '2026-08-24');
    expect(m.rank!.history!.length).toBe(26);
    expect(m.rank!.history![25].week < '2026-08-24').toBe(true);
  });

  it('makes a fortnight away cost a fortnight', () => {
    const m = mem({ sessions: [call('2026-08-03', 900)], rank: { level: 6, settled: '2026-08-03' } });
    // Week of the 3rd earns 900 (up), then two empty weeks (down, down).
    expect(settleRank(m, '2026-08-24')).toEqual(['up', 'down', 'down']);
    expect(m.rank!.level).toBe(5);
  });

  it('cannot fall below the first rung or climb past the last', () => {
    const low = mem({ sessions: [], rank: { level: 1, settled: '2026-08-03' } });
    settleRank(low, '2026-08-24');
    expect(low.rank!.level).toBe(1);

    const high = mem({
      sessions: [call('2026-08-03', 9999), call('2026-08-10', 9999)],
      rank: { level: RANK_MAX, settled: '2026-08-03' }
    });
    settleRank(high, '2026-08-17');
    expect(high.rank!.level).toBe(RANK_MAX);
  });

  it('starts the accounting at the first active week, not at today', () => {
    const m = mem({ sessions: [call('2026-08-10', 300)] });
    expect(rankOf(m, '2026-08-19').settled).toBe('2026-08-10');
    expect(m.rank).toBeUndefined();   // reading it never writes it
  });
});

describe('streak repairs', () => {
  const run = (days: string[]) => {
    const m = mem();
    for (const d of days) touchStreak(m, d);
    return m.streak;
  };
  const seq = (from: number, n: number) =>
    Array.from({ length: n }, (_, i) => '2026-08-' + String(from + i).padStart(2, '0'));

  it('earns one repair every five days in a row', () => {
    expect(run(seq(1, 4)).repairs).toBe(0);
    expect(run(seq(1, 5)).repairs).toBe(1);
    expect(run(seq(1, 10)).repairs).toBe(2);
  });

  it('never banks more than the cap', () => {
    const s = run(seq(1, REPAIR_EVERY * (REPAIR_MAX + 3)));
    expect(s.repairs).toBe(REPAIR_MAX);
  });

  it('spends a repair to bridge a missed day instead of resetting', () => {
    const m = mem();
    for (const d of seq(1, 5)) touchStreak(m, d);   // 5-day run, one repair banked
    expect(m.streak).toMatchObject({ count: 5, repairs: 1 });
    touchStreak(m, '2026-08-07');                    // the 6th was missed
    expect(m.streak).toMatchObject({ count: 6, repairs: 0, last: '2026-08-07' });
  });

  it('keeps the bank when it cannot cover the whole gap', () => {
    const m = mem();
    for (const d of seq(1, 5)) touchStreak(m, d);   // one repair
    touchStreak(m, '2026-08-09');                    // three days missed, one repair
    expect(m.streak).toMatchObject({ count: 1, repairs: 1 });
  });

  it('does not count the same day twice', () => {
    const m = mem();
    touchStreak(m, '2026-08-01');
    touchStreak(m, '2026-08-01');
    expect(m.streak.count).toBe(1);
  });
});
