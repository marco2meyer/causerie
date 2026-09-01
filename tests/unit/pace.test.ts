import { describe, expect, it } from 'vitest';
import type { Card, Memory, ReviewLogEntry } from '../../src/types';
import { deckPace } from '../../src/lib/pace';
import { REVIEWS_PER_NEW_CARD } from '../../src/lib/budget';
import { blankMem } from '../../src/lib/storage';

const TODAY = '2026-08-27';
const day = (back: number) => new Date(Date.parse(TODAY + 'T00:00:00Z') - back * 86400000).toISOString().slice(0, 10);

const card = (createdAt: string, state: Card['state'] = 'review'): Card => ({
  id: 'c' + Math.random().toString(36).slice(2, 9), type: 'de2fr', front: 'x', back: 'y',
  sourceKind: 'vocab', createdAt, state, ease: 2.5, interval: 3, reps: state === 'new' ? 0 : 2,
  lapses: 0, due: createdAt
});
const sitting = (date: string, total: number, started = 0): ReviewLogEntry =>
  ({ date, total, started, again: 0, hard: 0, good: total, easy: 0, seconds: 60, xp: total });

function mem(cards: Card[], log: ReviewLogEntry[]): Memory {
  const m = blankMem();
  m.deck.cards = cards;
  m.deck.log = log;
  return m;
}

/* The question is "will the reviewing I actually do carry the cards I actually make", so
 * both sides have to come from what happened rather than from the settings. */
describe('deckPace', () => {
  it('covers the whole window, oldest day first, even the empty days', () => {
    const p = deckPace(mem([], []), TODAY);
    expect(p.days).toHaveLength(7);
    expect(p.days[0].date).toBe(day(6));
    expect(p.days[6].date).toBe(TODAY);
    expect(p.verdict).toBe('idle');
  });

  it('puts both sides in new-cards-a-day, which is the only way they compare', () => {
    // Seven days, four cards a day made, and exactly enough reviewing to carry two.
    const cards = [0, 1, 2, 3, 4, 5, 6].flatMap(d => [card(day(d)), card(day(d)), card(day(d)), card(day(d))]);
    const log = [0, 1, 2, 3, 4, 5, 6].map(d => sitting(day(d), 2 * REVIEWS_PER_NEW_CARD));
    const p = deckPace(mem(cards, log), TODAY);
    expect(p.addedPerDay).toBe(4);
    expect(p.reviewsPerDay).toBe(2 * REVIEWS_PER_NEW_CARD);
    expect(p.carriedPerDay).toBe(2);
    expect(p.netPerDay).toBe(2);
    expect(p.verdict).toBe('growing');
  });

  it('calls it level when the two are within a rounding of each other', () => {
    const cards = [0, 1, 2, 3, 4, 5, 6].map(d => card(day(d)));
    const log = [0, 1, 2, 3, 4, 5, 6].map(d => sitting(day(d), REVIEWS_PER_NEW_CARD));
    const p = deckPace(mem(cards, log), TODAY);
    expect(p.netPerDay).toBe(0);
    expect(p.verdict).toBe('level');
  });

  it('calls it clearing when the reviewing outruns the making', () => {
    const log = [0, 1, 2, 3, 4, 5, 6].map(d => sitting(day(d), 3 * REVIEWS_PER_NEW_CARD, 3));
    const p = deckPace(mem([card(day(2))], log), TODAY);
    expect(p.verdict).toBe('clearing');
  });

  it('counts several sittings on one day together', () => {
    const p = deckPace(mem([], [sitting(TODAY, 10, 2), sitting(TODAY, 6, 1)]), TODAY);
    const last = p.days[6];
    expect(last.reviews).toBe(16);
    expect(last.started).toBe(3);
  });

  it('ignores what fell out of the window', () => {
    const p = deckPace(mem([card(day(30))], [sitting(day(30), 80)]), TODAY);
    expect(p.addedPerDay).toBe(0);
    expect(p.reviewsPerDay).toBe(0);
  });

  it('empties the pile at the rate cards are STARTED, not at the rate they are reviewed', () => {
    // Ten waiting from before the window; three started a day against one made a day, so a
    // net two a day: five days.
    const waiting = Array.from({ length: 10 }, () => card(day(30), 'new'));
    const log = [0, 1, 2, 3, 4, 5, 6].map(d => sitting(day(d), 24, 3));
    const p = deckPace(mem([...waiting, ...[0, 1, 2, 3, 4, 5, 6].map(d => card(day(d)))], log), TODAY);
    expect(p.backlog).toBe(10);
    expect(p.startedPerDay).toBe(3);
    expect(p.addedPerDay).toBe(1);
    expect(p.daysToClear).toBe(5);
  });

  it('says the pile never clears rather than dividing by a number that is not there', () => {
    const waiting = Array.from({ length: 5 }, () => card(day(1), 'new'));
    const p = deckPace(mem(waiting, []), TODAY);
    expect(p.daysToClear).toBeNull();
  });

  /* Sittings logged before `started` existed report nothing, and a zero there would read as
   * "you started no cards" rather than "nobody was counting". */
  it('falls back to the settings for sittings that never recorded what they started, and says so', () => {
    const old: ReviewLogEntry = { date: day(1), total: 20, again: 0, hard: 0, good: 20, easy: 0, seconds: 60, xp: 20 };
    const p = deckPace(mem([card(day(1), 'new')], [old]), TODAY);
    expect(p.startedEstimated).toBe(true);
    expect(p.startedPerDay).toBeGreaterThan(0);

    const logged = deckPace(mem([card(day(1), 'new')], [sitting(day(1), 20, 4)]), TODAY);
    expect(logged.startedEstimated).toBe(false);
    expect(logged.startedPerDay).toBeCloseTo(4 / 7, 2);
  });

  it('reads createdTs when a card carries one, and the date when it does not', () => {
    const withTs = { ...card(day(30)), createdTs: Date.parse(TODAY + 'T09:00:00Z') };
    const p = deckPace(mem([withTs], []), TODAY);
    expect(p.days[6].added).toBe(1);
  });
});
