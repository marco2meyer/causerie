import { describe, expect, it } from 'vitest';
import { applyCheckin, directionFrom, dueCheckin, periodKey, windowStats } from '../../src/lib/checkin';
import { buildTutorPrompt } from '../../src/lib/prompts';
import { seedMem } from '../../src/lib/seed';
import { blankMem, migrate } from '../../src/lib/storage';
import { RANK_MAX, rankAdvance, rankMaintain, weekStart } from '../../src/lib/gamify';
import type { Memory } from '../../src/types';
import { todayISO } from '../../src/lib/utils';

const daysAgo = (n: number) => {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
};

function activeMem(callDays: number[], last: Partial<{ w: string; m: string; q: string }> = {}) {
  const m = blankMem();
  m.introDone = true;
  for (const n of callDays) {
    m.sessions.push({ id: 's' + n, date: daysAgo(n), topic: 't', source: 'causerie', minutes: 8 });
  }
  m.checkins = { history: [], lastWeekly: last.w, lastMonthly: last.m, lastQuarterly: last.q };
  m.createdAt = daysAgo(120) + 'T00:00:00.000Z';
  return m;
}

describe('dueCheckin', () => {
  it('offers a weekly after 7 active days, nothing right after one', () => {
    const m = activeMem([1, 3, 5], { w: daysAgo(8), m: daysAgo(8), q: daysAgo(8) });
    expect(dueCheckin(m)).toBe('week');
    const m2 = activeMem([1, 3, 5], { w: daysAgo(2), m: daysAgo(2), q: daysAgo(2) });
    expect(dueCheckin(m2)).toBeNull();
  });

  it('requires activity in the window', () => {
    const m = activeMem([20, 25], { w: daysAgo(10), m: daysAgo(10), q: daysAgo(10) }); // no calls since last weekly
    expect(dueCheckin(m)).toBeNull();
  });

  it('prefers the larger due period', () => {
    const days = Array.from({ length: 20 }, (_, i) => i + 1); // 20 recent calls
    const m = activeMem(days, { w: daysAgo(8), m: daysAgo(31), q: daysAgo(8) });
    expect(dueCheckin(m)).toBe('month');
  });
});

describe('windowStats', () => {
  it('aggregates the window and reads levels from history', () => {
    const m = seedMem('X');
    m.checkins = { history: [], lastWeekly: daysAgo(7) };
    m.sessions.push({ id: 'a', date: daysAgo(2), topic: 'Les arbres', source: 'causerie', minutes: 8, cardsAdded: 4 });
    m.deck.log.push({ date: daysAgo(1), total: 15, again: 2, hard: 3, good: 8, easy: 2, seconds: 300, xp: 20 });
    const st = windowStats(m, 'week');
    expect(st.calls).toBe(1);
    expect(st.minutes).toBe(8);
    expect(st.cardsAdded).toBe(4);
    expect(st.cardsSues).toBe(10);
    expect(st.cardsVues).toBe(15);
    expect(st.levelEnd).toBe('A2');
    expect(st.compFailed.length).toBeGreaterThan(0); // seeded ko cells
  });
});

describe('applyCheckin', () => {
  const data = {
    titre: 'Pas mal.', progres: ['x'], motifs: ['y'], cap: 'Consolider le passé composé.',
    questions: [
      { q: 'Cap ?', options: ['Monter la difficulté', 'Consolider les bases', 'Plus de sujets libres'] },
      { q: 'Rythme ?', options: ['Garder 8 min', 'Passer à 10 min', 'Raccourcir'] }
    ]
  };

  it('stamps the period (quarterly covers all), stores the record and the direction', () => {
    const m = blankMem();
    const rec = applyCheckin(m, 'quarter', data, [
      { question: 'Cap ?', answer: 'Consolider les bases' },
      { question: 'Rythme ?', answer: 'Garder 8 min' }
    ]);
    const d = todayISO();
    expect(m.checkins.lastWeekly).toBe(d);
    expect(m.checkins.lastMonthly).toBe(d);
    expect(m.checkins.lastQuarterly).toBe(d);
    expect(m.checkins.history[0].id).toBe(rec.id);
    // The question is kept with the answer: "Garder 8 min" on its own keeps WHAT at 8 min?
    expect(m.checkins.direction).toBe('Cap : Consolider les bases ; Rythme : Garder 8 min');
  });

  it('the chosen direction lands in the tutor briefing', () => {
    const m = seedMem('Marco');
    applyCheckin(m, 'week', data, [{ question: 'Cap ?', answer: 'Consolider les bases' }]);
    const p = buildTutorPrompt(m, { topic: 'x', targets: [], minutes: 8 });
    expect(p).toContain('Cap de la période');
    expect(p).toContain('Consolider les bases');
  });

  it('a weekly does not stamp month or quarter', () => {
    const m = blankMem();
    applyCheckin(m, 'week', data, []);
    expect(m.checkins.lastWeekly).toBe(todayISO());
    expect(m.checkins.lastMonthly).toBeUndefined();
    expect(m.checkins.direction).toBeUndefined();
  });
});

describe('the check-in sees the weekly ladder', () => {
  const withRank = (): Memory => {
    const m = blankMem();
    m.createdAt = '2026-07-01';
    m.checkins = { history: [], lastWeekly: '2026-08-03' };
    m.streak = { count: 9, last: '2026-08-19', repairs: 2 };
    m.rank = {
      level: 5, settled: '2026-08-17',
      history: [
        { week: '2026-07-20', verdict: 'up', level: 5, xp: 400 },   // before the window
        { week: '2026-08-03', verdict: 'up', level: 5, xp: 400 },
        { week: '2026-08-10', verdict: 'down', level: 6, xp: 40 }
      ]
    };
    return m;
  };

  it('reports where the learner stands and what a week has to earn', () => {
    const s = windowStats(withRank(), 'week', '2026-08-19');
    expect(s.rank.level).toBe(5);
    expect(s.rank.of).toBe(RANK_MAX);
    expect(s.rank.hold).toBe(rankMaintain(5));
    expect(s.rank.climb).toBe(rankAdvance(5));
    expect(s.rank.name).toBeTruthy();
  });

  it('carries the judged weeks inside the window, and no earlier ones', () => {
    const s = windowStats(withRank(), 'week', '2026-08-19');
    expect(s.rank.weeks.map(w => w.week)).toEqual(['2026-08-03', '2026-08-10']);
    // One up, one down: the ladder went nowhere, which is a different story from "no data".
    expect(s.rank.net).toBe(0);
  });

  it('carries the streak and the banked repairs', () => {
    const s = windowStats(withRank(), 'week', '2026-08-19');
    expect(s.streakDays).toBe(9);
    expect(s.repairsBanked).toBe(2);
  });

  it('has a rank to report even for a profile that has never been judged', () => {
    const s = windowStats(blankMem(), 'week');
    expect(s.rank.level).toBe(1);
    expect(s.rank.weeks).toEqual([]);
    expect(s.rank.net).toBe(0);
  });
});

/* "Trigger this at the end of the week" is a statement about weeks, and a rolling seven days
 * is not one: do Sunday's review on Tuesday and every later one becomes a Tuesday review.
 *
 * Fixed dates throughout, and `today` passed in rather than read from the clock: the first
 * version of this test used "n days ago" and passed on the Sunday it was written, then failed
 * on Monday, when "six days ago" stopped being last week. */
describe('dueCheckin falls on period boundaries', () => {
  const MON = '2026-09-07';           // a Monday: the week of the 7th
  const SUN = '2026-09-06';           // the Sunday before it: the week of the 31st
  const fixed = (last: string, callDates: string[]) => {
    const m = blankMem();
    m.introDone = true;
    m.createdAt = '2026-05-01T00:00:00.000Z';
    callDates.forEach((d, i) => m.sessions.push({ id: 's' + i, date: d, topic: 't', source: 'causerie', minutes: 8 }));
    m.checkins = { history: [], lastWeekly: last, lastMonthly: last, lastQuarterly: last };
    return m;
  };

  it('comes due as soon as a new week begins, not seven days after the last review', () => {
    // Reviewed on Monday the 31st, calls through that week, opened on Monday the 7th.
    expect(dueCheckin(fixed('2026-08-31', ['2026-09-01', '2026-09-03', '2026-09-05']), MON)).toBe('week');
  });

  it('does not come due twice inside one week', () => {
    expect(dueCheckin(fixed(MON, ['2026-09-08', '2026-09-09']), '2026-09-09')).toBeNull();
  });

  /* Reviewing late in the week and opening the app the next morning is a new week with
   * nothing in it yet. The activity guard catches that, and it waits for the week to
   * actually happen. */
  it('does not review a week that has only just started', () => {
    expect(dueCheckin(fixed(SUN, ['2026-09-02', '2026-09-04', SUN]), MON)).toBeNull();
  });

  it('still refuses to review a week nothing happened in', () => {
    expect(dueCheckin(fixed(SUN, ['2026-08-01', '2026-08-02']), MON)).toBeNull();
  });

  it('goes quiet for the day once it has been put off', () => {
    const m = fixed('2026-08-31', ['2026-09-01', '2026-09-03', '2026-09-05']);
    expect(dueCheckin(m, MON)).toBe('week');
    m.checkins.snoozedOn = MON;
    expect(dueCheckin(m, MON)).toBeNull();
    m.checkins.snoozedOn = SUN;          // yesterday's snooze is spent
    expect(dueCheckin(m, MON)).toBe('week');
  });
});

describe('periodKey', () => {
  it('groups by week, month and quarter', () => {
    expect(periodKey('week', '2026-08-31')).toBe(periodKey('week', '2026-09-06'));  // Mon–Sun
    expect(periodKey('week', '2026-08-30')).not.toBe(periodKey('week', '2026-08-31'));
    expect(periodKey('month', '2026-08-01')).toBe(periodKey('month', '2026-08-31'));
    expect(periodKey('quarter', '2026-07-01')).toBe(periodKey('quarter', '2026-09-30'));
    expect(periodKey('quarter', '2026-09-30')).not.toBe(periodKey('quarter', '2026-10-01'));
  });
});

describe('directionFrom', () => {
  it('keeps the question, because the answer alone is half a sentence', () => {
    expect(directionFrom([{ question: 'Quelle grammaire prioriser ?', answer: 'Travaille le subjonctif' }]))
      .toBe('Quelle grammaire prioriser : Travaille le subjonctif');
  });

  it('drops the unanswered ones and copes with a bare answer', () => {
    expect(directionFrom([
      { question: 'A ?', answer: '' },
      { question: '', answer: 'Monter la difficulté' }
    ])).toBe('Monter la difficulté');
  });
});

/* A direction written before the questions were kept can be rebuilt from the record it came
 * from, rather than waiting a week for the next check-in to overwrite it. */
describe('migrate repairs an old direction', () => {
  const withHistory = (direction: string) => {
    const m = blankMem();
    m.checkins = {
      direction,
      history: [{
        id: 'c1', date: todayISO(), period: 'week' as const, titre: 't', progres: [], motifs: [], cap: '',
        answers: [
          { question: 'Quel niveau de difficulté choisir ?', answer: 'Alterne les deux' },
          { question: 'Quelle grammaire prioriser ?', answer: 'Travaille le subjonctif' }
        ]
      }]
    };
    return migrate(JSON.parse(JSON.stringify(m)))!;
  };

  it('rebuilds the bare-answers form', () => {
    expect(withHistory('Alterne les deux ; Travaille le subjonctif').checkins.direction)
      .toBe('Quel niveau de difficulté choisir : Alterne les deux ; Quelle grammaire prioriser : Travaille le subjonctif');
  });

  it('leaves a direction that is already right alone', () => {
    const good = 'Quel niveau de difficulté choisir : Alterne les deux ; Quelle grammaire prioriser : Travaille le subjonctif';
    expect(withHistory(good).checkins.direction).toBe(good);
  });
});
