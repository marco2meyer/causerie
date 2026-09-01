import { describe, expect, it } from 'vitest';
import { seedA0 } from '../../src/lib/a0';
import { changedWords } from '../../src/lib/utils';
import { blankMem } from '../../src/lib/storage';
import { PACKS } from '../../src/lang';

describe('absolute-beginner start', () => {
  it('seeds a survival deck with native glosses, for every language', () => {
    for (const code of ['fr', 'es', 'it', 'pt', 'en'] as const) {
      const m = blankMem();
      seedA0(m, code, 'de');
      expect(m.profile.a0).toBe(true);
      expect(m.deck.cards).toHaveLength(10);
      expect(m.deck.cards.every(c => c.tag === 'A0' && c.state === 'new' && c.audioText)).toBe(true);
      expect(m.deck.cards[0].back).toBe(PACKS[code].starter[0].de);
    }
    const en = blankMem();
    seedA0(en, 'fr', 'en');
    expect(en.deck.cards[1].back).toBe('Thank you very much.');
  });

  it('every pack ships a 10-phrase starter with both glosses', () => {
    for (const p of Object.values(PACKS)) {
      expect(p.starter).toHaveLength(10);
      expect(p.starter.every(s => s.t && s.de && s.en)).toBe(true);
    }
  });
});

describe('changedWords (recast noticing)', () => {
  it('marks only what Odile changed', () => {
    const d = changedWords('Je n’ai pas jamais dessiné un arbre.', 'Je n’ai jamais dessiné d’arbre.');
    const changed = d.filter(t => t.ch).map(t => t.w);
    expect(changed).toContain('d’arbre.');
    expect(d.filter(t => !t.ch).map(t => t.w)).toContain('jamais');
    const same = changedWords('Bonjour.', 'Bonjour.');
    expect(same.every(t => !t.ch)).toBe(true);
  });
});

describe('ear-training phase (A0/A1, first two weeks)', () => {
  it('activates for beginners and progresses through the stages', async () => {
    const { earPhase, earStageFor, buildRounds } = await import('../../src/lib/pron');
    const mk = (daysAgo: number, overall = 0) => ({
      profile: { a0: true }, cefr: { overall },
      createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10)
    });
    expect(earPhase(mk(0))).toBe(true);
    expect(earStageFor(mk(0))).toBe(1);       // isolated word, two voices
    expect(earStageFor(mk(6))).toBe(2);       // all voices
    expect(earStageFor(mk(12))).toBe(3);      // carrier phrase
    expect(earPhase(mk(20))).toBe(false);     // window over
    expect(earPhase(mk(0, 4))).toBe(false);   // B1 never enters the phase
    const r3 = buildRounds('fr', 5, 3, () => 0.4);
    expect(r3.every(r => r.say.includes(r.pair[r.heard]) && r.say.length > r.pair[r.heard].length)).toBe(true);
    const r1 = buildRounds('fr', 8, 1, () => 0.4);
    expect(new Set(r1.map(r => r.voice)).size).toBe(2); // stage 1: two familiar voices
  });
});
