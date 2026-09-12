import { describe, expect, it } from 'vitest';
import { blankMem } from '../../src/lib/storage';
import type { GrammarDrill, GrammarTopic, Memory } from '../../src/types';
import {
  checkAnswer, drillCount, drillId, drillIndex, drillTally, grammarFocus, grammarQueue,
  grammarState, interleave, isDrillId, isMastered, learningTopics, markCourseDone, MASTERY,
  pickDrills, recentAccuracy, recordDrill, settleMastery
} from '../../src/lib/grammar';
import { usableDrill, usableStep } from '../../src/lib/course';

/** A memory at B1 (index 4), which is what puts A1/A2/B1 grammar in range. */
const at = (level: number): Memory => {
  const m = blankMem();
  m.cefr.overall = level;
  return m;
};

const topic = (over: Partial<GrammarTopic> = {}): GrammarTopic =>
  ({ courseAt: '2026-01-01', days: [], ...over });

const days = (spec: [string, number, number][]) => spec.map(([d, ok, ko]) => ({ d, ok, ko }));

const drill = (topicId: string, n: number): GrammarDrill => ({
  topic: topicId, kind: 'gap', prompt: 'p' + n, text: '___ ' + n, cue: 'c' + n,
  options: [], answer: 'a' + n, explain: 'e'
});

describe('grammarQueue', () => {
  it('puts failed cells before mixed, unseen and demonstrated ones', () => {
    const m = at(4);
    m.comp = {
      'g-a1-articles': { status: 'ok', lastSeen: '2026-01-01' },
      'g-a1-negation': { status: 'partial', lastSeen: '2026-01-01' },
      'g-a2-passe-compose': { status: 'ko', lastSeen: '2026-01-01' }
    };
    const q = grammarQueue(m).map(c => c.id);
    expect(q[0]).toBe('g-a2-passe-compose');        // ko wins even from a higher band
    expect(q.indexOf('g-a1-negation')).toBeLessThan(q.indexOf('g-a1-etre-avoir')); // partial before grey
    expect(q.indexOf('g-a1-articles')).toBe(q.length - 1); // demonstrated sinks to the bottom
  });

  it('puts the lower band first among cells of equal standing', () => {
    const m = at(4);
    const q = grammarQueue(m).map(c => c.id);
    expect(q.indexOf('g-a1-etre-avoir')).toBeLessThan(q.indexOf('g-a2-passe-compose'));
    expect(q.indexOf('g-a2-passe-compose')).toBeLessThan(q.indexOf('g-b1-relatifs'));
  });

  it('offers only grammar at or below the learner band', () => {
    const m = at(2); // A2
    const bands = new Set(grammarQueue(m).map(c => c.band));
    expect([...bands].sort()).toEqual(['A1', 'A2']);
    expect(grammarQueue(m).every(c => c.cat === 'grammaire')).toBe(true);
  });

  it('reaches one band up only once everything at or below is taught', () => {
    const m = at(0); // A1
    for (const c of grammarQueue(m)) markCourseDone(m, c.id, '2026-01-01');
    expect(grammarQueue(m).every(c => c.band === 'A2')).toBe(true);
  });

  it('honours the student order, then falls back to the score', () => {
    const m = at(4);
    m.comp = { 'g-a2-passe-compose': { status: 'ko', lastSeen: '2026-01-01' } };
    grammarState(m).order = ['g-b1-relatifs', 'g-a1-questions'];
    const q = grammarQueue(m).map(c => c.id);
    expect(q.slice(0, 3)).toEqual(['g-b1-relatifs', 'g-a1-questions', 'g-a2-passe-compose']);
  });

  it('never offers a skipped or already taught cell', () => {
    const m = at(4);
    markCourseDone(m, 'g-a1-etre-avoir', '2026-01-01');
    grammarState(m).skipped = ['g-a1-articles'];
    const q = grammarQueue(m).map(c => c.id);
    expect(q).not.toContain('g-a1-etre-avoir');
    expect(q).not.toContain('g-a1-articles');
  });
});

describe('grammarFocus', () => {
  it('keeps a taught concept until it is mastered, then hands over to the queue', () => {
    const m = at(4);
    markCourseDone(m, 'g-a2-partitif', '2026-01-01');
    expect(grammarFocus(m)?.item.id).toBe('g-a2-partitif');
    grammarState(m).topics['g-a2-partitif'].masteredAt = '2026-01-05';
    expect(grammarFocus(m)?.item.id).not.toBe('g-a2-partitif');
    expect(grammarFocus(m)?.topic).toBeNull();      // the next one has had no course yet
  });

  it('holds the oldest unfinished concept rather than the newest', () => {
    const m = at(4);
    markCourseDone(m, 'g-a1-negation', '2026-01-01');
    markCourseDone(m, 'g-a2-partitif', '2026-01-04');
    expect(grammarFocus(m)?.item.id).toBe('g-a1-negation');
    expect(learningTopics(m)).toEqual(['g-a1-negation', 'g-a2-partitif']);
  });
});

describe('markCourseDone', () => {
  it('restarts the clock on a redo without dropping the tallies', () => {
    const m = at(4);
    markCourseDone(m, 'g-a2-partitif', '2026-01-01');
    recordDrill(m, 'g-a2-partitif', true, '2026-01-02');
    grammarState(m).topics['g-a2-partitif'].masteredAt = '2026-01-06';
    markCourseDone(m, 'g-a2-partitif', '2026-02-01');
    const t = grammarState(m).topics['g-a2-partitif'];
    expect(t.courseAt).toBe('2026-01-01');
    expect(t.redoneAt).toBe('2026-02-01');
    expect(t.masteredAt).toBeUndefined();
    // The history is kept — but it is no longer EVIDENCE. A student who came back to a rule
    // is telling the app that what it thought had stuck has not, and the answers from before
    // they said so describe somebody else.
    expect(t.days).toHaveLength(1);
    expect(drillTally(t).tries).toBe(0);
  });

  it('does not re-master a redone concept on the tallies that were already proved wrong', () => {
    const m = at(4);
    markCourseDone(m, 'g-a2-partitif', '2026-01-01');
    const t = grammarState(m).topics['g-a2-partitif'];
    t.days = days([['2026-01-02', 3, 0], ['2026-01-03', 3, 0], ['2026-01-04', 3, 0]]);
    expect(settleMastery(m, '2026-01-04')).toEqual(['g-a2-partitif']);
    markCourseDone(m, 'g-a2-partitif', '2026-02-01');           // the student came back to it
    expect(settleMastery(m, '2026-02-10')).toEqual([]);         // nine quiet days prove nothing
    expect(isMastered(t, false, '2026-02-10')).toBe(false);
  });
});

describe('drill tallies', () => {
  it('counts answers and keeps one row per day', () => {
    const m = at(4);
    markCourseDone(m, 'g-a2-partitif', '2026-01-01');
    recordDrill(m, 'g-a2-partitif', true, '2026-01-02');
    recordDrill(m, 'g-a2-partitif', false, '2026-01-02');
    recordDrill(m, 'g-a2-partitif', true, '2026-01-03');
    const t = grammarState(m).topics['g-a2-partitif'];
    expect(t.days).toEqual([{ d: '2026-01-02', ok: 1, ko: 1 }, { d: '2026-01-03', ok: 1, ko: 0 }]);
    expect(drillTally(t)).toEqual({ tries: 3, ok: 2 });
  });

  it('ignores an exercise for a concept that is no longer tracked', () => {
    const m = at(4);
    expect(recordDrill(m, 'g-a2-partitif', true, '2026-01-02')).toBeNull();
  });
});

describe('recentAccuracy', () => {
  it('measures the most recent answers, newest days first', () => {
    // 10 wrong long ago, 10 right lately: the window sees only the recent ten.
    const t = topic({ days: days([['2026-01-01', 0, 10], ['2026-01-09', 10, 0]]) });
    expect(recentAccuracy(t, 10)).toBe(1);
  });

  it('counts a day that straddles the window proportionally', () => {
    // Window of 4: all 2 from the newest day, then half of a 4-answer day that was 50/50.
    const t = topic({ days: days([['2026-01-01', 2, 2], ['2026-01-02', 2, 0]]) });
    expect(recentAccuracy(t, 4)).toBe(0.75);
  });

  it('is null with nothing to measure', () => {
    expect(recentAccuracy(topic())).toBeNull();
    expect(recentAccuracy(topic({ days: days([['2026-01-01', 0, 0]]) }))).toBeNull();
  });
});

describe('isMastered', () => {
  const spread = days([['2026-01-02', 3, 0], ['2026-01-03', 3, 0], ['2026-01-04', 3, 0]]);

  it('needs days, tries, accuracy and elapsed time together', () => {
    expect(isMastered(topic({ days: spread }), false, '2026-01-04')).toBe(true);
  });

  it('refuses a concept drilled hard on a single day', () => {
    const t = topic({ days: days([['2026-01-02', 12, 0]]) });
    expect(isMastered(t, false, '2026-01-09')).toBe(false);   // one day is not evidence
  });

  it('refuses a concept that is still being got wrong', () => {
    const t = topic({ days: days([['2026-01-02', 2, 2], ['2026-01-03', 2, 2], ['2026-01-04', 2, 2]]) });
    expect(isMastered(t, false, '2026-01-09')).toBe(false);
  });

  it('asks for half as much when the call evidence already says the cell is good', () => {
    const t = topic({ days: days([['2026-01-02', 2, 0], ['2026-01-03', 2, 0]]) });
    expect(isMastered(t, false, '2026-01-03')).toBe(false);
    expect(isMastered(t, true, '2026-01-03')).toBe(true);
  });

  it('short-circuits on a manual mark or a date already set', () => {
    expect(isMastered(topic({ manual: 1 }), false, '2026-01-02')).toBe(true);
    expect(isMastered(topic({ masteredAt: '2026-01-02' }), false, '2026-01-02')).toBe(true);
  });

  it('matches the constants it is documented against', () => {
    expect(MASTERY.days).toBe(3);
    expect(MASTERY.accuracy).toBe(0.8);
  });
});

describe('settleMastery with the exercises turned off', () => {
  it('still moves on, rather than holding one concept for ever', () => {
    // Mastery is normally earned by answering exercises. With the share at zero there are
    // none to answer, so without this the day screen would offer the same concept's fiche
    // until the end of time — the one thing the strand exists not to do.
    const m = at(4);
    m.settings.grammarShare = 0;
    markCourseDone(m, 'g-a2-partitif', '2026-01-01');
    expect(settleMastery(m, '2026-01-03')).toEqual([]);          // not yet — give it a few days
    expect(settleMastery(m, '2026-01-05')).toEqual(['g-a2-partitif']);
    expect(learningTopics(m)).toEqual([]);
    expect(grammarFocus(m)?.item.id).not.toBe('g-a2-partitif');  // the queue has moved on
  });

  it('leaves a concept alone while its exercises are still being answered', () => {
    const m = at(4);
    m.settings.grammarShare = 0;
    markCourseDone(m, 'g-a2-partitif', '2026-01-01');
    recordDrill(m, 'g-a2-partitif', false, '2026-01-02');        // the share was on until today
    expect(settleMastery(m, '2026-01-09')).toEqual([]);          // judged on its answers, not its age
  });

  it('is unaffected when the exercises are on', () => {
    const m = at(4);
    markCourseDone(m, 'g-a2-partitif', '2026-01-01');
    expect(settleMastery(m, '2026-01-20')).toEqual([]);          // no answers, no mastery
  });
});

describe('settleMastery', () => {
  it('promotes exactly the concepts that now clear the bar', () => {
    const m = at(4);
    markCourseDone(m, 'g-a2-partitif', '2026-01-01');
    markCourseDone(m, 'g-a1-negation', '2026-01-01');
    grammarState(m).topics['g-a2-partitif'].days = days([['2026-01-02', 3, 0], ['2026-01-03', 3, 0], ['2026-01-04', 3, 0]]);
    expect(settleMastery(m, '2026-01-04')).toEqual(['g-a2-partitif']);
    expect(settleMastery(m, '2026-01-04')).toEqual([]);       // only once
    expect(learningTopics(m)).toEqual(['g-a1-negation']);
  });
});

describe('drillCount', () => {
  it('is a quarter of the sitting by default, capped', () => {
    expect(drillCount({}, 16)).toBe(4);
    expect(drillCount({}, 18)).toBe(5);
    expect(drillCount({}, 60)).toBe(6);              // MAX_DRILLS
  });

  it('is off at zero and never zero-by-rounding otherwise', () => {
    expect(drillCount({ grammarShare: 0 }, 18)).toBe(0);
    expect(drillCount({}, 0)).toBe(0);
    expect(drillCount({ grammarShare: 5 }, 3)).toBe(1);
  });
});

describe('pickDrills', () => {
  const bank = (id: string, n: number) => Array.from({ length: n }, (_, i) => drill(id, i + 1));
  const banks = { 'g-a1-negation': bank('g-a1-negation', 3), 'g-a2-partitif': bank('g-a2-partitif', 3) };
  const deep = { 'g-a1-negation': bank('g-a1-negation', 8), 'g-a2-partitif': bank('g-a2-partitif', 8) };

  it('leans on the newest concept without abandoning the older one', () => {
    const m = at(4);
    markCourseDone(m, 'g-a1-negation', '2026-01-01');
    markCourseDone(m, 'g-a2-partitif', '2026-01-05');
    const got = pickDrills(m, 6, deep, '2026-01-06');
    expect(got).toHaveLength(6);
    expect(got.filter(d => d.topic === 'g-a2-partitif').length).toBe(4);  // twice the slots
    expect(got.filter(d => d.topic === 'g-a1-negation').length).toBe(2);
  });

  it('falls back to the other concept when the newest bank runs dry', () => {
    const m = at(4);
    markCourseDone(m, 'g-a1-negation', '2026-01-01');
    markCourseDone(m, 'g-a2-partitif', '2026-01-05');
    const got = pickDrills(m, 6, banks, '2026-01-06');   // three each, four wanted from one
    expect(got).toHaveLength(6);
    expect(got.filter(d => d.topic === 'g-a2-partitif').length).toBe(3);
  });

  it('never repeats an exercise inside one sitting', () => {
    const m = at(4);
    markCourseDone(m, 'g-a1-negation', '2026-01-01');
    const got = pickDrills(m, 3, { 'g-a1-negation': banks['g-a1-negation'] }, '2026-01-06');
    expect(new Set(got.map(d => d.prompt)).size).toBe(3);
  });

  it('stops when the banks run out rather than looping', () => {
    const m = at(4);
    markCourseDone(m, 'g-a1-negation', '2026-01-01');
    const got = pickDrills(m, 10, { 'g-a1-negation': banks['g-a1-negation'] }, '2026-01-06');
    expect(got).toHaveLength(3);
  });

  it('rotates by day, so two evenings do not ask the same things', () => {
    const m = at(4);
    markCourseDone(m, 'g-a1-negation', '2026-01-01');
    const one = pickDrills(m, 2, { 'g-a1-negation': banks['g-a1-negation'] }, '2026-01-06');
    const two = pickDrills(m, 2, { 'g-a1-negation': banks['g-a1-negation'] }, '2026-01-07');
    expect(one.map(d => d.prompt)).not.toEqual(two.map(d => d.prompt));
  });

  it('turns between the day\u2019s own sittings, whatever the bank size', () => {
    // The stride used to share a factor with some bank sizes, and the second sitting of the
    // day then asked exactly what the first one had just asked.
    const m = at(4);
    markCourseDone(m, 'g-a1-negation', '2026-01-01');
    const same: number[] = [];
    for (let size = 2; size <= 12; size++) {
      const b = { 'g-a1-negation': bank('g-a1-negation', size) };
      const first = pickDrills(m, 2, b, '2026-01-06', 0).map(d => d.prompt).join();
      const second = pickDrills(m, 2, b, '2026-01-06', 1).map(d => d.prompt).join();
      if (first === second) same.push(size);
    }
    expect(same).toEqual([]);
  });

  it('skips a mastered concept and a concept with no bank', () => {
    const m = at(4);
    markCourseDone(m, 'g-a1-negation', '2026-01-01');
    markCourseDone(m, 'g-a2-partitif', '2026-01-02');
    grammarState(m).topics['g-a2-partitif'].masteredAt = '2026-01-09';
    expect(pickDrills(m, 4, banks, '2026-01-10').every(d => d.topic === 'g-a1-negation')).toBe(true);
    expect(pickDrills(m, 4, {}, '2026-01-10')).toEqual([]);
  });

  it('is empty when nothing has been taught', () => {
    expect(pickDrills(at(4), 4, banks, '2026-01-10')).toEqual([]);
  });

  it('never starves a concept, however many are in the air', () => {
    // The sitting has fewer slots than there are concepts, so no single sitting can ask
    // about all of them. Over days it has to, because a concept that is never asked is never
    // answered, and one that is never answered can never be mastered or make way for the
    // next — the strand would simply stop, with no error anywhere to say so.
    const ids = ['g-a1-etre-avoir', 'g-a1-negation', 'g-a2-partitif', 'g-a1-questions',
      'g-a1-articles', 'g-b1-relatifs'];
    const starved: string[] = [];
    for (let topics = 1; topics <= ids.length; topics++) {
      const m = at(4);
      ids.slice(0, topics).forEach((id, k) => markCourseDone(m, id, `2026-01-0${k + 1}`));
      const live = learningTopics(m);
      const deep: Record<string, GrammarDrill[]> = {};
      for (const id of live) deep[id] = bank(id, 12);
      for (let n = 1; n <= 6; n++) {
        for (const rounds of [[0], [0, 1], [0, 1, 2]]) {
          const seen: Record<string, number> = {};
          for (const id of live) seen[id] = 0;
          for (let day = 2; day < 60; day++) {
            const iso = '2026-02-' + String(day).padStart(2, '0');
            for (const round of rounds) {
              for (const d of pickDrills(m, n, deep, iso, round)) seen[d.topic]++;
            }
          }
          for (const id of live) {
            if (!seen[id]) starved.push(`${id} with ${topics} topics, n=${n}, ${rounds.length}/day`);
          }
        }
      }
    }
    expect(starved).toEqual([]);
  });
});

describe('interleave', () => {
  const cards = (n: number) => Array.from({ length: n }, (_, i) => 'c' + i);

  it('never opens on an exercise and never puts two in a row', () => {
    // Every sitting size a deck can produce, against every exercise count drillCount can
    // ask for at that size. The guarantee is only meaningful over the reachable domain —
    // and drillCount is what keeps the domain reachable, by never asking for more
    // exercises than there are cards.
    const bad: string[] = [];
    for (let n = 1; n <= 40; n++) {
      for (const pct of [15, 25, 40, 100]) {
        const d = drillCount({ grammarShare: pct }, n);
        const out = interleave(cards(n), Array.from({ length: d }, (_, i) => 'gx:' + i));
        if (out.length !== n + d) bad.push(`length n=${n} pct=${pct}`);
        if (out[0] !== 'c0') bad.push(`opens on an exercise n=${n} pct=${pct}`);
        for (let i = 1; i < out.length; i++) {
          if (out[i].startsWith('gx:') && out[i - 1].startsWith('gx:')) {
            bad.push(`adjacent n=${n} pct=${pct} at ${i}`);
            break;
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps every card and every exercise, in their own order', () => {
    const out = interleave(cards(10), ['gx:0', 'gx:1', 'gx:2']);
    expect(out.filter(x => !x.startsWith('gx:'))).toEqual(cards(10));
    expect(out.filter(x => x.startsWith('gx:'))).toEqual(['gx:0', 'gx:1', 'gx:2']);
  });

  it('spreads them out rather than bunching them at one end', () => {
    const out = interleave(cards(16), ['gx:0', 'gx:1', 'gx:2', 'gx:3']);
    const at = out.map((x, i) => [x, i] as const).filter(([x]) => x.startsWith('gx:')).map(([, i]) => i);
    expect(Math.min(...at)).toBeGreaterThan(1);
    expect(Math.max(...at)).toBeGreaterThan(out.length - 6);
  });

  it('handles the degenerate ends', () => {
    expect(interleave([], ['gx:0'])).toEqual(['gx:0']);
    expect(interleave(cards(3), [])).toEqual(cards(3));
    expect(interleave(cards(1), ['gx:0', 'gx:1'])).toEqual(['c0', 'gx:0', 'gx:1']);
  });
});

describe('checkAnswer', () => {
  it('accepts what a keyboard decides and the learner did not', () => {
    expect(checkAnswer('  J’ai mangé. ', "j'ai mangé")).toBe('right');
    expect(checkAnswer("J'AI  MANGÉ", 'j’ai mangé')).toBe('right');
  });

  it('accepts a ligature spelled out, which is the only way most keyboards can', () => {
    expect(checkAnswer('coeur', 'cœur')).toBe('right');
    expect(checkAnswer('sœur', 'soeur')).toBe('right');
    expect(checkAnswer('un oeuf', 'un œuf')).toBe('right');
  });

  it('calls a missing accent a missing accent, not a wrong answer', () => {
    expect(checkAnswer("j'ai mange", "j'ai mangé")).toBe('accent');
    expect(checkAnswer('repondu', 'répondu')).toBe('accent');
    expect(checkAnswer('etudie', 'étudié')).toBe('accent');
  });

  it('is not forgiving where the accent is the whole word', () => {
    // « a » and « à » are a verb and a preposition, « ou » and « où » are "or" and "where".
    // Telling the learner they were "almost right, mind the accent" would teach them the one
    // thing least true about the pair.
    expect(checkAnswer('ou', 'où')).toBe('wrong');
    expect(checkAnswer('a', 'à')).toBe('wrong');
    expect(checkAnswer('là', 'la')).toBe('wrong');
    expect(checkAnswer('sur', 'sûr')).toBe('wrong');
    // …and still right when it IS the word asked for.
    expect(checkAnswer('où', 'où')).toBe('right');
  });

  it('rejects a different word and an empty answer', () => {
    expect(checkAnswer("je suis mangé", "j'ai mangé")).toBe('wrong');
    expect(checkAnswer('', 'du')).toBe('wrong');
    expect(checkAnswer('   ', 'du')).toBe('wrong');
  });
});

/* The settings' reorder, tested against the helper it is built on: the stored order is the
 * queue as shown, cut off after the moved concept. The Settings component itself is JSX and
 * these tests run in node, so the arithmetic is exercised here rather than through the UI. */
describe('reordering the queue', () => {
  /** What Settings' `move` does, in one line, against the same helpers. */
  const move = (m: Memory, id: string, by: number) => {
    const ranked = grammarQueue(m).map(c => c.id);
    const i = ranked.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ranked.length) return;
    [ranked[i], ranked[j]] = [ranked[j], ranked[i]];
    grammarState(m).order = ranked.slice(0, Math.max(i, j) + 1);
  };

  it('moves one place and pins only what is above the move', () => {
    const m = at(4);
    const before = grammarQueue(m).map(c => c.id);
    move(m, before[3], -1);
    const after = grammarQueue(m).map(c => c.id);
    expect(after[2]).toBe(before[3]);
    expect(after[3]).toBe(before[2]);
    expect(grammarState(m).order).toHaveLength(4);      // the tail is still ranked, not frozen
    expect(after.slice(4)).toEqual(before.slice(4));
  });

  it('leaves the queue alone at either end', () => {
    const m = at(4);
    const before = grammarQueue(m).map(c => c.id);
    move(m, before[0], -1);
    expect(grammarQueue(m).map(c => c.id)).toEqual(before);
    move(m, before[before.length - 1], 1);
    expect(grammarQueue(m).map(c => c.id)).toEqual(before);
  });

  it('survives a round trip', () => {
    const m = at(4);
    const before = grammarQueue(m).map(c => c.id);
    move(m, before[2], 1);
    move(m, before[2], -1);
    expect(grammarQueue(m).map(c => c.id)).toEqual(before);
  });

  it('lets a newly failed cell climb into the unpinned tail', () => {
    const m = at(4);
    const before = grammarQueue(m).map(c => c.id);
    move(m, before[1], -1);                              // pin the first two
    const late = before[before.length - 1];
    m.comp = { [late]: { status: 'ko', lastSeen: '2026-02-01' } };
    const after = grammarQueue(m).map(c => c.id);
    expect(after.slice(0, 2)).toEqual([before[1], before[0]]);   // the pin held
    expect(after[2]).toBe(late);                                 // and the gap still rose
  });
});

describe('drill ids', () => {
  it('round-trip through the queue and reject anything else', () => {
    expect(isDrillId(drillId(3))).toBe(true);
    expect(drillIndex(drillId(3))).toBe(3);
    expect(isDrillId('c4k9x2a')).toBe(false);
    expect(drillIndex('c4k9x2a')).toBe(-1);
    expect(drillIndex('gx:nope')).toBe(-1);
  });
});

/* The queue is recomputed from scratch on every render — it is a reading of the competency
 * matrix, not a stored list. These are the things that must survive that recomputation. */
describe('what a recompute must not disturb', () => {
  /** What Mémoire's reorder arrows do. */
  const move = (m: Memory, id: string, by: number) => {
    const ranked = grammarQueue(m).map(c => c.id);
    const i = ranked.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ranked.length) return;
    [ranked[i], ranked[j]] = [ranked[j], ranked[i]];
    grammarState(m).order = ranked.slice(0, Math.max(i, j) + 1);
  };

  it('a mastered concept never returns to the queue, whatever the matrix then says', () => {
    const m = at(4);
    markCourseDone(m, 'g-a2-partitif', '2026-01-01');
    grammarState(m).topics['g-a2-partitif'].masteredAt = '2026-01-05';
    // The worst thing the matrix could do: a later call says the cell is failing again.
    m.comp = { 'g-a2-partitif': { status: 'ko', lastSeen: '2026-03-01' } };
    expect(grammarQueue(m).map(c => c.id)).not.toContain('g-a2-partitif');
    expect(grammarFocus(m)?.item.id).not.toBe('g-a2-partitif');
    expect(learningTopics(m)).not.toContain('g-a2-partitif');
    // And it is still there in the finished list, with the day it was finished.
    expect(grammarState(m).topics['g-a2-partitif'].masteredAt).toBe('2026-01-05');
  });

  it('the student order survives the matrix changing underneath it', () => {
    const m = at(4);
    const before = grammarQueue(m).map(c => c.id);
    move(m, before[3], -1);                                   // pull the fourth up one
    const pinned = grammarQueue(m).map(c => c.id).slice(0, 4);
    // A call now reports the LAST concept in the library as failing outright.
    m.comp = { [before[before.length - 1]]: { status: 'ko', lastSeen: '2026-03-01' } };
    const after = grammarQueue(m).map(c => c.id);
    expect(after.slice(0, 4)).toEqual(pinned);                // the student's order held
    expect(after[4]).toBe(before[before.length - 1]);         // the new gap rose beneath it
  });

  it('teaching the head of the queue leaves the rest of the order alone', () => {
    const m = at(4);
    const before = grammarQueue(m).map(c => c.id);
    move(m, before[3], -1);
    const pinned = grammarQueue(m).map(c => c.id).slice(0, 4);
    markCourseDone(m, pinned[0], '2026-02-01');               // the student takes the lesson
    expect(grammarQueue(m).map(c => c.id).slice(0, 3)).toEqual(pinned.slice(1));
    expect(grammarState(m).order).not.toContain(pinned[0]);   // and it is off the order list
  });

  it('marking done by hand, and skipping, take the concept out of the order too', () => {
    const m = at(4);
    const before = grammarQueue(m).map(c => c.id);
    move(m, before[3], -1);
    const st = grammarState(m);
    st.topics[before[0]] = { courseAt: '', days: [], masteredAt: '2026-02-01', manual: 1 };
    st.order = st.order.filter(x => x !== before[0]);
    st.skipped = [before[1]];
    st.order = st.order.filter(x => x !== before[1]);
    const after = grammarQueue(m).map(c => c.id);
    expect(after).not.toContain(before[0]);
    expect(after).not.toContain(before[1]);
    expect(st.order.every(id => after.includes(id))).toBe(true);   // no ghosts left behind
  });

  it('a level drop parks a pinned concept rather than losing where it was', () => {
    const m = at(4);                                          // B1
    const b1 = grammarQueue(m).find(c => c.band === 'B1')!;
    move(m, b1.id, -1);
    expect(grammarState(m).order).toContain(b1.id);
    m.cefr.overall = 2;                                       // back to A2 after a bad week
    expect(grammarQueue(m).map(c => c.id)).not.toContain(b1.id);
    m.cefr.overall = 4;                                       // and back up again
    expect(grammarQueue(m).map(c => c.id)).toContain(b1.id);
  });
});

/* A blank has to be answerable from what is on the screen. « Je ___ connais » has four
 * defensible answers until something says whose neighbour is meant — so a short answer,
 * which is to say a function word, has to arrive with the cue that pins it down. */
describe('an exercise the learner can actually answer', () => {
  const gap = (over: Partial<GrammarDrill> = {}): GrammarDrill => ({
    topic: 'g-a2-cod-coi', kind: 'gap', prompt: 'Setze ein.',
    text: 'Je ___ connais.', cue: 'ersetzt « ma voisine »', options: [], answer: 'la', explain: 'e', ...over
  });

  it('keeps a short answer that says what it is replacing', () => {
    expect(usableDrill(gap())).toBe(true);
  });

  it('drops a short answer with nothing to go on', () => {
    expect(usableDrill(gap({ cue: '' }))).toBe(false);
    expect(usableDrill(gap({ cue: '   ' }))).toBe(false);
  });

  it('asks nothing extra of an answer its own sentence pins down', () => {
    // A content word is findable from the sentence; a pronoun is not.
    expect(usableDrill(gap({ text: 'Hier, j’ai ___ au parc.', answer: 'marché', cue: '' }))).toBe(true);
  });

  it('leaves multiple choice alone — its answer is on the screen among the options', () => {
    expect(usableDrill(gap({ kind: 'choice', cue: '', options: ['la', 'le', 'lui'] }))).toBe(true);
  });

  it('holds a lesson step to the same rule', () => {
    const step = (over: Record<string, unknown> = {}) => ({
      kind: 'gap' as const, prompt: 'p', examples: [], viz: {} as never, options: [], correct: 0,
      text: 'Je ___ connais.', cue: 'ersetzt « ma voisine »', answer: 'la', lines: [], explain: 'e', ...over
    });
    expect(usableStep(step())).toBe(true);
    expect(usableStep(step({ cue: '' }))).toBe(false);
    // …unless the sentences above it already supply the context.
    expect(usableStep(step({ cue: '', examples: [{ t: 'Je connais ma voisine.', gloss: 'x' }] }))).toBe(true);
  });
});

/* Where the line between "you missed an accent" and "you wrote another word" falls is a
 * fact about the language, and it is read off the pack (lang/types AnswerRules). */
describe('marking an answer in each language', () => {
  it('forgives a slipped accent everywhere it really is one', () => {
    expect(checkAnswer('mange', 'mangé', 'fr')).toBe('accent');
    expect(checkAnswer('rapido', 'rápido', 'es')).toBe('accent');
    expect(checkAnswer('perche', 'perché', 'it')).toBe('accent');
    expect(checkAnswer('portugues', 'português', 'pt')).toBe('accent');
  });

  it('will not call ñ an accent, because « ano » is not a near miss for « año »', () => {
    expect(checkAnswer('ano', 'año', 'es')).toBe('wrong');
    expect(checkAnswer('manana', 'mañana', 'es')).toBe('wrong');
    expect(checkAnswer('año', 'año', 'es')).toBe('right');
    // …while an ordinary Spanish accent is still forgiven on the same word.
    expect(checkAnswer('anos', 'años', 'es')).toBe('wrong');
  });

  it('knows each language’s pairs that are two different words', () => {
    expect(checkAnswer('el', 'él', 'es')).toBe('wrong');     // the / he
    expect(checkAnswer('tu', 'tú', 'es')).toBe('wrong');     // your / you
    expect(checkAnswer('e', 'è', 'it')).toBe('wrong');       // and / is
    expect(checkAnswer('da', 'dà', 'it')).toBe('wrong');     // from / gives
    expect(checkAnswer('por', 'pôr', 'pt')).toBe('wrong');   // for / to put
    expect(checkAnswer('a', 'à', 'fr')).toBe('wrong');       // has / to
  });

  it('does not carry one language’s pairs into another', () => {
    // « e » and « è » are two words in Italian; in Portuguese « e »/« é » is the pair, and
    // in French neither is a word of that shape at all.
    expect(checkAnswer('e', 'é', 'pt')).toBe('wrong');
    expect(checkAnswer('la', 'là', 'it')).toBe('wrong');
    expect(checkAnswer('cote', 'côte', 'fr')).toBe('wrong');
    expect(checkAnswer('cote', 'côte', 'pt')).toBe('accent');   // not a pair in Portuguese
  });

  it('has nothing to forgive in English', () => {
    expect(checkAnswer('have', 'have', 'en')).toBe('right');
    expect(checkAnswer('hav', 'have', 'en')).toBe('wrong');
  });
});
