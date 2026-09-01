import { describe, expect, it } from 'vitest';
import { irregularForms, irregularLemmas } from '../../src/lib/irregular';
import { norm, sameWord, stemsMatch } from '../../src/lib/utils';
import { goalPlaced } from '../../src/lib/wordgoal';

const LANGS = ['fr', 'es', 'it', 'pt', 'en'];

/* A word goal is matched by stem, which covers a conjugation and cannot possibly cover the
 * verbs whose stem is replaced rather than extended. "Aller" shares nothing with "vais". */
describe('the forms a stem rule cannot reach', () => {
  const placed = (said: string, word: string, lang: string) => goalPlaced(said, { word }, lang);

  it('ticks French suppletives', () => {
    expect(placed('je vais à Berlin demain', 'aller', 'fr')).toBe(true);
    expect(placed('j’ai bu un café', 'boire', 'fr')).toBe(true);
    expect(placed('nous avons pris le train', 'prendre', 'fr')).toBe(true);
    expect(placed('je suis très fatigué', 'être', 'fr')).toBe(true);
    expect(placed('ils ont besoin de temps', 'avoir besoin de', 'fr')).toBe(true);
    expect(placed('je veux rester ici', 'vouloir', 'fr')).toBe(true);
    expect(placed('elle sait déjà tout', 'savoir', 'fr')).toBe(true);
    expect(placed('il faut partir', 'falloir', 'fr')).toBe(true);
    expect(placed('mes yeux sont fatigués', 'l’œil', 'fr')).toBe(true);
  });

  it('ticks the other languages', () => {
    expect(placed('yo voy al mercado', 'ir', 'es')).toBe(true);
    expect(placed('ayer hice la cena', 'hacer', 'es')).toBe(true);
    expect(placed('vado a casa adesso', 'andare', 'it')).toBe(true);
    expect(placed('ho bevuto un caffè', 'bere', 'it')).toBe(true);
    expect(placed('eu vou ao mercado', 'ir', 'pt')).toBe(true);
    expect(placed('eu fiz o jantar', 'fazer', 'pt')).toBe(true);
    expect(placed('I went home early', 'go', 'en')).toBe(true);
    expect(placed('she was already there', 'be', 'en')).toBe(true);
    expect(placed('two men were waiting', 'man', 'en')).toBe(true);
  });

  it('does nothing at all without a language', () => {
    expect(placed('je vais à Berlin', 'aller', '')).toBe(false);
    expect(goalPlaced('je vais à Berlin', { word: 'aller' })).toBe(false);
  });

  it('does not tick one verb on another verb’s form', () => {
    expect(placed('je vais à Berlin', 'avoir', 'fr')).toBe(false);
    expect(placed('j’ai un chien', 'être', 'fr')).toBe(false);
    expect(placed('je bois de l’eau', 'devoir', 'fr')).toBe(false);
    expect(placed('I went home', 'be', 'en')).toBe(false);
  });

  /* Every form here has to earn its place, or the table turns into a conjugator nobody can
   * maintain. Two rules, both mechanical, both checked. */
  it('lists nothing the stem rule already reaches', () => {
    const redundant: string[] = [];
    for (const lang of LANGS) {
      for (const lemma of irregularLemmas(lang)) {
        for (const f of irregularForms(lemma, lang)) {
          if (stemsMatch(lemma, f)) redundant.push(`${lang} ${lemma} → ${f}`);
        }
      }
    }
    expect(redundant).toEqual([]);
  });

  it('lists nothing that folds onto a word which is not the verb', () => {
    // Accents are gone by the time a form is looked up, so French "a" cannot be told from
    // "à", nor Italian "è" from "e". Listing those would tick on half of every sentence.
    const traps: Record<string, string[]> = {
      fr: ['a', 'la', 'le', 'les', 'de', 'du', 'en', 'ou', 'y', 'se', 'ne', 'si', 'ce'],
      es: ['a', 'e', 'o', 'y', 'de', 'se'],
      it: ['a', 'e', 'o', 'da', 'di', 'la', 'le', 'si', 'ne', 'ci'],
      pt: ['a', 'e', 'o', 'da', 'de', 'na', 'no', 'se'],
      en: ['a', 'an', 'as', 'to', 'so']
    };
    for (const lang of LANGS) {
      const bad = new Set(traps[lang].map(norm));
      for (const lemma of irregularLemmas(lang)) {
        for (const f of irregularForms(lemma, lang)) {
          expect(bad.has(f), `${lang}: ${lemma} → ${f}`).toBe(false);
        }
      }
    }
  });

  it('stores its forms already normalised, because that is how they are looked up', () => {
    for (const lang of LANGS) {
      for (const lemma of irregularLemmas(lang)) {
        expect(norm(lemma), lang).toBe(lemma);
        for (const f of irregularForms(lemma, lang)) expect(norm(f), `${lang} ${lemma}`).toBe(f);
      }
    }
  });

  it('is consulted one way round only: the deck asks, the learner answers', () => {
    expect(sameWord('vais', 'aller', 'fr')).toBe(true);
    expect(sameWord('aller', 'vais', 'fr')).toBe(false);
  });

  it('costs nothing for the words that do not need it', () => {
    expect(irregularForms('travailler', 'fr')).toEqual([]);
    expect(irregularForms('aller', 'de')).toEqual([]);   // no table for a support language
    expect(irregularForms('aller', undefined)).toEqual([]);
  });
});

/* The ligature is a letter. Normalising it to a space meant "cœur", "sœur" and "l'œil"
 * broke into fragments that could never match what a learner said. */
describe('norm and the French ligature', () => {
  it('folds œ and æ rather than dropping them', () => {
    expect(norm('cœur')).toBe('coeur');
    expect(norm('l’œil')).toBe('l oeil');
    expect(stemsMatch('cœur', 'coeurs')).toBe(true);
  });
});
