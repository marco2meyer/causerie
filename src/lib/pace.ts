import type { Memory } from '../types';
import { newPerSession, REVIEWS_PER_NEW_CARD } from './budget';
import { todayISO } from './utils';

/** Is the deck keeping up with itself?
 *
 *  lib/budget answers this from the SETTINGS: how many cards a day the chosen rhythm could
 *  carry if it were kept to. This answers it from what actually happened — the cards really
 *  made and the sittings really done over the last week — because the two are not the same
 *  question and only one of them is about the learner.
 *
 *  Both sides are put in the same unit, new cards per day, which is the only way the
 *  comparison means anything: reviews and cards are different things and a chart with one
 *  of each in it is decoration. What a day of reviewing is WORTH in new cards is its review
 *  count over REVIEWS_PER_NEW_CARD — the eight sittings a card costs across its first year
 *  (see lib/budget for where eight comes from). Against that goes the number of cards that
 *  day actually produced. Above the line the pile grows; below it, it drains. */

export interface PaceDay {
  date: string;
  /** Cards created that day. */
  added: number;
  /** Cards reviewed that day, across every sitting. */
  reviews: number;
  /** Cards that left the unstarted pile that day. */
  started: number;
  /** What that day's reviewing can carry, in new cards a day. */
  carried: number;
}

export interface Pace {
  days: PaceDay[];
  addedPerDay: number;
  reviewsPerDay: number;
  startedPerDay: number;
  /** New cards a day the observed reviewing can sustain. */
  carriedPerDay: number;
  /** Cards made but never yet seen. */
  backlog: number;
  /** Cards a day the pile is growing by; negative while it drains. */
  netPerDay: number;
  /** Days for the pile to empty at the observed rates, null while it is growing. */
  daysToClear: number | null;
  verdict: 'clearing' | 'level' | 'growing' | 'idle';
  /** True while no sitting in the window recorded what it started, so `startedPerDay` is an
   *  estimate from the settings rather than something the student was observed doing. */
  startedEstimated: boolean;
}

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A day either side of level counts as level: this is a weekly average of small integers,
 *  and a deck that is "growing by 0.1 cards a day" is a deck that is fine. */
const LEVEL = 0.35;

export function deckPace(mem: Pick<Memory, 'deck' | 'settings'>, today = todayISO(), window = 7): Pace {
  const cards = mem.deck?.cards ?? [];
  const log = mem.deck?.log ?? [];
  const end = Date.parse(today + 'T00:00:00Z');
  const dates: string[] = [];
  for (let i = window - 1; i >= 0; i--) dates.push(iso(end - i * DAY));
  const first = dates[0];

  const days: PaceDay[] = dates.map(date => {
    const added = cards.filter(c => (c.createdTs ? iso(c.createdTs) : c.createdAt) === date).length;
    const sittings = log.filter(l => l.date === date);
    const reviews = sittings.reduce((a, l) => a + (l.total || 0), 0);
    const started = sittings.reduce((a, l) => a + (l.started || 0), 0);
    return { date, added, reviews, started, carried: reviews / REVIEWS_PER_NEW_CARD };
  });

  const per = (n: number) => Math.round((n / window) * 100) / 100;
  const sum = (k: 'added' | 'reviews' | 'started') => days.reduce((a, d) => a + d[k], 0);
  const addedPerDay = per(sum('added'));
  const reviewsPerDay = per(sum('reviews'));
  const carriedPerDay = per(sum('reviews') / REVIEWS_PER_NEW_CARD);

  // Sittings logged before `started` existed report nothing, and a zero there would read as
  // "you started no cards" rather than "nobody was counting". Fall back to the settings —
  // and say so, rather than presenting an assumption as an observation.
  const startedLogged = log.some(l => l.date >= first && l.started != null);
  const sittings = days.reduce((a, d) => a + (d.reviews > 0 ? 1 : 0), 0);
  const startedPerDay = startedLogged
    ? per(sum('started'))
    : per(sittings * newPerSession(mem.settings));

  const backlog = cards.filter(c => c.state === 'new').length;
  const netPerDay = Math.round((addedPerDay - carriedPerDay) * 100) / 100;
  const idle = reviewsPerDay === 0 && addedPerDay === 0;
  const verdict: Pace['verdict'] =
    idle ? 'idle' : netPerDay > LEVEL ? 'growing' : netPerDay < -LEVEL ? 'clearing' : 'level';
  // Emptying the pile is a different sum from sustaining the intake: what drains it is the
  // rate cards are STARTED at, less the rate new ones arrive.
  const drain = startedPerDay - addedPerDay;
  const daysToClear = backlog > 0 && drain > 0 ? Math.ceil(backlog / drain) : null;

  return {
    days, addedPerDay, reviewsPerDay, startedPerDay, carriedPerDay,
    backlog, netPerDay, daysToClear, verdict, startedEstimated: !startedLogged
  };
}
