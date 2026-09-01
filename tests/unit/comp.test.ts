import { describe, expect, it } from 'vitest';
import type { Analysis } from '../../src/types';
import { COMP_BY_ID, COMP_LIB, compLibForAnalysis, probeTargets } from '../../src/lib/competencies';
import { focusTargets } from '../../src/lib/focus';
import { applyAnalysis } from '../../src/lib/merge';
import { buildTutorPrompt } from '../../src/lib/prompts';
import { seedMem } from '../../src/lib/seed';
import { blankMem } from '../../src/lib/storage';

const an = (o: Partial<Analysis> = {}): Analysis => ({
  hauptpunkt: 'x', kommentar: 'x',
  cefr: { overall: 'A2', grammar: 'A2', vocabulary: 'A2', fluency: 'A2', comprehension: 'A2', confidence: 0.5, begruendung: '' },
  corrections: [], highlights: [], new_vocab: [], weaknesses: [], strengths: [],
  interests: [], facts: [], targets: [], next_focus: [], topics: [],
  prune: { facts: [], interests: [] }, competencies: [], ...o
});
const meta = { topic: 'T', targets: [], transcript: [{ role: 'user' as const, text: 'Bonjour tout le monde.' }], seconds: 240 };

describe('competency library', () => {
  it('covers every band and category with unique ids', () => {
    const ids = new Set(COMP_LIB.map(c => c.id));
    expect(ids.size).toBe(COMP_LIB.length);
    for (const b of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      for (const cat of ['grammaire', 'vocabulaire', 'fonctions']) {
        expect(COMP_LIB.some(c => c.band === b && c.cat === cat)).toBe(true);
      }
    }
  });
  it('exposes only bands up to current+1 to the analysis', () => {
    const m = blankMem(); // A2 → up to B1
    const lib = compLibForAnalysis(m);
    expect(lib.some(c => c.band === 'B1')).toBe(true);
    expect(lib.some(c => c.band === 'B2')).toBe(false);
  });
});

describe('applyAnalysis fills matrix cells', () => {
  it('maps demonstrated/failed/partial onto ok/ko/partial, latest wins', () => {
    const m = blankMem();
    applyAnalysis(m, an({
      competencies: [
        { id: 'g-a1-negation', label: 'négation', category: 'grammaire', cefr: 'A1', status: 'demonstrated', evidence: 'je ne sais pas' },
        { id: 'g-a2-passe-compose', label: 'passé composé', category: 'grammaire', cefr: 'A2', status: 'failed', evidence: 'je suis mangé' },
        { id: null, label: 'île C1', category: 'fonctions', cefr: 'C1', status: 'demonstrated', evidence: 'x' } // no cell
      ]
    }), meta);
    expect(m.comp['g-a1-negation'].status).toBe('ok');
    expect(m.comp['g-a2-passe-compose'].status).toBe('ko');
    expect(Object.keys(m.comp)).toHaveLength(2);

    applyAnalysis(m, an({
      competencies: [{ id: 'g-a2-passe-compose', label: 'passé composé', category: 'grammaire', cefr: 'A2', status: 'demonstrated', evidence: 'mieux' }]
    }), meta);
    expect(m.comp['g-a2-passe-compose'].status).toBe('ok');
  });

  it('clears pinned cells after the call', () => {
    const m = blankMem();
    m.pinned = ['g-a2-cod-coi'];
    applyAnalysis(m, an(), meta);
    expect(m.pinned).toEqual([]);
  });
});

describe('probeTargets', () => {
  it('pins first, then grey cells from lower bands', () => {
    const m = seedMem('X'); // A2, several A1/A2 cells filled by the seed
    m.cefr.overall = 4;     // B1: lower bands = A1 + A2
    m.pinned = ['g-b1-subjonctif-base'];
    const t = probeTargets(m, 2);
    expect(t[0].id).toBe('g-b1-subjonctif-base');
    expect(t.length).toBe(2);
    // the non-pinned probe is a grey lower-band cell
    expect(['A1', 'A2']).toContain(t[1].band);
    expect(m.comp[t[1].id]).toBeUndefined();
  });

  it('never proposes cells that already have data', () => {
    const m = seedMem('X');
    for (const t of probeTargets(m, 3)) expect(m.comp[t.id]).toBeUndefined();
  });
});

describe('pinned cells drive the next call', () => {
  it('focusTargets puts pinned competencies first', () => {
    const m = seedMem('X');
    m.pinned = ['g-a2-partitif'];
    const t = focusTargets(m, 3);
    expect(t[0].kind).toBe('comp');
    expect(t[0].label).toBe(COMP_BY_ID['g-a2-partitif'].label);
    expect(t.length).toBe(3);
  });

  it('the briefing lists probes in the sondage block', () => {
    const m = seedMem('X');
    m.pinned = ['g-a2-partitif'];
    const p = buildTutorPrompt(m, { topic: 'x', targets: [], minutes: 8 });
    expect(p).toContain('Sondage discret');
    expect(p).toContain(COMP_BY_ID['g-a2-partitif'].label);
  });
});
