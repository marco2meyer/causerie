import { describe, expect, it } from 'vitest';
import type { Memory } from '../../src/types';
import { migrate, blankMem } from '../../src/lib/storage';
import { applyAnalysis } from '../../src/lib/merge';
import { inIntroPhase, touchStreak } from '../../src/lib/gamify';
import { suggestTopics } from '../../src/lib/topics';
import { seedMem } from '../../src/lib/seed';
import { todayISO } from '../../src/lib/utils';
import { buildTutorPrompt, DEFAULT_TUTOR_TEMPLATE, resolveTemplate } from '../../src/lib/prompts';

const an = (o: Partial<import('../../src/types').Analysis> = {}) => ({
  hauptpunkt: 'x', kommentar: 'x',
  cefr: { overall: 'A2' as const, grammar: 'A2' as const, vocabulary: 'A2' as const, fluency: 'A2' as const, comprehension: 'A2' as const, confidence: 0.5, begruendung: '' },
  corrections: [], highlights: [], new_vocab: [], weaknesses: [], strengths: [],
  interests: [], facts: [], targets: [], next_focus: [], topics: [],
  prune: { facts: [], interests: [] }, competencies: [], ...o
});
const meta = { topic: 'T', targets: [], transcript: [{ role: 'user' as const, text: 'Bonjour tout le monde.' }], seconds: 240 };

describe('v1 → v2 migration', () => {
  it('upgrades a v1 memory in place, keeping data and adding deck/facts', () => {
    const v1 = { ...blankMem(), v: 1 } as unknown as Record<string, unknown>;
    delete v1.deck; delete v1.facts;
    (v1 as { xp: number }).xp = 77;
    const m = migrate(v1);
    expect(m?.v).toBe(2);
    expect(m?.xp).toBe(77);
    expect(m?.deck.cards).toEqual([]);
    expect(m?.facts).toEqual([]);
    expect(m?.settings.sessionSize).toBe(blankMem().settings.sessionSize);
  });
  it('rejects garbage', () => {
    expect(migrate({ hello: 1 })).toBeNull();
    expect(migrate(null)).toBeNull();
  });
});

describe('facts memory', () => {
  it('adds revealed facts and refreshes repeats instead of duplicating', () => {
    const m = blankMem();
    applyAnalysis(m, an({ facts: [{ text: 'A un chien qui s’appelle Milo', category: 'familie' }] }), meta);
    applyAnalysis(m, an({ facts: [{ text: 'a un chien qui s’appelle Milo', category: 'familie' }, { text: 'Travaille dans une université', category: 'arbeit' }] }), meta);
    expect(m.facts).toHaveLength(2);
    expect(m.facts[0].firstSaid).toBe(m.facts[0].lastSaid);
  });
});

describe('cards land in the deck after a call', () => {
  const call = () => an({
    corrections: [{ user_turn: 0, original: 'o', besser: 'La phrase corrigée.', erklaerung: 'e', category: 'grammar', cefr_topic: 't', cloze_text: 'La ___ corrigée.', cloze_answer: 'phrase', hint: 'h' }],
    new_vocab: [{ fr: 'le quai', de: 'der Bahnsteig', ex: 'Le train est au quai.' }]
  });

  it('stores cardsAdded on the session record', () => {
    const m = blankMem();              // A2 by default
    const rec = applyAnalysis(m, call(), meta);
    expect(rec.cardsAdded).toBe(2);
    expect(m.deck.cards).toHaveLength(2);
  });

  it('asks an A2 learner to produce the word, never to recognise it', () => {
    const m = blankMem();
    applyAnalysis(m, call(), meta);
    expect(m.deck.cards.map(c => c.type).sort()).toEqual(['cloze', 'de2fr']);
    const prod = m.deck.cards.find(c => c.type === 'de2fr')!;
    expect(prod.front).toBe('der Bahnsteig');
    expect(prod.back).toBe('le quai');
    // Nothing is waiting ten days behind it any more, so it starts now.
    expect(prod.due).toBe(todayISO());
  });

  it('still gives a beginner both directions', () => {
    const m = blankMem();
    m.cefr.overall = 0;                // A1
    applyAnalysis(m, call(), meta);
    expect(m.deck.cards.map(c => c.type).sort()).toEqual(['cloze', 'de2fr', 'fr2de']);
  });

  it('retires the recognition cards on the way past A2, once', () => {
    const m = blankMem();
    m.cefr.overall = 0;
    applyAnalysis(m, call(), meta);
    const recog = m.deck.cards.find(c => c.type === 'fr2de')!;
    expect(recog.state).toBe('new');

    m.cefr.overall = 3;                // crossed into A2+
    applyAnalysis(m, an(), meta);
    // Removed rather than shelved: the paused shelf is gone from the deck screen, and a
    // card nobody can see, review or restore was not being kept, only hidden.
    expect(m.deck.cards.find(c => c.id === recog.id)).toBeUndefined();
    // The word is still covered — its production card is untouched.
    expect(m.deck.cards.some(c => c.type === 'de2fr')).toBe(true);

    // …and it happens once: a later call at the same level takes nothing else away.
    const after = m.deck.cards.length;
    applyAnalysis(m, an(), meta);
    expect(m.deck.cards.filter(c => c.type === 'fr2de')).toHaveLength(0);
    expect(m.deck.cards.length).toBeGreaterThanOrEqual(after);
  });
});

describe('intro phase', () => {
  it('lasts three causerie calls unless imported or skipped', () => {
    const m = blankMem();
    expect(inIntroPhase(m)).toBe(true);
    for (let i = 0; i < 3; i++) applyAnalysis(m, an(), meta);
    expect(inIntroPhase(m)).toBe(false);
    const s = seedMem('X');
    expect(inIntroPhase(s)).toBe(false); // Duolingo import establishes the baseline
  });
});

describe('streak counts either activity once per day', () => {
  it('does not double-count and resets after a gap', () => {
    const m = blankMem();
    touchStreak(m, '2026-08-15');
    touchStreak(m, '2026-08-15');
    expect(m.streak.count).toBe(1);
    touchStreak(m, '2026-08-16');
    expect(m.streak.count).toBe(2);
    touchStreak(m, '2026-08-19');
    expect(m.streak.count).toBe(1);
  });
});

describe('topic suggestions', () => {
  it('leads with interests, skips the last two call topics, and stays near the level', () => {
    const m: Memory = seedMem('X');
    m.sessions.push({ id: 's1', date: '2026-08-16', topic: 'Les grands arbres anciens', source: 'causerie', minutes: 4 });
    const s = suggestTopics(m);
    expect(s.length).toBeGreaterThan(5);
    expect(s.find(x => x.t === 'Les grands arbres anciens')).toBeUndefined();
    expect(s[0].kind).toBe('interest');
    expect(s.filter(x => x.kind === 'level').every(x => ['A1', 'A2', 'B1'].includes(x.lv))).toBe(true);
  });
});

describe('tutor briefing', () => {
  it('is French, includes facts, length and the topic-change invitation', () => {
    const m = seedMem('Marco');
    const p = buildTutorPrompt(m, { topic: 'La cuisine', targets: [], minutes: 4 });
    expect(p).toContain('réserve naturelle');       // fact from the app
    expect(p).toContain('environ 4 minutes');
    expect(p).toContain("s'il préfère parler d'autre chose");
    expect(p).toContain('micro');                    // who does the talking, rule one
    expect(p).not.toMatch(/[A-Za-z]*(ä|ö|ü|ß)[A-Za-z]*/); // no German leaks
  });

  it('draws name, native language and level from the profile', () => {
    const m = seedMem('Marco');
    m.profile.native = 'en';
    const p = buildTutorPrompt(m, { topic: 'x', targets: [], minutes: 4 });
    expect(p).toContain('Marco');
    expect(p).toContain('anglais');
    expect(p).toContain('A2'); // level from mem.cefr, not hardcoded
  });

  it('marks the level as being established during the intro phase', () => {
    const m = blankMem();
    m.profile.name = 'Nino';
    const p = buildTutorPrompt(m, { topic: 'x', targets: [], mode: 'intro' });
    expect(p).toContain("en cours d'évaluation");
    expect(p).toContain('faire connaissance');
    expect(p).toContain('Sonder son niveau');
    expect(p).not.toContain('Sujet proposé');
  });

  it('injects today’s dynamic topic into the daily block', () => {
    const m = seedMem('Marco');
    const p = buildTutorPrompt(m, { topic: 'Les ponts', topicFr: 'les ponts de Paris', targets: [], minutes: 3 });
    expect(p).toContain('Sujet proposé : les ponts de Paris');
    expect(p).not.toContain('Beispiel');
  });

  it('lists focus targets from the app state', () => {
    const m = seedMem('Marco');
    const p = buildTutorPrompt(m, {
      topic: 'x', targets: [{ kind: 'weakness', id: 'w1', label: 'Pronoms objets le / la / les', cefr: 'A2', status: 'new' }], minutes: 4
    });
    expect(p).toContain('1. Pronoms objets le / la / les');
  });

  it('uses a custom template when the user edited it', () => {
    const m = seedMem('Marco');
    m.tutorTemplate = 'Salut {{name}}, niveau {{niveau}}, sujet: {{aujourdhui}}';
    const p = buildTutorPrompt(m, { topic: 'La mer', topicFr: 'la mer', targets: [], minutes: 4 });
    expect(p.startsWith('Salut Marco, niveau A2')).toBe(true);
    expect(p).toContain('la mer');
    expect(p).not.toContain('La règle du micro');
  });
});

describe('resolveTemplate', () => {
  it('replaces known placeholders and leaves unknown ones intact', () => {
    expect(resolveTemplate('a {{x}} b {{y}} c {{z}}', { x: '1', y: '2' })).toBe('a 1 b 2 c {{z}}');
  });
  it('default template references every placeholder it needs', () => {
    for (const v of ['name', 'native', 'langue', 'niveau', 'aujourdhui', 'objectifs', 'faits', 'interets', 'faiblesses', 'passe']) {
      expect(DEFAULT_TUTOR_TEMPLATE).toContain('{{' + v + '}}');
    }
  });
});
