import { describe, expect, it } from 'vitest';
import type { Card } from '../../src/types';
import { wordGender } from '../../src/lib/gender';

const c = (type: Card['type'], front: string, back: string) => ({ type, front, back });

describe('wordGender', () => {
  it('reads the article the deck already carries, whichever way the card faces', () => {
    expect(wordGender(c('fr2de', 'la séance', 'die Vorstellung'), 'fr')).toBe('f');
    expect(wordGender(c('de2fr', 'die Vorstellung', 'la séance'), 'fr')).toBe('f');
    expect(wordGender(c('fr2de', 'un toboggan', 'die Rutsche'), 'fr')).toBe('m');
    expect(wordGender(c('de2fr', 'der Entwurf', 'le brouillon'), 'fr')).toBe('m');
  });

  it('says nothing where the entry says nothing', () => {
    // A verb, an adverb, an expression: no article, so no gender to show.
    expect(wordGender(c('fr2de', 'travailler', 'arbeiten'), 'fr')).toBeNull();
    expect(wordGender(c('fr2de', 'davantage', 'mehr'), 'fr')).toBeNull();
    expect(wordGender(c('fr2de', 'à cet égard', 'in dieser Hinsicht'), 'fr')).toBeNull();
    // An elision hides it, and a plural does not carry it.
    expect(wordGender(c('fr2de', 'l’ordre du jour', 'die Tagesordnung'), 'fr')).toBeNull();
    expect(wordGender(c('fr2de', 'les vacances', 'die Ferien'), 'fr')).toBeNull();
    // A cloze answer is the bare word the learner has to produce.
    expect(wordGender(c('cloze', 'On va à la ___.', 'séance'), 'fr')).toBeNull();
    // And an article with nothing after it is an article.
    expect(wordGender(c('fr2de', 'la', 'die'), 'fr')).toBeNull();
  });

  it('speaks the other languages', () => {
    expect(wordGender(c('fr2de', 'el mercado', 'der Markt'), 'es')).toBe('m');
    expect(wordGender(c('fr2de', 'una fiesta', 'ein Fest'), 'es')).toBe('f');
    expect(wordGender(c('fr2de', 'il libro', 'das Buch'), 'it')).toBe('m');
    expect(wordGender(c('fr2de', 'la chiave', 'der Schlüssel'), 'it')).toBe('f');
    expect(wordGender(c('fr2de', 'o mercado', 'der Markt'), 'pt')).toBe('m');
    expect(wordGender(c('fr2de', 'a casa', 'das Haus'), 'pt')).toBe('f');
  });

  /* "un'amica" is feminine and the apostrophe is the only thing that says so. */
  it('does not call an Italian elided feminine masculine', () => {
    expect(wordGender(c('fr2de', "un'amica", 'eine Freundin'), 'it')).toBe('f');
    expect(wordGender(c('fr2de', 'un amico', 'ein Freund'), 'it')).toBe('m');
  });

  it('leaves English alone, having no gender to report', () => {
    expect(wordGender(c('fr2de', 'the meeting', 'die Sitzung'), 'en')).toBeNull();
    expect(wordGender(c('fr2de', 'a meeting', 'eine Sitzung'), 'en')).toBeNull();
  });

  it('does not invent a gender without a language', () => {
    expect(wordGender(c('fr2de', 'la séance', 'x'), undefined)).toBeNull();
  });
});
