import type { Memory, SessionRecord } from '../types';
import { todayISO } from './utils';

/** Banked missed days: one per REPAIR_EVERY uninterrupted days, at most REPAIR_MAX kept. */
export const REPAIR_EVERY = 5;
export const REPAIR_MAX = 3;

const dayNo = (d: string): number => Math.round(Date.parse(d + 'T12:00:00Z') / 86400000);

/** A day counts toward the streak when either the call or the review happened.
 *
 *  A missed day is bridged by spending a banked repair rather than by a blanket
 *  forgiveness rule: the old version quietly forgave every second day forever, which is
 *  not a streak. Repairs are all-or-nothing across a gap — covering two of three missed
 *  days would spend them for nothing — and an uncovered gap keeps whatever is banked,
 *  because the student never got the benefit of it. */
export function touchStreak(mem: Memory, d: string): void {
  if (mem.streak.last === d) return;
  const gap = mem.streak.last ? dayNo(d) - dayNo(mem.streak.last) : Infinity;
  let repairs = mem.streak.repairs ?? 0;
  if (gap === 1) {
    mem.streak.count = (mem.streak.count || 0) + 1;
  } else if (gap > 1 && gap !== Infinity && repairs >= gap - 1) {
    repairs -= gap - 1;
    mem.streak.count = (mem.streak.count || 0) + 1;
  } else {
    mem.streak.count = 1;
  }
  // Earned on the day the run reaches a multiple of five, and only then: touchStreak runs
  // at most once a day, so the count passes each multiple exactly once.
  if (mem.streak.count > 0 && mem.streak.count % REPAIR_EVERY === 0) {
    repairs = Math.min(REPAIR_MAX, repairs + 1);
  }
  mem.streak.repairs = repairs;
  mem.streak.last = d;
}

export function callDoneOn(mem: Memory, d: string): boolean {
  return mem.sessions.some(s => s.source === 'causerie' && s.date === d);
}

/** Review sittings finished on a day. A count rather than a yes/no: the day is planned
 *  around more than one of them (settings.sessionsPerDay), so "did any review happen" stopped
 *  being the whole question the moment the second sitting became part of the rhythm. */
export function reviewSessionsOn(mem: Pick<Memory, 'deck'>, d: string): number {
  return (mem.deck?.log ?? []).filter(l => l.date === d && !l.warmup).length;
}

/** Getting-to-know-you phase: the first three real calls, unless imported/skipped. */
export function introCallsDone(mem: Memory): number {
  return mem.sessions.filter(s => s.source === 'causerie').length;
}
export function inIntroPhase(mem: Memory): boolean {
  return !mem.introDone && introCallsDone(mem) < 3;
}

/* ---------- XP ---------- */

/** What a call's XP is made of. Kept as parts rather than a lone total: a number the
 *  student cannot decompose explains nothing, and an unexplained number on a review
 *  screen reads as a grade it is not. */
export interface XpParts {
  /** Minutes of conversation. */
  minutes: number;
  /** Targets of the day the analysis found achieved. */
  targets: number;
  /** Turns the analysis singled out as well said. */
  praise: number;
  /** Corrections the analysis wrote (capped, see XP_TIPS_CAP). */
  tips: number;
  /** Words the call asked the learner to place that they actually placed. */
  words: number;
}

/** A placed word is worth half a minute of talking: enough to feel like a win, not enough
 *  to make the call worth chasing words through. */
export const XP_RATE: Readonly<Record<keyof XpParts, number>> = { minutes: 10, targets: 5, praise: 2, tips: 1, words: 5 };
/** Corrections earn, but are capped: a call full of mistakes must not out-earn a good one. */
export const XP_TIPS_CAP = 10;

/** Per-part XP contribution — the arithmetic the post-call screen shows. */
export function xpShare(p: XpParts): XpParts {
  return {
    minutes: XP_RATE.minutes * p.minutes,
    targets: XP_RATE.targets * p.targets,
    praise: XP_RATE.praise * p.praise,
    tips: Math.min(XP_TIPS_CAP, XP_RATE.tips * p.tips),
    words: XP_RATE.words * p.words
  };
}

/** XP awarded for one conversation. Single source of the formula: merge.ts awards with
 *  it, the review screen explains with it, so the two can never drift apart. */
export function sessionXp(p: XpParts): number {
  const s = xpShare(p);
  return s.minutes + s.targets + s.praise + s.tips + s.words;
}

/** Rebuilds the parts of a stored session from its record, so the review screen can show
 *  the arithmetic behind an XP number it did not compute itself (old records included). */
export function xpPartsOf(sess: SessionRecord): XpParts {
  const an = sess.analysis;
  return {
    minutes: sess.minutes ?? 0,
    targets: (an?.targets ?? []).filter(t => t.achieved).length,
    praise: (an?.highlights ?? []).length,
    tips: (an?.corrections ?? []).length,
    words: (sess.wordGoals ?? []).filter(g => g.used).length
  };
}

/** A review session: a flat opening plus one per card graded. Here rather than in the
 *  view, so the screen that explains XP reads the same number the session awards. */
export const XP_REVIEW_BASE = 5;
export function reviewXp(cardsGraded: number): number {
  return XP_REVIEW_BASE + Math.max(0, cardsGraded);
}

/** Every XP_MILESTONE the running total crosses a round number. Deliberately a number
 *  and not a named "level": a milestone needs no vocabulary, and so no translation. */
export const XP_MILESTONE = 1000;

/** Progress of a running total toward its next round number. */
export function milestone(total: number): { reached: number; next: number; pct: number } {
  const t = Math.max(0, Math.floor(total || 0));
  const next = (Math.floor(t / XP_MILESTONE) + 1) * XP_MILESTONE;
  return { reached: Math.floor(t / XP_MILESTONE), next, pct: Math.min(100, (t / next) * 100) };
}

/* ---------- the week ---------- */

/** Monday of the week containing `d` (ISO date). Noon UTC avoids the DST edge that makes
 *  midnight arithmetic land on the wrong day twice a year. */
export function weekStart(d: string): string {
  const t = new Date(d + 'T12:00:00Z');
  const back = (t.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(t.getTime() - back * 86400000).toISOString().slice(0, 10);
}

/** XP per calendar day, from the only two things that award it. Conversations before XP
 *  existed have no `xp` and contribute nothing rather than a guess. */
export function xpByDay(mem: Pick<Memory, 'sessions' | 'deck'>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of mem.sessions ?? []) if (s.xp) out[s.date] = (out[s.date] ?? 0) + s.xp;
  for (const l of mem.deck?.log ?? []) if (l.xp) out[l.date] = (out[l.date] ?? 0) + l.xp;
  return out;
}

export interface WeekXp {
  /** Monday of the current week. */
  from: string;
  earned: number;
  /** Earned per day, Monday first, for the seven days of this week. */
  days: { date: string; xp: number }[];
}

export function weekXp(mem: Pick<Memory, 'sessions' | 'deck'>, today: string): WeekXp {
  const from = weekStart(today);
  const byDay = xpByDay(mem);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(new Date(from + 'T12:00:00Z').getTime() + i * 86400000).toISOString().slice(0, 10);
    return { date, xp: byDay[date] ?? 0 };
  });
  return { from, earned: days.reduce((a, b) => a + b.xp, 0), days };
}

/* ---------- rank ---------- */

/** Twelve rungs. The name of each lives in the language pack (ui.rank.names). */
export const RANK_MAX = 12;

/** XP a week must produce to KEEP a rank: 100 at the bottom, 50 more per rung, so the
 *  climb costs more the higher it goes and the top rungs mean something. Rank 1 is one
 *  conversation plus one review; rank 12 is most days of the week. */
export function rankMaintain(level: number): number {
  return 50 * (clampLevel(level) + 1);
}

/** And to CLIMB: a quarter more than holding position. The top rung has nowhere to go. */
export function rankAdvance(level: number): number {
  return Math.ceil(rankMaintain(level) * 1.25 / 5) * 5;
}

function clampLevel(n: number): number {
  return Math.max(1, Math.min(RANK_MAX, Math.round(n || 1)));
}

/** One week's verdict. */
export type { RankVerdict } from '../types';
import type { RankVerdict } from '../types';

export function judgeWeek(level: number, earned: number): RankVerdict {
  if (level < RANK_MAX && earned >= rankAdvance(level)) return 'up';
  if (earned >= rankMaintain(level)) return 'hold';
  return 'down';
}

/** The rank state as it stands, without touching the memory — the screens read it every
 *  render, and a render is no place to mutate the thing being rendered. A profile that has
 *  been going for a while starts its accounting at its first active week rather than at
 *  today, so weeks it already lived through are judged rather than skipped. */
export function rankOf(mem: Pick<Memory, 'rank' | 'sessions' | 'deck'>, today = todayISO()): NonNullable<Memory['rank']> {
  if (mem.rank) return { level: clampLevel(mem.rank.level), settled: mem.rank.settled, ...(mem.rank.history ? { history: mem.rank.history } : {}) };
  const days = Object.keys(xpByDay(mem)).sort();
  return { level: 1, settled: weekStart(days[0] ?? today) };
}

/** Judges every week that has ENDED since the last settlement and moves the rank. Runs on
 *  boot, so a fortnight away is judged as a fortnight rather than forgotten: an empty week
 *  earns nothing and costs a rung. The current week is never judged — it is not over. */
export function settleRank(mem: Memory, today = todayISO()): RankVerdict[] {
  const r = rankOf(mem, today);
  const thisWeek = weekStart(today);
  const byDay = xpByDay(mem);
  const out: RankVerdict[] = [];
  let cursor = r.settled;
  const history = (r.history ?? []).slice();
  // A runaway guard: 520 weeks is ten years, far past any real gap.
  for (let i = 0; i < 520 && cursor < thisWeek; i++) {
    const earned = weekTotal(byDay, cursor);
    const verdict = judgeWeek(r.level, earned);
    // The week is recorded at the level it was LIVED at, which is the level its thresholds
    // were judged against; the new level is what the learner carries into the next one.
    history.push({ week: cursor, verdict, level: r.level, xp: earned });
    r.level = clampLevel(r.level + (verdict === 'up' ? 1 : verdict === 'down' ? -1 : 0));
    out.push(verdict);
    cursor = addDaysISO(cursor, 7);
    r.settled = cursor;
  }
  // Half a year of weeks: enough for a quarterly check-in to see its whole window.
  if (history.length) r.history = history.slice(-26);
  mem.rank = r;
  return out;
}

function addDaysISO(d: string, n: number): string {
  return new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}

function weekTotal(byDay: Record<string, number>, from: string): number {
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += byDay[addDaysISO(from, i)] ?? 0;
  return sum;
}
