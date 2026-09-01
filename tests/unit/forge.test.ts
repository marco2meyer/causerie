import { describe, expect, it } from 'vitest';
import { forgeExisting, forgeToCards, type ForgedCard } from '../../src/lib/forge';
import { seedMem } from '../../src/lib/seed';

const P: ForgedCard[] = [
  { type: 'fr2de', front: 'le toboggan', back: 'die Rutsche', hint: '', example: 'Les enfants adorent le toboggan.', audio: 'Les enfants adorent le toboggan.' },
  { type: 'cloze', front: 'Les enfants adorent le ___.', back: 'toboggan', hint: 'Rutsche', example: '', audio: 'Les enfants adorent le toboggan.' },
  { type: 'de2fr', front: 'die Rutsche', back: 'le toboggan', hint: '', example: '', audio: 'le toboggan' }
];

describe('card forge', () => {
  it('materializes picked proposals as manual deck cards', () => {
    const m = seedMem('M');
    const cards = forgeToCards(P, m.deck);
    expect(cards).toHaveLength(3);
    expect(cards.every(c => c.sourceKind === 'manual' && c.state === 'new')).toBe(true);
    expect(cards[0].audioText).toContain('toboggan');
    expect(cards[1].hint).toBe('Rutsche');
    expect(cards[2].hint).toBeUndefined(); // empty strings stay off the card
  });

  it('skips duplicates of the existing deck and within one batch', () => {
    const m = seedMem('M');
    m.deck.cards.push(...forgeToCards(P, m.deck));
    expect(forgeToCards(P, m.deck)).toHaveLength(0);           // all already there
    expect(forgeToCards([P[0], P[0]], { cards: [] })).toHaveLength(1); // batch-internal dedupe
  });

  it('reports which proposals the deck already holds, before anything is picked', () => {
    const m = seedMem('M');
    m.deck.cards.push(...forgeToCards([P[0]], m.deck));
    // The sheet needs this to avoid offering a pick that would be silently dropped at
    // add time -- the case where the add button looked like it did nothing.
    expect(forgeExisting(P, m.deck)).toEqual([true, false, false]);
    expect(forgeExisting(P, { cards: [] })).toEqual([false, false, false]);
  });

  it('links cards to the conversation and the turn they were forged from', () => {
    // Without the session, a card built out of this morning's transcript counts as
    // today's and lands in the afternoon call's "this session" group.
    const cards = forgeToCards(P, { cards: [] }, 'item_42', 'sess_morning');
    expect(cards.every(c => c.sourceTurnId === 'item_42')).toBe(true);
    expect(cards.every(c => c.sourceSessionId === 'sess_morning')).toBe(true);
    const loose = forgeToCards(P, { cards: [] })[0];
    expect(loose.sourceTurnId).toBeUndefined();
    expect(loose.sourceSessionId).toBeUndefined();
  });
});
