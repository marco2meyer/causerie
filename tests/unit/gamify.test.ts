import { describe, expect, it } from 'vitest';
import type { Analysis, SessionRecord } from '../../src/types';
import { milestone, sessionXp, XP_MILESTONE, xpPartsOf, xpShare } from '../../src/lib/gamify';

function analysis(over: Partial<Analysis> = {}): Analysis {
  return {
    hauptpunkt: 'Test.',
    kommentar: 'Test.',
    cefr: { overall: 'A2+', grammar: 'A2', vocabulary: 'A2+', fluency: 'A2', comprehension: 'B1', confidence: 0.6, begruendung: 'x' },
    corrections: [], highlights: [], new_vocab: [], weaknesses: [], strengths: [],
    interests: [], facts: [], targets: [], next_focus: [], topics: [],
    prune: { facts: [], interests: [] }, competencies: [],
    ...over
  };
}

const correction = (i: number): Analysis['corrections'][number] => ({
  user_turn: i, original: 'a', besser: 'b', erklaerung: 'c', category: 'grammar',
  cefr_topic: 'x', cloze_text: 'b ___', cloze_answer: 'x', hint: 'h'
});

function record(over: Partial<SessionRecord> = {}): SessionRecord {
  return { id: 's1', date: '2026-08-19', topic: 'Test', source: 'causerie', minutes: 5, ...over };
}

describe('sessionXp', () => {
  it('prices every part of a call', () => {
    // 5 min × 10 + 1 target × 5 + 1 praise × 2 + 1 tip × 1 — the shipped award.
    expect(sessionXp({ minutes: 5, targets: 1, praise: 1, tips: 1, words: 0 })).toBe(58);
    expect(sessionXp({ minutes: 0, targets: 0, praise: 0, tips: 0, words: 0 })).toBe(0);
    // Two words placed in the conversation, at 5 each.
    expect(sessionXp({ minutes: 5, targets: 1, praise: 1, tips: 1, words: 2 })).toBe(68);
  });

  it('caps what corrections can earn, so a bad call cannot out-earn a good one', () => {
    expect(sessionXp({ minutes: 0, targets: 0, praise: 0, tips: 40, words: 0 })).toBe(10);
    expect(xpShare({ minutes: 0, targets: 0, praise: 0, tips: 40, words: 0 }).tips).toBe(10);
  });

  it('breaks down into parts that add back up to the total', () => {
    const p = { minutes: 9, targets: 2, praise: 3, tips: 4, words: 1 };
    const s = xpShare(p);
    expect(s.minutes + s.targets + s.praise + s.tips + s.words).toBe(sessionXp(p));
  });
});

describe('xpPartsOf', () => {
  it('rebuilds the arithmetic of a stored session', () => {
    const sess = record({
      minutes: 9,
      analysis: analysis({
        targets: [
          { label: 'a', achieved: true, evidence: 'x' },
          { label: 'b', achieved: false, evidence: 'y' }
        ],
        highlights: [{ user_turn: 0, quote: 'q', kommentar: 'k' }],
        corrections: [correction(0), correction(1)]
      })
    });
    expect(xpPartsOf(sess)).toEqual({ minutes: 9, targets: 1, praise: 1, tips: 2, words: 0 });
    expect(sessionXp(xpPartsOf(sess))).toBe(90 + 5 + 2 + 2);
  });

  it('survives a record with no analysis (Duolingo import, saved-without-analysis)', () => {
    expect(xpPartsOf(record({ minutes: null, analysis: null }))).toEqual({ minutes: 0, targets: 0, praise: 0, tips: 0, words: 0 });
  });
});

describe('word goals in the award', () => {
  it('counts only the words that were actually placed', () => {
    const sess = record({ minutes: 0, analysis: null, wordGoals: [{ word: 'contester', used: true }, { word: 'ranger', used: false }] });
    expect(xpPartsOf(sess).words).toBe(1);
    expect(sessionXp(xpPartsOf(sess))).toBe(5);
  });
});

describe('milestone', () => {
  it('runs to the next round thousand', () => {
    expect(milestone(0)).toEqual({ reached: 0, next: XP_MILESTONE, pct: 0 });
    expect(milestone(1240).next).toBe(2000);
    expect(milestone(1240).reached).toBe(1);
    expect(milestone(1000)).toEqual({ reached: 1, next: 2000, pct: 50 });
  });

  it('never divides by zero or goes negative', () => {
    expect(milestone(-5)).toEqual({ reached: 0, next: XP_MILESTONE, pct: 0 });
    expect(milestone(999).pct).toBeCloseTo(99.9, 1);
  });
});
