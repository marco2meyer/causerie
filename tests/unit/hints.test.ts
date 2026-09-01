import { describe, expect, it } from 'vitest';
import { hintLeaks, isGapCard, scrubDeckHints, scrubHint } from '../../src/lib/hints';
import { cardFromCorrection, showExample } from '../../src/lib/srs';
import type { Card, Correction } from '../../src/types';

const corr = (p: Partial<Correction>): Correction => ({
  user_turn: 0, original: '', besser: '', erklaerung: '', category: 'vocab',
  cefr_topic: '', cloze_text: '', cloze_answer: '', hint: '', ...p
});

describe('hint leaks', () => {
  it('sees the answer through inflection', () => {
    expect(hintLeaks('contester', 'contesté')).toBe(true);
    expect(hintLeaks('anfechten', 'contesté')).toBe(false);
  });
  it('does not confuse a longer unrelated word for the answer', () => {
    expect(hintLeaks('la voiture', 'voir')).toBe(false);
    expect(hintLeaks('sehen', 'voir')).toBe(false);
  });
});

describe('scrubHint', () => {
  it('leaves a clean hint alone', () => {
    expect(scrubHint('anfechten', 'contesté')).toBe('anfechten');
    expect(scrubHint('nie', 'jamais')).toBe('nie');
  });
  it('drops a hint that is only the answer', () => {
    expect(scrubHint('contester', 'contesté')).toBeUndefined();
    expect(scrubHint('« contester »', 'contesté')).toBeUndefined();
  });
  it('keeps the part of the hint that still says something', () => {
    expect(scrubHint('contester = anfechten', 'contesté')).toBe('anfechten');
    expect(scrubHint('anfechten (contester)', 'contesté')).toBe('anfechten');
    expect(scrubHint('Vergangenheit von contester', 'contesté')).toBe('Vergangenheit von …');
  });
  it('drops a contrast pair rather than pointing at its wrong half', () => {
    expect(scrubHint('savoir/connaître', 'connais')).toBeUndefined();
    expect(scrubHint('savoir ou connaître', 'connais')).toBeUndefined();
  });
  it('never returns a hint that still leaks', () => {
    expect(scrubHint("l'argent", 'argent')).toBeUndefined();
  });
  it('is a no-op without an answer to protect', () => {
    expect(scrubHint('irgendwas', '')).toBe('irgendwas');
    expect(scrubHint('', 'contesté')).toBeUndefined();
  });
});

describe('cards built from a correction', () => {
  it('refuses a hint that spells the gap out, explanation included', () => {
    const c = cardFromCorrection(corr({
      original: 'J’ai contestieren le prix', besser: 'J’ai contesté le prix.',
      cloze_text: 'J’ai ___ le prix.', cloze_answer: 'contesté',
      hint: 'contester', erklaerung: 'On dit « contester », pas « contestieren ».'
    }), 's1');
    expect(c.hint).toBeUndefined();
  });
  it('keeps a hint that points from outside', () => {
    const c = cardFromCorrection(corr({
      original: 'J’ai contestieren le prix', besser: 'J’ai contesté le prix.',
      cloze_text: 'J’ai ___ le prix.', cloze_answer: 'contesté', hint: 'anfechten, Perfekt'
    }), 's1');
    expect(c.hint).toBe('anfechten, Perfekt');
  });
});

describe('scrubDeckHints', () => {
  const card = (p: Partial<Card>): Card => ({
    id: 'c1', type: 'cloze', front: 'J’ai ___ le prix.', back: 'contesté', createdAt: '2026-01-01',
    state: 'new', ease: 2.5, interval: 0, reps: 0, lapses: 0, due: '2026-01-01',
    sourceKind: 'correction', ...p
  } as Card);

  it('cleans gap cards and counts them', () => {
    const cards = [card({ hint: 'contester' }), card({ id: 'c2', hint: 'anfechten' })];
    expect(scrubDeckHints(cards)).toBe(1);
    expect(cards[0].hint).toBeUndefined();
    expect(cards[1].hint).toBe('anfechten');
  });
  it('leaves the fix-the-sentence shape alone', () => {
    const c = card({
      front: 'Corrige : « J’ai contestieren le prix »', back: 'J’ai contesté le prix.',
      hint: 'Das Verb heißt contester.'
    });
    expect(isGapCard(c)).toBe(false);
    expect(scrubDeckHints([c])).toBe(0);
  });
});

describe('showExample', () => {
  const base = { type: 'cloze' as const, front: 'J’ai ___ le prix.', back: 'contesté' };
  it('hides the corrected sentence a cloze already asked for', () => {
    expect(showExample({ ...base, example: 'J’ai contesté le prix.' })).toBe(false);
  });
  it('hides an example that is only the answer again', () => {
    expect(showExample({ type: 'de2fr', front: 'anfechten', back: 'contester', example: 'Contester.' })).toBe(false);
  });
  it('shows an example that adds a sentence', () => {
    expect(showExample({ type: 'de2fr', front: 'anfechten', back: 'contester', example: 'Je vais contester la facture.' })).toBe(true);
  });
});
