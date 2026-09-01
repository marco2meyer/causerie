import { describe, expect, it } from 'vitest';
import type { Analysis, Memory } from '../../src/types';
import { blankMem } from '../../src/lib/storage';
import { applyAnalysis, smooth } from '../../src/lib/merge';
import { todayISO } from '../../src/lib/utils';

function baseAnalysis(over: Partial<Analysis> = {}): Analysis {
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

const meta = (seconds = 300) => ({
  topic: 'Test',
  targets: [],
  transcript: [
    { role: 'assistant' as const, text: 'Salut.' },
    { role: 'user' as const, text: 'Bonjour, je vais bien.' }
  ],
  seconds
});

/** Fast-forward past the establishment phase: three speech sessions already stored. */
function pastIntro(m: Memory): void {
  for (let i = 0; i < 3; i++) {
    m.sessions.push({
      id: 'sess-' + i, date: todayISO(), topic: 't', source: 'causerie', minutes: 4,
      transcript: [{ role: 'user', text: 'Bonjour, je vais bien.' }], analysis: null
    });
  }
}

describe('smooth', () => {
  it('moves partway toward the new estimate, more with confidence', () => {
    expect(smooth(2, 6, 0)).toBe(3);      // 25 % of the gap
    expect(smooth(2, 6, 1)).toBe(4);      // 60 % of the gap
    expect(smooth(5, 5, 0.8)).toBe(5);
  });
  it('clamps to the scale', () => {
    expect(smooth(0, -10, 1)).toBe(0);
    expect(smooth(11, 30, 1)).toBe(11);
  });
});

describe('applyAnalysis', () => {
  it('creates new weaknesses and matches repeats by label, upgrading to persisting', () => {
    const m = blankMem();
    applyAnalysis(m, baseAnalysis({
      weaknesses: [{ id: null, label: 'Négation avec jamais + de', cefr: 'A2', status: 'new', evidence: 'x' }]
    }), meta());
    expect(m.weaknesses).toHaveLength(1);
    expect(m.weaknesses[0].status).toBe('new');

    applyAnalysis(m, baseAnalysis({
      weaknesses: [{ id: null, label: 'négation avec jamais + de', cefr: 'A2', status: 'new', evidence: 'y' }]
    }), meta());
    expect(m.weaknesses).toHaveLength(1);
    expect(m.weaknesses[0].status).toBe('persisting');
    expect(m.weaknesses[0].evidence).toHaveLength(2);
  });

  it('matches weaknesses by id and caps evidence at 5', () => {
    const m = blankMem();
    applyAnalysis(m, baseAnalysis({
      weaknesses: [{ id: null, label: 'Pronoms objets', cefr: 'A2', status: 'new', evidence: 'e0' }]
    }), meta());
    const id = m.weaknesses[0].id;
    for (let i = 1; i <= 6; i++) {
      applyAnalysis(m, baseAnalysis({
        weaknesses: [{ id, label: 'Pronoms objets', cefr: 'A2', status: 'improving', evidence: 'e' + i }]
      }), meta());
    }
    expect(m.weaknesses).toHaveLength(1);
    expect(m.weaknesses[0].evidence).toHaveLength(5);
    expect(m.weaknesses[0].status).toBe('improving');
  });

  it('dedupes vocab case- and accent-insensitively', () => {
    const m = blankMem();
    applyAnalysis(m, baseAnalysis({ new_vocab: [{ fr: 'la réserve', de: 'x', ex: 'y' }] }), meta());
    applyAnalysis(m, baseAnalysis({ new_vocab: [{ fr: 'La Reserve', de: 'x', ex: 'y' }] }), meta());
    expect(m.vocab).toHaveLength(1);
  });

  it('reinforces mentioned interests and decays unmentioned ones', () => {
    const m = blankMem();
    applyAnalysis(m, baseAnalysis({ interests: ['Les arbres'] }), meta());
    expect(m.interests.find(i => i.label === 'Les arbres')?.weight).toBe(1.5);
    applyAnalysis(m, baseAnalysis({ interests: ['Les arbres', 'La cuisine'] }), meta());
    expect(m.interests.find(i => i.label === 'Les arbres')?.weight).toBe(2.5);
    expect(m.interests.find(i => i.label === 'La cuisine')?.weight).toBe(1.5);
    // Third call mentions neither: both decay ×0.95.
    applyAnalysis(m, baseAnalysis(), meta());
    expect(m.interests.find(i => i.label === 'Les arbres')?.weight).toBeCloseTo(2.38, 2);
  });

  it('drops interests that decay below the floor and honors the cap', () => {
    const m = blankMem();
    m.interests.push({ label: 'Un truc mineur', weight: 0.62, lastSeen: todayISO() });
    applyAnalysis(m, baseAnalysis(), meta());
    expect(m.interests.find(i => i.label === 'Un truc mineur')).toBeUndefined();

    const m2 = blankMem();
    for (let i = 0; i < 15; i++) m2.interests.push({ label: 'i' + i, weight: 5 - i * 0.1, lastSeen: todayISO() });
    applyAnalysis(m2, baseAnalysis(), meta());
    expect(m2.interests.length).toBeLessThanOrEqual(12);
  });

  it('stores facts, refreshes repeats, and prunes on model request', () => {
    const m = blankMem();
    applyAnalysis(m, baseAnalysis({
      facts: [{ text: 'Habite à côté d’une réserve naturelle', category: 'orte' }, { text: 'Aime dessiner des chats', category: 'vorlieben' }]
    }), meta());
    expect(m.facts).toHaveLength(2);
    const catFact = m.facts.find(f => f.text.includes('chats'))!;

    applyAnalysis(m, baseAnalysis({ prune: { facts: [catFact.id], interests: [] } }), meta());
    expect(m.facts).toHaveLength(1);
    expect(m.facts[0].text).toContain('réserve');
  });

  it('prunes interests by label, accent-insensitively', () => {
    const m = blankMem();
    m.interests.push({ label: 'Les randonnées en forêt', weight: 3, lastSeen: todayISO() });
    applyAnalysis(m, baseAnalysis({ prune: { facts: [], interests: ['les randonnees en foret'] } }), meta());
    expect(m.interests.find(i => i.label.includes('randonnées'))).toBeUndefined();
  });

  it('caps stored facts at 40, keeping the most recently said', () => {
    const m = blankMem();
    for (let i = 0; i < 45; i++) {
      m.facts.push({ id: 'f' + i, text: 'fact ' + i, category: 'sonstiges', firstSaid: '2026-01-01', lastSaid: '2026-01-0' + ((i % 9) + 1) });
    }
    applyAnalysis(m, baseAnalysis(), meta());
    expect(m.facts.length).toBeLessThanOrEqual(40);
  });

  it('computes XP and stores the session record', () => {
    const m = blankMem();
    const rec = applyAnalysis(m, baseAnalysis({
      targets: [{ label: 't', achieved: true, evidence: 'x' }],
      highlights: [{ user_turn: 0, quote: 'q', kommentar: 'k' }],
      corrections: [{ user_turn: 0, original: 'a', besser: 'b', erklaerung: 'c', category: 'grammar', cefr_topic: 'x', cloze_text: 'b ___', cloze_answer: 'x', hint: 'h' }]
    }), meta(300));
    // 5 min * 10 + 5 (target) + 2 (highlight) + 1 (correction)
    expect(rec.xp).toBe(58);
    expect(m.xp).toBe(58);
    expect(m.sessions).toHaveLength(1);
    expect(m.sessions[0].analysis?.hauptpunkt).toBe('Test.');
  });

  it('does not move levels when the student said nothing', () => {
    const m = blankMem();
    const before = m.cefr.overall;
    applyAnalysis(m, baseAnalysis({ cefr: { overall: 'C2', grammar: 'C2', vocabulary: 'C2', fluency: 'C2', comprehension: 'C2', confidence: 1, begruendung: 'x' } }), {
      topic: 'Test', targets: [], seconds: 60,
      transcript: [{ role: 'assistant', text: 'Salut.' }]
    });
    expect(m.cefr.overall).toBe(before);
    expect(m.cefr.history).toHaveLength(0);
  });

  it('establishes the level strongly during the first three speech sessions', () => {
    const m = blankMem(); // overall 2 (A2)
    applyAnalysis(m, baseAnalysis({
      cefr: { overall: 'C2', grammar: 'C2', vocabulary: 'C2', fluency: 'C2', comprehension: 'C2', confidence: 0, begruendung: 'x' }
    }), meta());
    // Fixed 60 % pull regardless of confidence: 2 + (10-2)*0.6 = 6.8 → 7.
    // Ordinary smoothing at confidence 0 would only reach 4.
    expect(m.cefr.overall).toBe(7);
    expect(m.cefr.history).toHaveLength(1);
  });

  it('smooths gently by confidence after the establishment phase', () => {
    const m = blankMem();
    pastIntro(m);
    m.cefr.overall = 10;
    Object.keys(m.cefr.skills).forEach(k => (m.cefr.skills[k as keyof typeof m.cefr.skills] = 10));
    applyAnalysis(m, baseAnalysis({
      cefr: { overall: 'A1', grammar: 'A1', vocabulary: 'A1', fluency: 'A1', comprehension: 'A1', confidence: 0, begruendung: 'x' }
    }), meta());
    // 10 + (0-10)*0.25 = 7.5 → 8 (not the 4 an establishment-weight pull would give)
    expect(m.cefr.overall).toBe(8);
  });

  it('updates the streak once per day', () => {
    const m = blankMem();
    applyAnalysis(m, baseAnalysis(), meta());
    expect(m.streak.count).toBe(1);
    expect(m.streak.last).toBe(todayISO());
    applyAnalysis(m, baseAnalysis(), meta());
    expect(m.streak.count).toBe(1); // same day, no double count
  });

  it('keeps at most 5 next_focus suggestions', () => {
    const m = blankMem();
    const nf = Array.from({ length: 8 }, (_, i) => ({ label: 'f' + i, cefr: 'A2' as const, grund: 'g' }));
    applyAnalysis(m, baseAnalysis({ next_focus: nf }), meta());
    expect(m.nextFocus).toHaveLength(5);
  });
});

describe('memory type sanity', () => {
  it('blankMem satisfies the Memory shape', () => {
    const m: Memory = blankMem();
    expect(m.v).toBe(2);
    expect(m.settings.rtModel).toContain('gpt-realtime');
    expect(m.deck.cards).toEqual([]);
    expect(m.facts).toEqual([]);
  });
});
