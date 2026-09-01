import type { LangCode } from '../types';

/** Minimal-pair perception training (HVPT-light): hear one word in a varying voice,
 *  pick which of the two it was. Pairs target the classic trouble contrasts of
 *  German/English natives in each language. */

export interface Pair { a: string; b: string; tag: string }

export const PAIRS: Record<LangCode, Pair[]> = {
  fr: [
    { a: 'tu', b: 'tout', tag: 'u / ou' },
    { a: 'rue', b: 'roue', tag: 'u / ou' },
    { a: 'dessus', b: 'dessous', tag: 'u / ou' },
    { a: 'vin', b: 'vent', tag: 'nasales' },
    { a: 'blond', b: 'blanc', tag: 'nasales' },
    { a: 'jeune', b: 'jaune', tag: 'eu / au' },
    { a: 'poisson', b: 'poison', tag: 's / z' },
    { a: 'le', b: 'les', tag: 'e / é' }
  ],
  es: [
    { a: 'pero', b: 'perro', tag: 'r / rr' },
    { a: 'caro', b: 'carro', tag: 'r / rr' },
    { a: 'casa', b: 'caza', tag: 's / z' },
    { a: 'peso', b: 'beso', tag: 'p / b' },
    { a: 'hombre', b: 'hambre', tag: 'o / a' }
  ],
  it: [
    { a: 'pala', b: 'palla', tag: 'doppie' },
    { a: 'casa', b: 'cassa', tag: 'doppie' },
    { a: 'sono', b: 'sonno', tag: 'doppie' },
    { a: 'sete', b: 'sette', tag: 'doppie' },
    { a: 'polo', b: 'pollo', tag: 'doppie' }
  ],
  pt: [
    { a: 'avô', b: 'avó', tag: 'ô / ó' },
    { a: 'pais', b: 'país', tag: 'ai / aí' },
    { a: 'mau', b: 'mal', tag: 'u / l' },
    { a: 'caro', b: 'carro', tag: 'r / rr' }
  ],
  en: [
    { a: 'ship', b: 'sheep', tag: 'i / ee' },
    { a: 'bad', b: 'bed', tag: 'a / e' },
    { a: 'thin', b: 'sin', tag: 'th / s' },
    { a: 'vest', b: 'west', tag: 'v / w' },
    { a: 'worse', b: 'verse', tag: 'w / v' }
  ]
};

/** Voices rotated per round: hearing the contrast across speakers is what makes
 *  the training transfer (high-variability phonetic training). */
export const PRON_VOICES = ['coral', 'sage', 'marin', 'cedar'];

/** Short carrier phrases for the hardest stage: the word arrives embedded in speech
 *  (coarticulation), not isolated — the last step before real conversation. */
const CARRIER: Record<LangCode, string> = {
  fr: 'Écoute bien : {}.',
  es: 'Escucha bien: {}.',
  it: 'Ascolta bene: {}.',
  pt: 'Ouve bem: {}.',
  en: 'Listen closely: {}.'
};

export interface Round { pair: Pair; heard: 'a' | 'b'; voice: string; say: string }

/** Difficulty stages (Fluent-Forever ear training, progressive over the first two weeks):
 *  1 = isolated word, two familiar voices · 2 = isolated word, all voices ·
 *  3 = word embedded in a carrier phrase, all voices. */
export function buildRounds(lang: LangCode, n = 10, stage: 1 | 2 | 3 = 2, rnd: () => number = Math.random): Round[] {
  const pairs = PAIRS[lang] ?? PAIRS.fr;
  const voices = stage === 1 ? PRON_VOICES.slice(0, 2) : PRON_VOICES;
  return Array.from({ length: n }, (_, i) => {
    const pair = pairs[Math.floor(rnd() * pairs.length)];
    const heard: 'a' | 'b' = rnd() < 0.5 ? 'a' : 'b';
    const word = pair[heard];
    return {
      pair, heard,
      voice: voices[i % voices.length],
      say: stage === 3 ? (CARRIER[lang] ?? CARRIER.fr).replace('{}', word) : word
    };
  });
}

/** The first two weeks of an absolute-beginner (or A1) profile are the ear-training
 *  phase: perception first, shorter calls (Fluent Forever's ordering). */
export function earPhase(mem: { profile: { a0?: boolean }; cefr: { overall: number }; createdAt: string }): boolean {
  if (mem.cefr.overall > 1) return false; // only while the level IS still A0/A1
  return earDay(mem) <= 14;
}

/** 1-based day within the ear-training window. */
export function earDay(mem: { createdAt: string }): number {
  const ms = Date.now() - new Date(mem.createdAt + (mem.createdAt.length === 10 ? 'T00:00:00Z' : '')).getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

/** Stage for today: progressive during the ear phase, standard difficulty otherwise. */
export function earStageFor(mem: { profile: { a0?: boolean }; cefr: { overall: number }; createdAt: string }): 1 | 2 | 3 {
  if (!earPhase(mem)) return 2;
  const d = earDay(mem);
  return d <= 4 ? 1 : d <= 9 ? 2 : 3;
}
