import type { CheckinAnswer, CheckinPeriod, CheckinRecord, Memory } from '../types';
import { api, OAI } from './api';
import { idxLvl } from './cefr';
import { compById } from './competencies';
import { LANGS } from './langs';
import { RANK_MAX, rankAdvance, rankMaintain, rankOf, weekStart } from './gamify';
import { pack } from '../lang';
import { directionFrom } from './steer';
export { directionFrom };
import { todayISO, uid } from './utils';

/** Periodic check-ins: a short, snappy review of the last week / month / quarter.
 *  The numbers are computed HERE, deterministically; one small model call turns them
 *  into three tight target-language sections plus two direction questions whose answers steer
 *  the next period (they land in the tutor briefing as the "cap"). */

export const PERIOD_DAYS: Record<CheckinPeriod, number> = { week: 7, month: 30, quarter: 90 };
const MIN_CALLS: Record<CheckinPeriod, number> = { week: 2, month: 6, quarter: 15 };

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Which week / month / quarter a date falls in. Two dates in the same period share a key.
 *
 *  The review used to be due seven days after the last one, which is a rolling window and
 *  drifts: do Sunday's check-in on Tuesday and every later one is a Tuesday check-in. A
 *  period review should be about a period — so it comes due when a new one BEGINS, which is
 *  also what makes "at the end of the week" true rather than approximately true. */
export function periodKey(p: CheckinPeriod, iso: string): string {
  if (p === 'week') return weekStart(iso);
  if (p === 'month') return iso.slice(0, 7);
  return iso.slice(0, 4) + '-Q' + (Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1);
}

function lastDate(mem: Memory, p: CheckinPeriod): string {
  const c = mem.checkins ?? { history: [] };
  const stored = p === 'week' ? c.lastWeekly : p === 'month' ? c.lastMonthly : c.lastQuarterly;
  return stored || (mem.createdAt || '').slice(0, 10) || todayISO();
}

function callsSince(mem: Memory, start: string): number {
  return mem.sessions.filter(s => s.source === 'causerie' && s.date >= start).length;
}

/** Which check-in is due today, if any. Larger periods win; each also requires enough
 *  activity in the window, so a quiet month never produces an empty report. */
export function dueCheckin(mem: Memory, today = todayISO()): CheckinPeriod | null {
  // Put off until tomorrow. Asking again on the next open of the same day is nagging, and a
  // review nobody wants to do is a review nobody reads.
  if (mem.checkins?.snoozedOn === today) return null;
  for (const p of ['quarter', 'month', 'week'] as CheckinPeriod[]) {
    const last = lastDate(mem, p);
    // A period that has ENDED, and enough in it to be worth reviewing: a quiet fortnight
    // should not produce a report about nothing.
    if (periodKey(p, last) !== periodKey(p, today) && callsSince(mem, last) >= MIN_CALLS[p]) return p;
  }
  return null;
}

export interface CheckinStats {
  period: CheckinPeriod;
  start: string;
  end: string;
  calls: number;
  minutes: number;
  cardsAdded: number;
  reviews: number;
  cardsSues: number;
  cardsVues: number;
  levelStart: string | null;
  levelEnd: string;
  skillsEnd: Record<string, string>;
  weaknessesResolved: string[];
  weaknessesPersisting: string[];
  weaknessesNew: string[];
  compGained: string[];
  compFailed: string[];
  topics: string[];
  /** The weekly ladder: where the learner stands, what a week has to earn, and what every
   *  judged week in this window actually did. Without it the check-in was blind to the one
   *  thing the home screen leads with, and could congratulate a student the same week the
   *  app had silently demoted them. */
  rank: RankFacts;
  streakDays: number;
  repairsBanked: number;
  previousDirection: string | null;
}

export interface RankFacts {
  level: number;
  of: number;
  name: string;
  /** XP a week must earn to keep this rank, and to climb from it. */
  hold: number;
  climb: number;
  /** Judged weeks inside the window, oldest first. `level` is the rank the week was lived at. */
  weeks: { week: string; verdict: string; level: number; xp: number }[];
  /** Net rungs across the window: what the ladder did, in one number. */
  net: number;
}

function rankFacts(mem: Memory, start: string): RankFacts {
  const r = rankOf(mem);
  const names = pack(mem.profile.target).ui.rank.names;
  // Only weeks that ended inside the window: a check-in that reaches back further would be
  // re-litigating weeks the last one already reported on.
  const weeks = (mem.rank?.history ?? []).filter(w => w.week >= weekStart(start));
  const up = weeks.filter(w => w.verdict === 'up').length;
  const down = weeks.filter(w => w.verdict === 'down').length;
  return {
    level: r.level, of: RANK_MAX, name: names[r.level - 1] ?? '',
    hold: rankMaintain(r.level), climb: rankAdvance(r.level),
    weeks: weeks.map(w => ({ week: w.week, verdict: w.verdict, level: w.level, xp: w.xp })),
    net: up - down
  };
}

export function windowStats(mem: Memory, period: CheckinPeriod, today = todayISO()): CheckinStats {
  const start = lastDate(mem, period);
  const sess = mem.sessions.filter(s => s.source === 'causerie' && s.date >= start);
  const logs = (mem.deck.log ?? []).filter(l => l.date >= start);
  const histBefore = mem.cefr.history.filter(h => h.date < start);
  const levelStart = histBefore.length ? idxLvl(histBefore[histBefore.length - 1].overall) : (mem.cefr.history.length ? idxLvl(mem.cefr.history[0].overall) : null);
  const inWin = (d: string) => d >= start;
  return {
    period, start, end: today,
    calls: sess.length,
    minutes: sess.reduce((a, s) => a + (s.minutes ?? 0), 0),
    cardsAdded: sess.reduce((a, s) => a + (s.cardsAdded ?? 0), 0),
    reviews: logs.length,
    cardsSues: logs.reduce((a, l) => a + l.good + l.easy, 0),
    cardsVues: logs.reduce((a, l) => a + l.total, 0),
    levelStart,
    levelEnd: idxLvl(mem.cefr.overall),
    skillsEnd: {
      grammaire: idxLvl(mem.cefr.skills.grammar),
      vocabulaire: idxLvl(mem.cefr.skills.vocabulary),
      aisance: idxLvl(mem.cefr.skills.fluency),
      compréhension: idxLvl(mem.cefr.skills.comprehension)
    },
    weaknessesResolved: mem.weaknesses.filter(w => w.status === 'resolved' && inWin(w.lastSeen)).map(w => w.label),
    weaknessesPersisting: mem.weaknesses.filter(w => w.status === 'persisting').map(w => w.label),
    weaknessesNew: mem.weaknesses.filter(w => w.status === 'new' && inWin(w.firstSeen)).map(w => w.label),
    compGained: Object.entries(mem.comp ?? {})
      .filter(([, e]) => e.status === 'ok' && inWin(e.lastSeen))
      .map(([id]) => compById(mem.profile.target)[id]?.label).filter(Boolean) as string[],
    compFailed: Object.entries(mem.comp ?? {})
      .filter(([, e]) => e.status === 'ko')
      .map(([id]) => compById(mem.profile.target)[id]?.label).filter(Boolean) as string[],
    topics: sess.slice(-10).map(s => s.topic),
    rank: rankFacts(mem, start),
    streakDays: mem.streak?.count ?? 0,
    repairsBanked: mem.streak?.repairs ?? 0,
    previousDirection: mem.checkins?.direction || null
  };
}

export interface CheckinData {
  titre: string;
  progres: string[];
  motifs: string[];
  cap: string;
  questions: { q: string; options: string[] }[];
}

export const CHECKIN_SCHEMA = {
  name: 'periodic_checkin',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      titre: { type: 'string', description: 'Short dry headline for the period in the TARGET language, max 60 chars, informal address.' },
      progres: { type: 'array', items: { type: 'string' }, description: '2-3 SHORT target-language lines on what concretely improved, grounded only in the data (cite levels/counts where telling).' },
      motifs: { type: 'array', items: { type: 'string' }, description: '1-2 SHORT target-language lines: recurring patterns worth focused work next period.' },
      cap: { type: 'string', description: 'One short target-language sentence proposing the focus of the next period.' },
      questions: {
        type: 'array',
        description: 'EXACTLY 2 direction questions for the next period.',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            q: { type: 'string', description: 'Short target-language question about direction.' },
            options: { type: 'array', items: { type: 'string' }, description: 'EXACTLY 3 short answer options, each phrased as a directive (e.g. "Monter la difficulté").' }
          },
          required: ['q', 'options']
        }
      }
    },
    required: ['titre', 'progres', 'motifs', 'cap', 'questions']
  }
} as const;

const SYS = (langEn: string) => `You are the progress-review engine of a ${langEn} tutoring app (tutor persona: dry, kind, no gushing, informal address). From the JSON stats, produce a SHORT check-in, entirely in simple ${langEn}. Rules: progres = 2-3 lines, each one concrete improvement grounded ONLY in the data (levels reached, cells gained, cards learned, regularity); never invent. motifs = 1-2 lines naming the clearest recurring pattern(s) to work on next period (persisting weaknesses, failed competencies). cap = one-sentence proposal for the next period. questions = exactly 2 short direction questions the student answers with one tap, each with exactly 3 short DIRECTIVE options (about e.g. difficulty up vs consolidate, themes to rotate, more grammar drills vs free talk, call length); if previousDirection exists, one question may check whether to keep it. Everything tight: no filler, no emoji, max ~12 words per line.

THE WEEKLY RANK. \`rank\` is a ladder of ${RANK_MAX} rungs, judged once a week, Monday to Sunday, on XP alone. A week earning \`rank.hold\` keeps the rung, \`rank.climb\` takes the next one, anything less drops one. \`rank.weeks\` is every week already judged inside this window, oldest first, each recorded at the rung it was lived at; \`rank.net\` is the rungs gained minus lost. Rules: (a) exactly ONE line of progres or motifs must address the ladder, and it must match the data — say plainly that the rank fell when \`rank.net\` is negative, and do not congratulate a drop; a run of holds is steadiness, not a stall. (b) The rank measures HOW MUCH work, never how good it was, so never treat a rung as a level: an unchanged rank alongside a level gain is normal and worth saying. (c) \`cap\` may name what next week needs in XP, but only the honest number: \`rank.hold\` to stay, \`rank.climb\` to climb. (d) Mention \`streakDays\` only when it is genuinely notable, and never scold a short one.`;

/** One small model call (low reasoning) over the computed stats. */
export async function runCheckin(mem: Memory, period: CheckinPeriod): Promise<CheckinData> {
  const stats = windowStats(mem, period);
  const model = mem.settings.analysisModel || 'gpt-5.6-sol';
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: SYS((LANGS[mem.profile.target] ?? LANGS.fr).en) },
      { role: 'user', content: JSON.stringify(stats) }
    ],
    response_format: { type: 'json_schema', json_schema: CHECKIN_SCHEMA }
  };
  if (model.startsWith('gpt-5')) body.reasoning_effort = 'low';
  let r: Response;
  if (api.useServer()) {
    r = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...api.authHeaders() },
      body: JSON.stringify(body)
    });
    if (r.status === 401) throw new Error('AUTH');
  } else {
    r = await fetch(OAI() + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + api.getKey() },
      body: JSON.stringify(body)
    });
  }
  if (!r.ok) throw new Error('bilan (' + r.status + ')');
  const j = await r.json();
  const data = JSON.parse(j.choices?.[0]?.message?.content ?? '{}') as CheckinData;
  data.questions = (data.questions ?? []).slice(0, 2);
  return data;
}

/** Saves the record, stamps the period (a quarterly also covers month and week) and
 *  turns the chosen answers into the direction the next briefings follow. */
export function applyCheckin(mem: Memory, period: CheckinPeriod, data: CheckinData, answers: CheckinAnswer[]): CheckinRecord {
  const d = todayISO();
  mem.checkins = mem.checkins ?? { history: [] };
  const rec: CheckinRecord = {
    id: uid('chk'), date: d, period,
    titre: data.titre, progres: data.progres, motifs: data.motifs, cap: data.cap,
    answers
  };
  mem.checkins.history.push(rec);
  if (mem.checkins.history.length > 24) mem.checkins.history = mem.checkins.history.slice(-24);
  mem.checkins.lastWeekly = d;
  if (period === 'month' || period === 'quarter') mem.checkins.lastMonthly = d;
  if (period === 'quarter') mem.checkins.lastQuarterly = d;
  const dir = directionFrom(answers);
  if (dir) mem.checkins.direction = dir;
  delete mem.checkins.snoozedOn;
  return rec;
}
