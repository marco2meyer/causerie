import type { CEFRBand, CompCategory, Memory } from '../types';
import { pack, PACKS } from '../lang';
import type { CompItem } from '../lang/types';
import { band, BANDS } from './cefr';

/** The A1–C2 competency map. Learners have ISLANDS of knowledge, not a linear level:
 *  a B1 speaker may lack A2 basics and command the odd C1 structure. Every item is one
 *  cell of the matrix (Memory → Map): grey until evidence exists, then green (mastered),
 *  red (attempted/needed and missing) or amber (mixed). The tutor quietly probes grey
 *  cells below the current level; the analysis fills cells from evidence.
 *  The items themselves live in the language packs (src/lang/<code>.ts) — each target
 *  language has its own map. */

export type { CompItem };

/** The active profile's competency library. */
export const compLib = (lang?: string): CompItem[] => pack(lang).comp;

const BY_ID: Record<string, Record<string, CompItem>> = Object.fromEntries(
  Object.values(PACKS).map(p => [p.code, Object.fromEntries(p.comp.map(c => [c.id, c]))])
);

export const compById = (lang?: string): Record<string, CompItem> => BY_ID[pack(lang).code];

/* Back-compat (tests, seeded French profiles): the French map under its historic names. */
export const COMP_LIB: CompItem[] = PACKS.fr.comp;
export const COMP_BY_ID: Record<string, CompItem> = BY_ID.fr;

export function compForCell(cat: CompCategory, b: CEFRBand, lang?: string): CompItem[] {
  return compLib(lang).filter(c => c.cat === cat && c.band === b);
}

const bandIdx = (b: CEFRBand) => BANDS.indexOf(b);

/** Library subset the analysis maps onto: everything up to one band above the current level
 *  (higher islands are still reported via id:null free-text). */
export function compLibForAnalysis(mem: Memory): CompItem[] {
  const cur = bandIdx(band(mem.cefr.overall));
  return compLib(mem.profile.target).filter(c => bandIdx(c.band) <= Math.min(5, cur + 1));
}

/** What Odile quietly probes this call: pinned cells first (all of them), then grey
 *  cells from the bands BELOW the current level (foundations before frontier, rotated
 *  by day), falling back to grey cells of the current band. */
export function probeTargets(mem: Memory, n = 2): CompItem[] {
  const byId = compById(mem.profile.target);
  const lib = compLib(mem.profile.target);
  const out: CompItem[] = (mem.pinned ?? []).map(id => byId[id]).filter(Boolean);
  const total = Math.max(n, out.length);
  const cur = bandIdx(band(mem.cefr.overall));
  const grey = lib.filter(c =>
    bandIdx(c.band) <= cur && !(mem.comp ?? {})[c.id] && !out.find(x => x.id === c.id));
  const lower = grey.filter(c => bandIdx(c.band) < cur);
  const pool = lower.length ? lower : grey;
  const day = Math.floor(Date.now() / 86400000);
  for (let i = 0; out.length < total && i < pool.length; i++) {
    const it = pool[(day * 3 + i) % pool.length];
    if (!out.find(x => x.id === it.id)) out.push(it);
  }
  return out.slice(0, total);
}
