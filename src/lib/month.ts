import type { Memory } from '../types';
import { todayISO } from './utils';

/** One square on the month grid: what happened on that day. */
export type DayMark = 'none' | 'call' | 'both' | 'today' | 'future';

export interface MonthDay { date: string; mark: DayMark }

export interface MonthStats {
  /** First of the month, ISO. */
  from: string;
  /** Days of the month, in order, padded at the front to start the grid on a Monday. */
  days: (MonthDay | null)[];
  /** Conversations held this month — the figure the month is named by. */
  scenes: number;
  /** CEFR band at the first reading of the month and at the last, when both exist. */
  levelFrom: number | null;
  levelTo: number | null;
  /** The level readings inside the month, for the line. */
  curve: { date: string; overall: number }[];
  /** Cards this month's calls produced. */
  cardsBorn: number;
  /** Words per minute, this month and the one before it, when there is speech to measure. */
  wpm: number | null;
  wpmPrev: number | null;
}

const iso = (y: number, m: number, d: number): string =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const avg = (xs: number[]): number | null =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

/** The month as the design draws it: a square per day, the level line across it, and the
 *  two figures that say whether anything moved. Deliberately not a score — a month with
 *  four scenes in it is a month with four scenes in it, and the grid says so without
 *  ranking it against anything. */
export function monthStats(mem: Memory, today = todayISO()): MonthStats {
  const [ty, tm] = today.split('-').map(Number);
  const y = ty, m = tm - 1;
  const from = iso(y, m, 1);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  const calls = new Set<string>();
  for (const s of mem.sessions) if (s.source === 'causerie' && s.date.startsWith(from.slice(0, 7))) calls.add(s.date);
  const reviews = new Set<string>();
  for (const l of mem.deck?.log ?? []) if (!l.warmup && l.date.startsWith(from.slice(0, 7))) reviews.add(l.date);

  // The grid starts on a Monday, so the first row is padded with blanks.
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const days: (MonthDay | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= last; d++) {
    const date = iso(y, m, d);
    const mark: DayMark = date === today ? 'today'
      : date > today ? 'future'
      : calls.has(date) && reviews.has(date) ? 'both'
      : calls.has(date) ? 'call'
      : 'none';
    days.push({ date, mark });
  }

  const curve = (mem.cefr.history ?? [])
    .filter(h => h.date >= from && h.date <= today)
    .map(h => ({ date: h.date, overall: h.overall }));

  const inMonth = mem.sessions.filter(s => s.source === 'causerie' && s.date >= from && s.date <= today);
  const prevMonth = (() => {
    const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
    const pre = iso(py, pm, 1).slice(0, 7);
    return mem.sessions.filter(s => s.source === 'causerie' && s.date.startsWith(pre));
  })();

  const ids = new Set(inMonth.map(s => s.id));
  const cardsBorn = (mem.deck?.cards ?? []).filter(c => c.sourceSessionId && ids.has(c.sourceSessionId)).length;

  return {
    from,
    days,
    scenes: inMonth.length,
    levelFrom: curve.length ? curve[0].overall : null,
    levelTo: curve.length ? curve[curve.length - 1].overall : null,
    curve,
    cardsBorn,
    wpm: avg(inMonth.map(s => s.wpm ?? 0).filter(Boolean)),
    wpmPrev: avg(prevMonth.map(s => s.wpm ?? 0).filter(Boolean))
  };
}

/** Days since the last day that counted, for the tag beside the level. Null while the run
 *  is live (today or yesterday), a count once days have actually been skipped. */
export function daysSkipped(mem: Memory, today = todayISO()): number | null {
  const last = mem.streak.last;
  if (!last) return null;
  const gap = Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(last + 'T12:00:00Z')) / 86400000);
  return gap > 1 ? gap - 1 : null;
}
