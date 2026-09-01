import type { FocusTarget, Memory } from '../types';
import { pack, PACKS } from '../lang';
import type { CheatSheet } from '../lang/types';
import { band } from './cefr';
import { probeTargets } from './competencies';
import { norm } from './utils';

/** Grammar cheat sheets. One compact card per concept: formation, the rules that
 *  matter, two or three examples with a native-language gloss, and the classic traps.
 *  A call carries at most two of them (from its focus targets and silent probes); they
 *  are readable before the call and from the in-call Matériel panel, which pauses the
 *  conversation while open. The sheets live in the language packs and reuse the
 *  competency-map ids, so a pinned matrix cell brings its sheet along automatically. */

export type { CheatSheet };

/** All sheets across languages (ids are globally unique; used for lookups and tests). */
export const SHEETS: CheatSheet[] = Object.values(PACKS).flatMap(p => p.sheets);
export const SHEET_BY_ID: Record<string, CheatSheet> = Object.fromEntries(SHEETS.map(s => [s.id, s]));

/** Calls whose sheets still count as "recently read". A sheet seen inside this window has
 *  had its chance for now; six is a working week and a bit — long enough for the rotation
 *  to be visible, short enough that a sheet you actually need comes back. */
export const SHEET_MEMORY = 6;

/** Sheet ids attached to the last few calls, newest first. */
export function recentSheets(mem: Memory, n = SHEET_MEMORY): string[] {
  return (mem.sessions ?? []).slice(-n).reverse().flatMap(s => s.materials ?? []);
}

/** CEFR band a sheet belongs to, read off the competency id it shares ("g-a2-passe-compose").
 *  Null for a sheet whose id carries no band. */
export function sheetBand(s: CheatSheet): string | null {
  const m = /(^|-)([abc][12])(-|$)/i.exec(s.id);
  return m ? m[2].toUpperCase() : null;
}

const BANDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** The two sheets for a call: one the call is actually about, one to keep the library moving.
 *
 *  Relevance alone was handing over the same sheet every day. The top weakness is stable by
 *  design — that is what makes it a weakness — so "accord de genre" won every call for as
 *  long as it stayed open, and the other forty sheets were never seen once. Relevance still
 *  gets the first slot; the second goes to whatever has gone longest unread, nearest the
 *  student's own band, so the grammar actually cycles.
 *
 *  A pinned matrix cell is the student asking for that sheet by name, so it outranks both. */
export function sheetsForCall(mem: Memory, targets: FocusTarget[]): CheatSheet[] {
  const lang = mem.profile.target || 'fr';
  const pool = pack(lang).sheets;
  if (!pool.length) return [];
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = (label: string, k: string) => new RegExp('\\b' + esc(norm(k)) + '\\b').test(norm(label));

  // What this call is about, most relevant first.
  const relevant: CheatSheet[] = [];
  const add = (x: CheatSheet | undefined) => {
    if (x && x.lang === lang && !relevant.find(y => y.id === x.id)) relevant.push(x);
  };
  const labels: { id: string | null; label: string }[] = [
    ...targets.map(t => ({ id: t.id, label: t.label })),
    ...probeTargets(mem, 2).map(p => ({ id: p.id, label: p.label }))
  ];
  for (const l of labels) {
    if (l.id && SHEET_BY_ID[l.id] && SHEET_BY_ID[l.id].lang === lang) { add(SHEET_BY_ID[l.id]); continue; }
    add(pool.find(x => x.match.some(k => hits(l.label, k))));
  }

  const seen = recentSheets(mem);
  // A finite sentinel, not Infinity: these numbers are SUBTRACTED in a comparator, and
  // Infinity - Infinity is NaN, which leaves the sort order to the engine's mercy.
  const NEVER = 1e6;
  const staleness = (x: CheatSheet) => {
    const i = seen.indexOf(x.id);
    return i < 0 ? NEVER : i;                     // not read recently = as stale as it gets
  };
  const pinned = new Set(mem.pinned ?? []);
  const out: CheatSheet[] = [];
  const take = (x: CheatSheet | undefined) => {
    if (x && !out.find(y => y.id === x.id) && out.length < 2) out.push(x);
  };

  // 1. Anything the student pinned, then the relevant sheet they have gone longest without.
  relevant.filter(x => pinned.has(x.id)).forEach(take);
  take(relevant.filter(x => !pinned.has(x.id)).sort((a, b) => staleness(b) - staleness(a))[0]);

  // 2. The rotation slot: longest unread, and among equals the one closest to their band —
  //    a B1 student cycling through A1 sheets would be reading the alphabet again.
  const here = BANDS.indexOf(band(mem.cefr.overall));
  const dist = (x: CheatSheet) => {
    const b = sheetBand(x);
    return b ? Math.abs(BANDS.indexOf(b) - (here < 0 ? 1 : here)) : 3;
  };
  take([...pool]
    .filter(x => !out.find(y => y.id === x.id))
    .sort((a, b) => staleness(b) - staleness(a) || dist(a) - dist(b))[0]);

  return out;
}

/** Resolve stored ids back to sheets (session objects carry ids only). */
export function sheetsById(ids: string[] | undefined): CheatSheet[] {
  return (ids ?? []).map(id => SHEET_BY_ID[id]).filter(Boolean);
}
