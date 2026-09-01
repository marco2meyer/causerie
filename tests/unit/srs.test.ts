import { describe, expect, it } from 'vitest';
import type { Analysis, Card, Deck } from '../../src/types';
import { MATURE_DAYS, MAX_SESSION_CARDS, buildSession, cardFromCorrection, cardStage, cardsFromAnalysis, dueCounts, findCorrectionCard, findVocabCard, grade, lastKnown, latestBatchIds, newCard, previewDays, retireRecognition, vocabCards } from '../../src/lib/srs';
import { seedMem } from '../../src/lib/seed';

/** Same day arithmetic the scheduler uses, for dating a card forward in a test. */
const addDaysISO = (iso: string, days: number): string => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const todayISO = (): string => new Date().toISOString().slice(0, 10);

const mkCard = (over: Partial<Card> = {}): Card => ({
  ...newCard({ type: 'cloze', front: 'Je n’ai ___ vu.', back: 'jamais', sourceKind: 'seed' }),
  ...over
});

describe('sm-2 grading', () => {
  it('walks 1 → 3 → ease-multiplied days on Good', () => {
    const c = mkCard();
    grade(c, 'good', '2026-08-17');
    expect(c.interval).toBe(1);
    expect(c.due).toBe('2026-08-18');
    grade(c, 'good', '2026-08-18');
    expect(c.interval).toBe(3);
    grade(c, 'good', '2026-08-21');
    expect(c.interval).toBe(Math.round(3 * 2.5));
    expect(c.state).toBe('review');
  });

  it('Again resets reps, counts a lapse, lowers ease, requeues today', () => {
    const c = mkCard();
    grade(c, 'good', '2026-08-17');
    grade(c, 'again', '2026-08-18');
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(1);
    expect(c.ease).toBeCloseTo(2.3);
    expect(c.due).toBe('2026-08-18');
  });

  it('Easy grows faster and raises ease; ease never drops below 1.3', () => {
    const c = mkCard();
    grade(c, 'easy', '2026-08-17');
    expect(c.interval).toBe(3);
    expect(c.ease).toBeCloseTo(2.65);
    const d = mkCard({ ease: 1.35 });
    grade(d, 'again');
    expect(d.ease).toBe(1.3);
  });

  it('previews intervals without mutating', () => {
    const c = mkCard();
    expect(previewDays(c, 'good')).toBe(1);
    expect(previewDays(c, 'again')).toBe(0);
    expect(c.reps).toBe(0);
  });

  it('a lapse keeps half the interval; the relearn pass restores it', () => {
    const c = mkCard({ state: 'review', interval: 30, reps: 6, due: '2026-08-17' });
    grade(c, 'again', '2026-08-17');
    expect(c.interval).toBe(15);       // half kept, not a reset to zero
    expect(c.state).toBe('learning');
    expect(c.due).toBe('2026-08-17');  // requeued within the session
    grade(c, 'good', '2026-08-17');
    expect(c.interval).toBe(15);       // back at the kept interval, no ease jump
    expect(c.state).toBe('review');
    expect(c.due).toBe('2026-09-01');
  });
});

describe('session building', () => {
  it('puts overdue reviews before new cards and respects caps', () => {
    const deck = { cards: [] as Card[], log: [] };
    for (let i = 0; i < 10; i++) deck.cards.push(mkCard({ id: 'n' + i, front: 'neu ' + i, createdAt: '2026-08-0' + ((i % 9) + 1), due: '2026-08-01' }));
    for (let i = 0; i < 8; i++) deck.cards.push(mkCard({ id: 'd' + i, front: 'due ' + i, state: 'review', due: '2026-08-1' + (i % 5) }));
    deck.cards.push(mkCard({ id: 'future', state: 'review', due: '2099-01-01' }));
    const q = buildSession(deck, 15, 5, '2026-08-17');
    expect(q).toHaveLength(13); // 8 due + 5 new
    expect(q.slice(0, 8).every(c => c.id.startsWith('d'))).toBe(true);
    expect(q.find(c => c.id === 'future')).toBeUndefined();
    expect(q.find(c => c.id === 'susp')).toBeUndefined();
    expect(buildSession(deck, 10, 5, '2026-08-17')).toHaveLength(10);
  });

  it('counts due/new/total without suspended cards', () => {
    const m = seedMem('T');
    const c = dueCounts(m.deck, '2026-08-17');
    expect(c.total).toBe(12);
    expect(c.fresh).toBe(12);
    expect(c.due).toBe(0);
  });
});

describe('cardsFromAnalysis', () => {
  const an = (o: Partial<Analysis>): Analysis => ({
    hauptpunkt: '', kommentar: '',
    cefr: { overall: 'A2', grammar: 'A2', vocabulary: 'A2', fluency: 'A2', comprehension: 'A2', confidence: 0.5, begruendung: '' },
    corrections: [], highlights: [], new_vocab: [], weaknesses: [], strengths: [],
    interests: [], facts: [], targets: [], next_focus: [], topics: [],
    prune: { facts: [], interests: [] }, competencies: [], ...o
  });
  const corr = (n: number): Analysis['corrections'][number] => ({
    user_turn: 0, original: 'o' + n, besser: 'La phrase corrigée ' + n + '.', erklaerung: 'e', category: 'grammar',
    cefr_topic: 't' + n, cloze_text: 'La phrase ___ ' + n + '.', cloze_answer: 'corrigée', hint: 'h'
  });

  it('builds cloze + bidirectional vocab cards with the personal example', () => {
    const deck = { cards: [] as Card[], log: [] };
    const cards = cardsFromAnalysis(deck, an({
      corrections: [corr(1)],
      new_vocab: [{ fr: 'le sentier', de: 'der Pfad', ex: 'On suit le sentier.' }]
    }), 'sess1');
    expect(cards.map(c => c.type)).toEqual(['cloze', 'fr2de', 'de2fr']);
    expect(cards[0].audioText).toContain('corrigée');
    expect(cards[1].example).toBe('On suit le sentier.');
    expect(cards.every(c => c.sourceSessionId === 'sess1')).toBe(true);
    // Production direction is staggered: recognition first, de2fr starts 10 days later
    // and stays out of buildSession until then.
    expect(cards[2].due > cards[1].due).toBe(true);
    const deck2 = { cards, log: [] };
    expect(buildSession(deck2, 15, 8, cards[1].due).find(c => c.type === 'de2fr')).toBeUndefined();
  });

  it('rejects gaps that swallow words the student already had right', () => {
    const bad = {
      user_turn: 0, original: 'Je n’ai pas jamais dessiné un arbre.', besser: 'Je n’ai jamais dessiné d’arbre.',
      erklaerung: 'e', category: 'grammar' as const, cefr_topic: 'négation',
      cloze_text: 'Je n’ai ___ arbre.', cloze_answer: 'jamais dessiné d’', hint: 'nie + de'
    };
    const card = cardFromCorrection(bad, 's');
    expect(card.front).toContain('Corrige'); // fell back to fix-the-sentence
    const long = { ...bad, cloze_text: 'La ___ est là.', cloze_answer: 'phrase beaucoup trop longue pour un trou' };
    expect(cardFromCorrection(long, 's').front).toContain('Corrige');
  });

  it('autoscales the session with the due backlog (up to 2×)', () => {
    const deck = { cards: [] as Card[], log: [] };
    for (let i = 0; i < 40; i++) deck.cards.push(mkCard({ id: 'd' + i, state: 'review', due: '2026-08-01' }));
    expect(buildSession(deck, 15, 8, '2026-08-17')).toHaveLength(30); // 2×15, not 15
  });

  it('skips malformed cloze, dedupes against the deck, stays under the cap', () => {
    const deck = { cards: [newCard({ type: 'fr2de', front: 'le sentier', back: 'der Pfad', sourceKind: 'vocab' })], log: [] };
    const cards = cardsFromAnalysis(deck, an({
      corrections: [
        { ...corr(1), cloze_text: 'kein Platzhalter' },
        ...Array.from({ length: 9 }, (_, i) => corr(i + 2))
      ],
      new_vocab: [
        { fr: 'LE SENTIER', de: 'der Pfad', ex: '' }, // dup of existing fr2de
        { fr: 'la falaise', de: 'die Klippe', ex: '' }
      ]
    }), 's');
    expect(cards.find(c => c.front === 'kein Platzhalter')).toBeUndefined();
    expect(cards.filter(c => c.type === 'cloze')).toHaveLength(5); // capped at 6 corrections, one malformed
    expect(cards.filter(c => c.type === 'fr2de').map(c => c.front)).toEqual(['la falaise']);
    expect(cards.length).toBeLessThanOrEqual(MAX_SESSION_CARDS);
  });

  it('keeps every vocabulary word even behind a full set of corrections', () => {
    // The old ordering put both vocab directions after six clozes under a cap of 12,
    // so the last words of a rich conversation silently never became cards.
    const deck = { cards: [] as Card[], log: [] };
    const cards = cardsFromAnalysis(deck, an({
      corrections: Array.from({ length: 6 }, (_, i) => corr(i + 1)),
      new_vocab: [
        { fr: 'le toboggan', de: 'die Rutsche', ex: 'Les enfants montent sur le toboggan.' },
        { fr: 'la balançoire', de: 'die Schaukel', ex: '' },
        { fr: 'le bac à sable', de: 'der Sandkasten', ex: '' },
        { fr: 'la trottinette', de: 'der Roller', ex: '' },
        { fr: 'le cerf-volant', de: 'der Drachen', ex: '' }
      ]
    }), 's');
    expect(cards.filter(c => c.type === 'cloze')).toHaveLength(6);
    for (const w of ['le toboggan', 'la balançoire', 'le bac à sable', 'la trottinette', 'le cerf-volant']) {
      expect(cards.some(c => c.type === 'fr2de' && c.front === w)).toBe(true);
    }
    expect(cards).toHaveLength(16);
  });

  it('still makes the recognition card when a correction already tests the word', () => {
    const deck = { cards: [] as Card[], log: [] };
    const vocabCorr = {
      user_turn: 0, original: 'Mon income est stable.', besser: 'Mon revenu est stable.',
      erklaerung: 'e', category: 'vocab' as const, cefr_topic: 'vocabulaire',
      cloze_text: 'Mon ___ est stable.', cloze_answer: 'revenu', hint: 'Einkommen'
    };
    const cards = cardsFromAnalysis(deck, an({
      corrections: [vocabCorr],
      new_vocab: [{ fr: 'revenu', de: 'das Einkommen', ex: 'Mon revenu est stable.' }]
    }), 's');
    expect(cards.some(c => c.type === 'fr2de' && c.front === 'revenu')).toBe(true);
    // ...but not a second production card: the cloze already asks for the same word.
    expect(cards.some(c => c.type === 'de2fr')).toBe(false);
  });

  it('drops vocabulary entries with nothing usable in them', () => {
    const deck = { cards: [] as Card[], log: [] };
    const cards = cardsFromAnalysis(deck, an({
      new_vocab: [{ fr: '  ', de: 'x', ex: '' }, { fr: 'le quai', de: '', ex: '' }]
    }), 's');
    expect(cards).toHaveLength(0);
  });

  it('lets code-switch (vocab) corrections jump the 6-correction cap', () => {
    const deck = { cards: [] as Card[], log: [] };
    const corrs = Array.from({ length: 7 }, (_, i) => corr(i + 1));
    corrs[6] = { ...corr(99), category: 'vocab' }; // "income" style gap, listed last
    const cards = cardsFromAnalysis(deck, an({ corrections: corrs }), 's');
    expect(cards.some(c => c.front.includes('99'))).toBe(true); // made it in despite position 7
  });
});

describe('starred corrections (pinned in the review)', () => {
  const c1 = corrFix('Mon income est stable.', 'Mon revenu est stable.', 'Mon ___ est stable.', 'revenu');
  function corrFix(original: string, besser: string, cloze_text: string, cloze_answer: string) {
    return { user_turn: 0, original, besser, erklaerung: 'e', category: 'vocab' as const, cefr_topic: 'vocabulaire', cloze_text, cloze_answer, hint: 'h' };
  }

  it('cardFromCorrection builds the cloze, or a fix-the-sentence fallback', () => {
    const ok = cardFromCorrection(c1, 'sess9');
    expect(ok.front).toBe('Mon ___ est stable.');
    expect(ok.back).toBe('revenu');
    const bad = cardFromCorrection({ ...c1, cloze_text: 'no gap here' }, 'sess9');
    expect(bad.front).toContain('Corrige');
    expect(bad.back).toBe('Mon revenu est stable.');
  });

  it('findCorrectionCard matches both card shapes', () => {
    const a = cardFromCorrection(c1, 's1');
    const b = cardFromCorrection({ ...c1, original: 'Autre phrase.', cloze_text: '' }, 's1');
    const deck = { cards: [a, b], log: [] };
    expect(findCorrectionCard(deck, 's1', c1)?.id).toBe(a.id);
    expect(findCorrectionCard(deck, 's1', { ...c1, original: 'Autre phrase.', cloze_text: '' })?.id).toBe(b.id);
    expect(findCorrectionCard(deck, 's2', c1)).toBeUndefined();
  });

  it('starred cards lead the session and ignore the new-card cap', () => {
    const deck = { cards: [] as Card[], log: [] };
    for (let i = 0; i < 6; i++) deck.cards.push(mkCard({ id: 'd' + i, state: 'review', due: '2026-08-10' }));
    for (let i = 0; i < 8; i++) deck.cards.push(mkCard({ id: 'n' + i, createdAt: '2026-08-01', due: '2026-08-01' }));
    const pinned = mkCard({ id: 'pin', createdAt: '2026-08-16', starred: true, due: '2026-08-16' }); // newest → last without the pin
    deck.cards.push(pinned);
    const q = buildSession(deck, 15, 4, '2026-08-17');
    expect(q[0].id).toBe('pin');                       // ahead of everything
    expect(q.filter(c => c.state === 'new')).toHaveLength(5); // 4 + the pinned one
  });

  it('grading well unpins; hard keeps the pin', () => {
    const c = mkCard({ starred: true, state: 'review', interval: 1, reps: 1 });
    grade(c, 'hard', '2026-08-17');
    expect(c.starred).toBe(true);
    grade(c, 'good', '2026-08-18');
    expect(c.starred).toBe(false);
  });
});

describe('card stage + last self-assessment (status filter)', () => {
  it('buckets new / learning / learned / suspended', () => {
    expect(cardStage(mkCard())).toBe('new');
    expect(cardStage(mkCard({ state: 'learning' }))).toBe('learning');
    expect(cardStage(mkCard({ state: 'review', interval: MATURE_DAYS - 1 }))).toBe('learning');
    expect(cardStage(mkCard({ state: 'review', interval: MATURE_DAYS }))).toBe('learned');
  });

  it('grade() records the last self-assessment; lastKnown maps it', () => {
    const c = mkCard();
    expect(lastKnown(c)).toBeNull(); // never graded (also true for pre-migration decks)
    grade(c, 'good', '2026-08-17');
    expect(c.lastGrade).toBe('good');
    expect(lastKnown(c)).toBe(true);
    grade(c, 'again', '2026-08-18');
    expect(lastKnown(c)).toBe(false);
    grade(c, 'hard', '2026-08-18');
    expect(lastKnown(c)).toBe(false);
    grade(c, 'easy', '2026-08-19');
    expect(lastKnown(c)).toBe(true);
  });

  it('a matured card knocked back by Again returns to learning', () => {
    const c = mkCard({ state: 'review', interval: 30, reps: 6 });
    expect(cardStage(c)).toBe('learned');
    grade(c, 'again', '2026-08-17');
    expect(cardStage(c)).toBe('learning');
    expect(lastKnown(c)).toBe(false);
  });
});


describe('findVocabCard', () => {
  const v = { fr: 'le toboggan', de: 'die Rutsche', ex: '' };

  it('finds the word in any card shape, ignoring case and accents', () => {
    const [recog, prod] = vocabCards(v, 's1');
    expect(findVocabCard({ cards: [recog], log: [] }, 'LE TOBOGGAN')?.id).toBe(recog.id);
    expect(findVocabCard({ cards: [prod], log: [] }, 'le toboggan')?.id).toBe(prod.id);
    const cloze = newCard({ type: 'cloze', front: 'Il monte sur le ___.', back: 'toboggan', sourceKind: 'correction' });
    expect(findVocabCard({ cards: [cloze], log: [] }, 'toboggan')?.id).toBe(cloze.id);
  });

  it('returns nothing for a word with no card', () => {
    expect(findVocabCard({ cards: [], log: [] }, 'le toboggan')).toBeUndefined();
    expect(findVocabCard({ cards: [], log: [] }, '')).toBeUndefined();
  });

  it('staggers the production direction ten days behind recognition', () => {
    const [recog, prod] = vocabCards(v);
    expect(prod.due > recog.due).toBe(true);
    expect(recog.sourceSessionId).toBeUndefined();
  });
});

describe('latestBatchIds', () => {
  const T = (iso: string) => Date.parse(iso);
  const sess = (id: string, date: string, at?: string) =>
    ({ id, date, topic: 't', source: 'causerie' as const, minutes: 5, ...(at ? { at } : {}) });
  const card = (id: string, over: Partial<Card>) => mkCard({ id, ...over });

  it('takes the last call\'s cards plus anything made by hand after it', () => {
    const mem = {
      sessions: [sess('s1', '2026-08-17', '2026-08-17T09:00:00Z'), sess('s2', '2026-08-19', '2026-08-19T10:30:00Z')],
      deck: {
        cards: [
          card('old', { sourceKind: 'vocab', sourceSessionId: 's1', createdAt: '2026-08-17' }),
          card('new', { sourceKind: 'vocab', sourceSessionId: 's2', createdAt: '2026-08-19' }),
          card('hand', { sourceKind: 'manual', createdAt: '2026-08-19', createdTs: T('2026-08-19T11:00:00Z') }),
          card('handOld', { sourceKind: 'manual', createdAt: '2026-08-16', createdTs: T('2026-08-16T08:00:00Z') }),
          card('seeded', { sourceKind: 'seed', createdAt: '2026-08-19' })
        ],
        log: []
      }
    };
    expect([...latestBatchIds(mem)].sort()).toEqual(['hand', 'new']);
  });

  it('leaves out a card made earlier the same day, before the last call', () => {
    // Two calls in one day: cards built out of the morning conversation are not part of
    // the afternoon one, and a date comparison cannot tell them apart.
    const mem = {
      sessions: [sess('morning', '2026-08-19', '2026-08-19T08:00:00Z'),
                 sess('afternoon', '2026-08-19', '2026-08-19T15:00:00Z')],
      deck: {
        cards: [
          card('fromMorning', { sourceKind: 'vocab', sourceSessionId: 'morning', createdAt: '2026-08-19' }),
          card('fromAfternoon', { sourceKind: 'vocab', sourceSessionId: 'afternoon', createdAt: '2026-08-19' }),
          card('handBefore', { sourceKind: 'manual', createdAt: '2026-08-19', createdTs: T('2026-08-19T09:30:00Z') }),
          card('handAfter', { sourceKind: 'manual', createdAt: '2026-08-19', createdTs: T('2026-08-19T15:20:00Z') })
        ],
        log: []
      }
    };
    expect([...latestBatchIds(mem)].sort()).toEqual(['fromAfternoon', 'handAfter']);
  });

  it('keeps hand-made cards out when the last call pre-dates the stamp', () => {
    // Older profiles carry no `at` on the call and no `createdTs` on the card. Guessing
    // from the date is what put a morning card in the afternoon's batch, so it does not
    // guess: the batch is exactly the call's own cards.
    const mem = {
      sessions: [sess('s1', '2026-08-19')],
      deck: {
        cards: [
          card('own', { sourceKind: 'vocab', sourceSessionId: 's1', createdAt: '2026-08-19' }),
          card('hand', { sourceKind: 'manual', createdAt: '2026-08-19', createdTs: undefined })
        ],
        log: []
      }
    };
    expect([...latestBatchIds(mem)]).toEqual(['own']);
  });

  it('falls back to today\'s hand-made cards before the first call', () => {
    const mem = {
      sessions: [],
      deck: {
        cards: [
          card('today', { sourceKind: 'manual', createdAt: '2026-08-19', createdTs: T('2026-08-19T09:00:00') }),
          card('yesterday', { sourceKind: 'manual', createdAt: '2026-08-18', createdTs: T('2026-08-18T09:00:00') })
        ],
        log: []
      }
    };
    expect([...latestBatchIds(mem, '2026-08-19')]).toEqual(['today']);
  });

  it('ignores imported Duolingo sessions when picking the anchor', () => {
    const mem = {
      sessions: [sess('s1', '2026-08-18'), { id: 'duo', date: '2026-08-19', topic: 't', source: 'duolingo' as const, minutes: 5 }],
      deck: { cards: [card('c1', { sourceKind: 'vocab', sourceSessionId: 's1', createdAt: '2026-08-18' })], log: [] }
    };
    expect([...latestBatchIds(mem)]).toEqual(['c1']);
  });
});

describe('a suspended card is not covering the word', () => {
  it('lets a word be carded again after the A2 retirement paused its old card', () => {
    const deck = { cards: [], log: [] } as Deck;
    deck.cards.push(...vocabCards({ fr: 'le quai', de: 'der Bahnsteig', ex: '' }, 's1', true));
    expect(findVocabCard(deck, 'le quai')).toBeTruthy();

    // Crossing A2 suspends the recognition card…
    retireRecognition({ deck, cefr: { overall: 4 } } as never);
    // …and the production card is still live, so the word is still covered.
    expect(findVocabCard(deck, 'le quai')?.type).toBe('de2fr');

    // With nothing left, the word is addable again rather than silently "done".
    deck.cards = [];
    expect(findVocabCard(deck, 'le quai')).toBeUndefined();
  });

  it('re-arms the retirement when the learner drops back below A2', () => {
    const deck = { cards: [], log: [] } as Deck;
    deck.cards.push(...vocabCards({ fr: 'le quai', de: 'der Bahnsteig', ex: '' }, 's1', true));
    retireRecognition({ deck, cefr: { overall: 4 } } as never);
    expect(deck.recogRetired).toBe(true);

    retireRecognition({ deck, cefr: { overall: 1 } } as never);   // back to A1+
    expect(deck.recogRetired).toBeUndefined();

    // …so the cards made while they were down there get retired on the way back up.
    deck.cards.push(...vocabCards({ fr: 'la gare', de: 'der Bahnhof', ex: '' }, 's2', true));
    const n = retireRecognition({ deck, cefr: { overall: 4 } } as never);
    expect(n).toBeGreaterThan(0);
    // Retirement now REMOVES them: with no shelf to look at, a hidden card is not a kept one.
    expect(deck.cards.some(c => c.type === 'fr2de')).toBe(false);
    expect(deck.cards.some(c => c.type === 'de2fr')).toBe(true);
  });
});

/* "Rien à réviser" next to a deck saying twenty-one new cards. Both were telling the truth:
 * the deck counts every unstarted card, and the queue only takes the ones whose date has
 * come — and the production direction of a vocab pair waits ten days behind its recognition
 * twin. A student who has finished the day's two sittings and come back for a third was
 * being told to go away by a deck full of work. */
describe('an extra sitting reaches past the stagger', () => {
  const staggered = (n: number): Deck => ({
    cards: Array.from({ length: n }, (_, i) => ({
      ...newCard({ type: 'de2fr', front: 'f' + i, back: 'b' + i, sourceKind: 'vocab' }),
      due: addDaysISO(todayISO(), 10)
    })),
    log: []
  });

  it('builds nothing inside the day’s plan, as it always did', () => {
    expect(buildSession(staggered(21), 18, 2, todayISO(), false)).toHaveLength(0);
  });

  it('fills the third sitting from the cards that are waiting', () => {
    const q = buildSession(staggered(21), 18, 18, todayISO(), true);
    expect(q.length).toBeGreaterThan(0);
    expect(q.length).toBeLessThanOrEqual(18);
    expect(q.every(c => c.state === 'new')).toBe(true);
  });

  it('takes the ones closest to their date first', () => {
    const deck = staggered(0);
    deck.cards = [
      { ...newCard({ type: 'de2fr', front: 'far', back: 'x', sourceKind: 'vocab' }), due: addDaysISO(todayISO(), 30) },
      { ...newCard({ type: 'de2fr', front: 'near', back: 'x', sourceKind: 'vocab' }), due: addDaysISO(todayISO(), 2) }
    ];
    expect(buildSession(deck, 18, 18, todayISO(), true)[0].front).toBe('near');
  });

  it('never reaches ahead while anything is actually due', () => {
    // A card ten days early is worth less than the same card on time, so this is a
    // fallback into an empty queue — never a way to jump the schedule.
    const deck = staggered(5);
    deck.cards.push({
      ...newCard({ type: 'cloze', front: 'due ___', back: 'now', sourceKind: 'correction' }),
      state: 'review', reps: 2, interval: 3, due: todayISO()
    });
    const q = buildSession(deck, 18, 18, todayISO(), true);
    expect(q).toHaveLength(1);
    expect(q[0].state).toBe('review');
  });

  it('and never while a new card is properly on its date', () => {
    const deck = staggered(5);
    deck.cards.push(newCard({ type: 'de2fr', front: 'today', back: 'x', sourceKind: 'vocab' }));
    const q = buildSession(deck, 18, 18, todayISO(), true);
    expect(q).toHaveLength(1);
    expect(q[0].front).toBe('today');
  });
});
