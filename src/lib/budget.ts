import type { Deck, Memory, Settings } from '../types';

/** How many cards a day may produce, so that the deck stays reviewable.
 *
 *  Every new card is a standing debt: it comes back six or seven times over its first year
 *  even when it is never failed, and more when it is. A call that produces sixteen cards a
 *  day against one fifteen-card evening is not generous, it is a queue that grows by ten a
 *  day and reads to the learner as homework they can never finish. The arithmetic that
 *  follows exists so the two halves of the day are sized against each other rather than
 *  each against itself.
 *
 *  The chain, with the shipped defaults:
 *    capacity  = sessionSize x sessionsPerDay          18 x 2  = 36 reviews a day
 *    new/day   = capacity / REVIEWS_PER_NEW_CARD       36 / 8  = 4 new cards a day
 *    per call  = new/day, throttled by the backlog             = 4, less when behind
 *    per session (intake) = new/day / sessionsPerDay           = 2 new cards a session
 *
 *  Everything downstream reads these two functions, so moving the session size or the number
 *  of sessions moves the card factory with it instead of leaving the two to drift apart. */

/** Reviews one new card generates over its first year.
 *
 *  From this deck's own SM-2 numbers (lib/srs.ts): a card answered "good" every time is due
 *  after 1, 3, 8, 19, 48 and 119 days, which is six reviews inside a year plus the sitting
 *  where it was learned. Roughly a third of cards lapse at least once and a lapse costs one
 *  or two extra sittings, so eight is the honest steady-state figure — deliberately not the
 *  optimistic seven, because a budget that is too generous is invisible until the queue has
 *  already grown. */
export const REVIEWS_PER_NEW_CARD = 8;

/** Below this a call stops being worth having: the two or three best things it surfaced
 *  always become cards, whatever the backlog says. */
export const MIN_CALL_CARDS = 2;

/** And above this it is a vocabulary list, not a conversation. */
export const MAX_CALL_CARDS = 8;

/** Days of unstarted new cards that count as a healthy buffer rather than a backlog. Enough
 *  that a missed evening or a good week of calls costs nothing; past it, the factory slows. */
export const BACKLOG_DAYS = 5;

/** Review sessions the day is planned around. Two — one before the call as retrieval
 *  practice, one in the evening — buys the deck twice the throughput for the same sitting
 *  length, which is the cheapest capacity there is. */
export const sessionsPerDay = (s: Pick<Settings, 'sessionsPerDay'>): number =>
  Math.max(1, Math.min(3, Math.round(s.sessionsPerDay ?? 2)));

/** Cards the day can actually get through. */
export const dailyReviewCapacity = (s: Settings): number => Math.max(1, s.sessionSize) * sessionsPerDay(s);

/** New cards a day this rhythm can carry without the queue growing. */
export function sustainableNewPerDay(s: Settings): number {
  const n = Math.floor(dailyReviewCapacity(s) / REVIEWS_PER_NEW_CARD);
  return Math.max(MIN_CALL_CARDS, Math.min(MAX_CALL_CARDS, n));
}

/** New cards one review session may start. The day's allowance, split across its sessions:
 *  the point of two sessions is spacing, not twice the intake. */
export function newPerSession(s: Settings): number {
  if (s.newAuto === false) return Math.max(0, s.newPerSession);
  return Math.max(1, Math.round(sustainableNewPerDay(s) / sessionsPerDay(s)));
}

/** New cards a sitting may start.
 *
 *  Inside the day's plan the daily allowance is split across the sittings: the point of a
 *  second sitting is spacing, not twice the intake. A sitting BEYOND the plan is different
 *  in kind — the day's work is finished and the student came back anyway — so the throttle
 *  comes off and the sitting fills with whatever is left, up to the session size. The
 *  budget exists to stop a queue the student never asked for. It was never meant to stop
 *  them studying, and a third sitting that still dribbles out two cards reads as the app
 *  rationing them rather than pacing them. */
export function newForSitting(s: Settings, sittingsDone: number): number {
  return beyondPlan(s, sittingsDone) ? Math.max(1, s.sessionSize) : newPerSession(s);
}

/** The day's planned sittings are done and the student came back anyway. Two things follow
 *  from it — the intake throttle comes off (above), and a queue that would otherwise be
 *  empty may reach past the stagger for cards dated forward (lib/srs buildSession). */
export const beyondPlan = (s: Pick<Settings, 'sessionsPerDay'>, sittingsDone: number): boolean =>
  sittingsDone >= sessionsPerDay(s);

/** New cards waiting that have never been seen. This is the number the learner feels as
 *  "more than I can review": overdue reviews are the schedule doing its job, an unstarted
 *  pile is work that was created and never asked for. */
export function newBacklog(deck: Pick<Deck, 'cards'>): number {
  return (deck?.cards ?? []).filter(c => c.state === 'new').length;
}

/** How many cards this call may add.
 *
 *  The daily allowance, scaled down by how far the unstarted pile has already run past its
 *  buffer, and never below MIN_CALL_CARDS: a call that surfaced a real mistake should not
 *  leave empty-handed because of a backlog it did not cause, and a floor that keeps
 *  producing is what makes the throttle safe to be aggressive elsewhere. */
export function callCardBudget(mem: Pick<Memory, 'deck' | 'settings'>): number {
  const base = sustainableNewPerDay(mem.settings);
  const buffer = base * BACKLOG_DAYS;
  const pressure = Math.max(0, Math.min(1, newBacklog(mem.deck) / buffer));
  return Math.max(MIN_CALL_CARDS, Math.round(base * (1 - pressure)));
}

/** How many sittings a day this learner actually does, from the last week of them.
 *
 *  The SETTING says how many the day is planned around; this says how many happen. They are
 *  different numbers and the difference matters, because the plan below divides the day's
 *  reviews between the sittings it expects — and dividing a day in two for somebody who only
 *  ever sits down once would simply lose them half their reviews.
 *
 *  Averaged over the days they reviewed at all, not over the calendar: a week away should
 *  not read as "this person does 0.3 sittings a day". */
export function observedSittings(mem: Pick<Memory, 'deck' | 'settings'>, today: string, days = 7): number {
  const from = new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const perDay = new Map<string, number>();
  for (const l of mem.deck?.log ?? []) {
    if (l.warmup || l.date < from || l.date > today) continue;
    perDay.set(l.date, (perDay.get(l.date) ?? 0) + 1);
  }
  if (!perDay.size) return sessionsPerDay(mem.settings);
  const avg = [...perDay.values()].reduce((a, b) => a + b, 0) / perDay.size;
  return Math.max(1, Math.min(sessionsPerDay(mem.settings), Math.round(avg)));
}

/** How much of today's reviewing belongs to THIS sitting.
 *
 *  The old answer was "all of it": a sitting took every card that was due, so the first one
 *  of the day swallowed the lot, the second found nothing owed and offered the two new cards
 *  it was allowed — a two-card sitting — and a third filled up again as the cards failed in
 *  the first came back round. Long, stub, long. None of it was deliberate; it fell out of
 *  taking greedily.
 *
 *  So the day is planned. The reviews owed are divided between the sittings still to come,
 *  and the last of them sweeps up whatever is left, so nothing is quietly carried to
 *  tomorrow. Two guards keep the division from being silly: it is never spread across more
 *  sittings than this learner actually does (observedSittings), and never across more than
 *  there is work to fill — ten cards is one sitting, not two of five. */
export function sittingPlan(
  mem: Pick<Memory, 'deck' | 'settings'>, sittingsDone: number, today: string
): { dueCap: number; newCap: number; sittings: number } {
  const size = Math.max(1, mem.settings.sessionSize);
  const due = (mem.deck?.cards ?? []).filter(c => c.state !== 'new' && c.due <= today).length;
  const newCap = newForSitting(mem.settings, sittingsDone);
  const worthSplitting = Math.max(1, Math.ceil((due + newCap) / size));
  const sittings = Math.max(1, Math.min(observedSittings(mem, today), worthSplitting));
  const left = Math.max(1, sittings - sittingsDone);
  return { dueCap: Math.ceil(due / left), newCap, sittings };
}

/** Days the current unstarted pile needs at this intake, for the screen that shows it. */
export function backlogDays(mem: Pick<Memory, 'deck' | 'settings'>): number {
  const perDay = newPerSession(mem.settings) * sessionsPerDay(mem.settings);
  return perDay > 0 ? Math.ceil(newBacklog(mem.deck) / perDay) : 0;
}
