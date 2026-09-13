import { describe, expect, it } from 'vitest';
import { grammarState, markCourseDone } from '../../src/lib/grammar';
import {
  lastNarration, NARRATION_CELLS, narrationCoachCell, narrationDue, narrationUnlocked
} from '../../src/lib/narration';
import { blankMem } from '../../src/lib/storage';
import type { Memory } from '../../src/types';

const run = (date: string, past = true) => ({ date, topic: 't', words: [40], wpm: [40], ...(past ? { past: true } : {}) });

/** Both French past-tense modules sat through. */
const taughtBoth = (): Memory => {
  const m = blankMem();
  for (const id of NARRATION_CELLS.fr) markCourseDone(m, id, '2026-01-01');
  return m;
};

describe('narrationUnlocked', () => {
  it('stays locked until EVERY past-tense module has been sat through', () => {
    const m = blankMem();
    expect(narrationUnlocked(m)).toBe(false);
    markCourseDone(m, 'g-a2-passe-compose', '2026-01-01');
    expect(narrationUnlocked(m)).toBe(false);   // one of two is not "did the modules"
    markCourseDone(m, 'g-b1-imparfait-pc', '2026-01-05');
    expect(narrationUnlocked(m)).toBe(true);
  });

  it('a concept marked known by hand counts as done — mastery does not have to have settled', () => {
    const m = blankMem();
    grammarState(m).topics['g-a2-passe-compose'] = { courseAt: '', manual: 1, days: [] };
    markCourseDone(m, 'g-b1-imparfait-pc', '2026-01-05');
    expect(narrationUnlocked(m)).toBe(true);
  });

  it('skipping a module does not unlock anything', () => {
    const m = blankMem();
    grammarState(m).skipped = [...NARRATION_CELLS.fr];
    expect(narrationUnlocked(m)).toBe(false);
  });

  it('stays locked for a language without teachable past-tense cells', () => {
    const m = taughtBoth();
    m.profile.target = 'es';
    expect(narrationUnlocked(m)).toBe(false);
  });
});

describe('narrationCoachCell', () => {
  it('leans on the past cell still being drilled, newest teaching first', () => {
    const m = taughtBoth();
    expect(narrationCoachCell(m)).toBe('g-b1-imparfait-pc');
    grammarState(m).topics['g-b1-imparfait-pc'].masteredAt = '2026-01-10';
    expect(narrationCoachCell(m)).toBe('g-a2-passe-compose');
  });

  it('falls back to the most advanced past cell once everything is mastered', () => {
    const m = taughtBoth();
    for (const id of NARRATION_CELLS.fr) grammarState(m).topics[id].masteredAt = '2026-01-10';
    expect(narrationCoachCell(m)).toBe('g-b1-imparfait-pc');
  });
});

describe('narrationDue', () => {
  it('is owed as soon as the strand unlocks, then weekly', () => {
    const m = taughtBoth();
    expect(narrationDue(m, '2026-01-06')).toBe(true);
    m.fluency = [run('2026-01-06')];
    expect(narrationDue(m, '2026-01-08')).toBe(false);
    expect(narrationDue(m, '2026-01-13')).toBe(true);
    expect(lastNarration(m)).toBe('2026-01-06');
  });

  it('plain retells do not reset the week — only past-tense runs count', () => {
    const m = taughtBoth();
    m.fluency = [run('2026-01-02'), run('2026-01-06', false)];
    expect(lastNarration(m)).toBe('2026-01-02');
    expect(narrationDue(m, '2026-01-09')).toBe(true);
  });

  it('is never owed while the strand is locked', () => {
    expect(narrationDue(blankMem(), '2026-01-06')).toBe(false);
  });
});
