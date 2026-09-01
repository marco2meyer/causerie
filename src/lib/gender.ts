import type { Card } from '../types';
import { norm } from './utils';

/** The grammatical gender a card's word declares, or null when it declares none.
 *
 *  Read off the article the deck already carries, and from nothing else. A vocabulary card
 *  holds a dictionary entry — "la séance", "un toboggan", "el mercado" — and the article in
 *  front of it IS the gender, stated by whoever wrote the entry. Guessing from word endings
 *  would be a second, worse source of truth: French alone would need the -age/-ment/-tion
 *  rules and their several dozen exceptions, and a card confidently painted the wrong colour
 *  teaches the wrong thing with more conviction than a card painted no colour at all.
 *
 *  So a verb, an adverb, an expression and a bare cloze answer all come back null, which is
 *  correct: they have no gender to show. */

type Gender = 'm' | 'f';

const ARTICLES: Record<string, Record<string, Gender>> = {
  fr: { le: 'm', un: 'm', du: 'm', au: 'm', la: 'f', une: 'f' },
  es: { el: 'm', un: 'm', los: 'm', unos: 'm', la: 'f', una: 'f', las: 'f', unas: 'f' },
  it: { il: 'm', lo: 'm', un: 'm', uno: 'm', i: 'm', gli: 'm', la: 'f', una: 'f', le: 'f' },
  pt: { o: 'm', um: 'm', os: 'm', uns: 'm', a: 'f', uma: 'f', as: 'f', umas: 'f' }
  // English has no grammatical gender, so it has no entry and every card stays neutral.
};

/** The side of the card that is in the language being learned. */
export function targetText(c: Pick<Card, 'type' | 'front' | 'back'>): string {
  return c.type === 'fr2de' ? c.front : c.back;
}

export function wordGender(c: Pick<Card, 'type' | 'front' | 'back'>, lang: string | undefined): Gender | null {
  const table = lang ? ARTICLES[lang] : undefined;
  if (!table) return null;
  const raw = (targetText(c) || '').trim();
  // "un'amica" is feminine and the apostrophe is the only thing that says so — normalising
  // turns it into "un amica", which reads as the masculine article.
  if (lang === 'it' && /^un['’]\s*\S/.test(raw)) return 'f';
  const w = norm(raw).split(' ').filter(Boolean);
  // An article on its own is not a noun with a gender, it is an article.
  if (w.length < 2) return null;
  return table[w[0]] ?? null;
}
