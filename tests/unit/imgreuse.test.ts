import { describe, expect, it } from 'vitest';
import type { Card, Deck } from '../../src/types';
import { conceptKey, sameConceptCards, vocabCards } from '../../src/lib/srs';

/* A word is never one card. Vocabulary arrives as a pair — recognition now, production ten
 * days behind it — and a correction about the same word adds a cloze on top. A picture
 * drawn on any one of them belongs to all of them. */

const card = (over: Partial<Card>): Card => ({
  id: over.id ?? 'c' + Math.random().toString(36).slice(2, 7),
  type: 'fr2de', front: '', back: '', sourceKind: 'manual', createdAt: '2026-08-01',
  state: 'new', ease: 2.5, interval: 0, reps: 0, lapses: 0, due: '2026-08-01', ...over
});

describe('conceptKey', () => {
  it('is the target-language word whichever way the card asks it', () => {
    expect(conceptKey({ type: 'fr2de', front: 'la séance', back: 'die Vorstellung' })).toBe('seance');
    expect(conceptKey({ type: 'de2fr', front: 'die Vorstellung', back: 'la séance' })).toBe('seance');
  });

  it('strips the dictionary scaffolding, so the entry and the cloze answer agree', () => {
    // "la séance" is what the deck writes; "séance" is what the learner has to produce.
    expect(conceptKey({ type: 'cloze', front: 'On va à la ___.', back: 'séance' }))
      .toBe(conceptKey({ type: 'fr2de', front: 'la séance', back: 'die Vorstellung' }));
    expect(conceptKey({ type: 'fr2de', front: 'se concentrer sur', back: 'x' })).toBe('concentrer sur');
    expect(conceptKey({ type: 'fr2de', front: 'l’ordre du jour', back: 'x' })).toBe('ordre du jour');
  });

  it('ignores accents and case, so one picture covers both spellings', () => {
    expect(conceptKey({ type: 'fr2de', front: 'L’Ordre du Jour', back: 'x' }))
      .toBe(conceptKey({ type: 'fr2de', front: 'l’ordre du jour', back: 'y' }));
  });
});

describe('sameConceptCards', () => {
  it('finds both halves of a vocabulary pair from either side', () => {
    const pair = vocabCards({ fr: 'la séance', de: 'die Vorstellung', ex: '' }, 's1');
    const deck: Deck = { cards: pair, log: [] };
    expect(pair).toHaveLength(2);
    for (const c of pair) {
      expect(sameConceptCards(deck, c).map(x => x.id).sort()).toEqual(pair.map(x => x.id).sort());
    }
  });

  it('pulls in a cloze whose answer is the same word', () => {
    const pair = vocabCards({ fr: 'davantage', de: 'mehr', ex: '' }, 's1');
    const cloze = card({ id: 'cz', type: 'cloze', front: 'Il faut travailler ___.', back: 'davantage' });
    const deck: Deck = { cards: [...pair, cloze], log: [] };
    expect(sameConceptCards(deck, cloze)).toHaveLength(3);
    expect(sameConceptCards(deck, pair[0]).map(c => c.id)).toContain('cz');
  });

  it('groups a cloze answer with the dictionary entry it came from', () => {
    const pair = vocabCards({ fr: 'la séance', de: 'die Vorstellung', ex: '' }, 's1');
    const cloze = card({ id: 'cz', type: 'cloze', front: 'On va à la ___.', back: 'séance' });
    const deck: Deck = { cards: [...pair, cloze], log: [] };
    expect(sameConceptCards(deck, pair[0]).map(c => c.id)).toContain('cz');
  });

  it('leaves a different word alone', () => {
    const deck: Deck = {
      cards: [...vocabCards({ fr: 'davantage', de: 'mehr', ex: '' }, 's1'),
              ...vocabCards({ fr: 'la séance', de: 'die Vorstellung', ex: '' }, 's1')],
      log: []
    };
    const kin = sameConceptCards(deck, deck.cards[0]);
    expect(kin).toHaveLength(2);
    expect(new Set(kin.map(conceptKey))).toEqual(new Set(['davantage']));
  });

  it('returns just the card itself when it has no word to group on', () => {
    const lonely = card({ id: 'l1', type: 'cloze', front: 'x', back: '' });
    const deck: Deck = { cards: [lonely, card({ id: 'l2', type: 'cloze', front: 'y', back: '' })], log: [] };
    expect(sameConceptCards(deck, lonely).map(c => c.id)).toEqual(['l1']);
  });
});
