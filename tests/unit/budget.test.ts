import { describe, expect, it } from 'vitest';
import {
  BACKLOG_DAYS, MIN_CALL_CARDS, REVIEWS_PER_NEW_CARD, backlogDays, callCardBudget,
  dailyReviewCapacity, newBacklog, newForSitting, newPerSession, sessionsPerDay, sustainableNewPerDay
} from '../../src/lib/budget';
import { blankMem } from '../../src/lib/storage';
import { cardsFromAnalysis } from '../../src/lib/srs';
import type { Analysis, Card, Deck, Memory, Settings } from '../../src/types';

const settings = (over: Partial<Settings> = {}): Settings => ({ ...blankMem().settings, ...over });

const newCards = (n: number): Card[] => Array.from({ length: n }, (_, i) => ({
  id: 'n' + i, type: 'de2fr', front: 'f' + i, back: 'b' + i, createdAt: '2026-01-01',
  state: 'new', ease: 2.5, interval: 0, reps: 0, lapses: 0, due: '2026-01-01', sourceKind: 'vocab'
} as Card));

const mem = (cards: Card[], s: Partial<Settings> = {}) =>
  ({ deck: { cards, log: [] }, settings: settings(s) }) as unknown as Memory;

describe('the shipped rhythm', () => {
  it('sizes the day at two sittings of eighteen', () => {
    const s = settings();
    expect(sessionsPerDay(s)).toBe(2);
    expect(dailyReviewCapacity(s)).toBe(36);
    // 36 reviews a day, 8 reviews per new card over its first year.
    expect(sustainableNewPerDay(s)).toBe(Math.floor(36 / REVIEWS_PER_NEW_CARD));
    expect(sustainableNewPerDay(s)).toBe(4);
    expect(newPerSession(s)).toBe(2);
  });

  it('follows the capacity when the rhythm changes', () => {
    expect(sustainableNewPerDay(settings({ sessionsPerDay: 1 }))).toBe(2);
    expect(sustainableNewPerDay(settings({ sessionSize: 24 }))).toBe(6);
    expect(newPerSession(settings({ sessionSize: 24 }))).toBe(3);
  });

  it('never asks for nothing and never runs away', () => {
    expect(sustainableNewPerDay(settings({ sessionSize: 1, sessionsPerDay: 1 }))).toBe(MIN_CALL_CARDS);
    expect(sustainableNewPerDay(settings({ sessionSize: 200, sessionsPerDay: 3 }))).toBe(8);
  });

  it('hands the intake back to the pill when it is pinned by hand', () => {
    expect(newPerSession(settings({ newAuto: false, newPerSession: 8 }))).toBe(8);
  });
});

describe('callCardBudget', () => {
  it('gives a call the full day\'s allowance when nothing is waiting', () => {
    expect(newBacklog({ cards: [] })).toBe(0);
    expect(callCardBudget(mem([]))).toBe(4);
  });

  it('halves the batch when the unstarted pile is halfway through its buffer', () => {
    // buffer = 4 new/day x 5 days = 20 cards.
    expect(callCardBudget(mem(newCards(10)))).toBe(2);
  });

  it('falls to the floor once the pile is past the buffer, but never below it', () => {
    expect(callCardBudget(mem(newCards(4 * BACKLOG_DAYS)))).toBe(MIN_CALL_CARDS);
    expect(callCardBudget(mem(newCards(500)))).toBe(MIN_CALL_CARDS);
  });

  it('says how long the pile takes at the current intake', () => {
    expect(backlogDays(mem(newCards(12)))).toBe(3); // 4 a day
  });
});

const analysis = (over: Partial<Analysis>): Analysis => ({
  hauptpunkt: '', kommentar: '', cefr: {} as Analysis['cefr'], corrections: [], highlights: [],
  new_vocab: [], weaknesses: [], strengths: [], interests: [], facts: [],
  prune: { facts: [], interests: [] }, competencies: [], targets: [], next_focus: [], topics: [],
  ...over
});

const correction = (n: number) => ({
  user_turn: n, original: 'faux ' + n, besser: 'juste ' + n, erklaerung: '', category: 'grammar' as const,
  cefr_topic: '', cloze_text: `phrase ${n} ___ suite.`, cloze_answer: 'mot' + n, hint: 'cue'
});

describe('cardsFromAnalysis under a budget', () => {
  const an = analysis({
    corrections: [correction(1), correction(2), correction(3), correction(4)],
    new_vocab: [
      { fr: 'le carrefour', de: 'die Kreuzung', ex: 'Au carrefour.' },
      { fr: 'la falaise', de: 'die Klippe', ex: 'Sur la falaise.' },
      { fr: 'le vitrail', de: 'das Kirchenfenster', ex: 'Un beau vitrail.' }
    ]
  });
  const deck = (): Deck => ({ cards: [], log: [] });

  it('alternates mistakes and words instead of spending the budget on one kind', () => {
    const cards = cardsFromAnalysis(deck(), an, 's1', 'fr', false, 4);
    expect(cards).toHaveLength(4);
    expect(cards.map(c => c.type)).toEqual(['cloze', 'de2fr', 'cloze', 'de2fr']);
  });

  it('still leads with the most instructive mistake at the floor', () => {
    const cards = cardsFromAnalysis(deck(), an, 's1', 'fr', false, 2);
    expect(cards.map(c => c.type)).toEqual(['cloze', 'de2fr']);
  });

  it('lets a word\'s delayed production card ride along free below A2', () => {
    const cards = cardsFromAnalysis(deck(), an, 's1', 'fr', true, 2);
    // Budget of two: one cloze and one word — and the word brings its second direction.
    expect(cards.map(c => c.type)).toEqual(['cloze', 'fr2de', 'de2fr']);
    expect(cards[2].due > cards[1].due).toBe(true);
  });

  it('spends nothing on a budget of zero', () => {
    expect(cardsFromAnalysis(deck(), an, 's1', 'fr', false, 0)).toEqual([]);
  });

  it('falls back to whichever kind is left when the other runs out', () => {
    const only = analysis({ corrections: [correction(1)], new_vocab: an.new_vocab });
    const cards = cardsFromAnalysis(deck(), only, 's1', 'fr', false, 4);
    expect(cards.map(c => c.type)).toEqual(['cloze', 'de2fr', 'de2fr', 'de2fr']);
  });

  it('does not add a card the deck already carries', () => {
    const d = deck();
    const first = cardsFromAnalysis(d, an, 's1', 'fr', false, 4);
    d.cards.push(...first);
    expect(cardsFromAnalysis(d, an, 's2', 'fr', false, 4).map(c => c.front))
      .not.toContain(first[0].front);
  });
});

describe('a sitting past the day\'s plan', () => {
  it('splits the day\'s intake across the planned sittings', () => {
    const s = settings();                       // two sittings, four new cards a day
    expect(newForSitting(s, 0)).toBe(newPerSession(s));
    expect(newForSitting(s, 1)).toBe(newPerSession(s));
    expect(newPerSession(s)).toBe(2);
  });

  it('takes the throttle off once the plan is finished', () => {
    const s = settings();
    // The student did both sittings and came back anyway. Rationing them two cards at a
    // time is the app pacing a queue that no longer exists; the session size governs.
    expect(newForSitting(s, 2)).toBe(s.sessionSize);
    expect(newForSitting(s, 5)).toBe(s.sessionSize);
    expect(newForSitting(s, 2)).toBeGreaterThan(newForSitting(s, 0));
  });

  it('follows a one-sitting rhythm too', () => {
    const s = settings({ sessionsPerDay: 1 });
    expect(newForSitting(s, 0)).toBe(newPerSession(s));
    expect(newForSitting(s, 1)).toBe(s.sessionSize);
  });

  it('never asks for a session of nothing', () => {
    expect(newForSitting(settings({ sessionSize: 0 }), 3)).toBeGreaterThan(0);
  });
});
