import type { CEFRBand, CEFRLevel, SkillKey } from '../types';

/** 12-step scale: every CEFR band plus a "+" sublevel. Memory stores indexes into this. */
export const LEVELS: CEFRLevel[] = ['A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+', 'C2', 'C2+'];
export const BANDS: CEFRBand[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const SKILLS: [SkillKey, string][] = [
  ['grammar', 'grammaire'],
  ['vocabulary', 'vocabulaire'],
  ['fluency', 'aisance'],
  ['comprehension', 'compréhension']
];

const clamp = (i: number) => Math.max(0, Math.min(LEVELS.length - 1, Math.round(i)));

/** Level string → index; tolerates a bare band ("A2") and unknown input (→ -1). */
export function lvlIdx(s: string | null | undefined): number {
  const t = String(s ?? '').trim();
  const i = LEVELS.indexOf(t as CEFRLevel);
  if (i >= 0) return i;
  return LEVELS.indexOf(t.slice(0, 2).toUpperCase() as CEFRLevel);
}

export function idxLvl(i: number): CEFRLevel {
  return LEVELS[clamp(i)];
}

export function band(i: number): CEFRBand {
  return BANDS[Math.max(0, Math.min(5, Math.floor(clamp(i) / 2)))];
}
