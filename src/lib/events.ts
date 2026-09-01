import { supaClient, supaEmail, supaSession } from './supa';

/** Who did what, when, and for how long.
 *
 *  The app has always known what one learner's memory holds and what their calls cost; it
 *  has never known who is using it at all. This is the other half: one row per meaningful
 *  act, written under the user's own session so row-level security decides who may read it
 *  back. Everything here is best-effort — a logging table that is missing, unreachable or
 *  refused must never cost the learner a call. */

/** The addresses allowed to read everyone's rows: `VITE_ADMIN_EMAILS`, comma-separated,
 *  baked in at build time (put it in `.env.local`). Mirrored by the RLS policy in
 *  docs/SCHEMA.sql: this list only decides whether the app OFFERS the screen, and the
 *  database decides whether the rows come back. Client-side gating alone is decoration —
 *  which is also why the address may sit in a public bundle: it grants nothing. */
export const parseAdminEmails = (raw: string | null | undefined): string[] =>
  (raw || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

export const ADMIN_EMAILS = parseAdminEmails(import.meta.env?.VITE_ADMIN_EMAILS);

export const isAdmin = (email: string | null | undefined, admins: string[] = ADMIN_EMAILS): boolean =>
  admins.includes((email || '').trim().toLowerCase());

/** What is worth recording. Deliberately few: an event stream nobody reads is a liability,
 *  and these four answer the questions actually asked of it. */
export type EventKind = 'login' | 'call' | 'review' | 'signup';

export interface UserEvent {
  user_id: string;
  email: string | null;
  kind: EventKind | string;
  seconds: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

/** One login row per app start, not per render. */
let loggedIn = false;

/** Records one event. Never throws, never blocks, never awaited by anything the learner
 *  is waiting on. */
export function logEvent(kind: EventKind, seconds?: number, meta?: Record<string, unknown>): void {
  const s = supaSession();
  const c = supaClient();
  if (!s?.user?.id || !c) return;               // signed out, or Supabase disabled in tests
  void (async () => {
    try {
      await c.from('user_events').insert({
        user_id: s.user.id,
        email: supaEmail() || null,
        kind,
        seconds: typeof seconds === 'number' && seconds > 0 ? Math.round(seconds) : null,
        meta: meta ?? null
      });
    } catch { /* the ledger is never worth an error on screen */ }
  })();
}

/** Called on every boot that finds a session; writes at most one row per app start.
 *  Carries the account's own creation date, which is the only place a client can see it. */
export function logLogin(): void {
  if (loggedIn) return;
  const s = supaSession();
  if (!s?.user?.id) return;
  loggedIn = true;
  logEvent('login', undefined, { created_at: s.user.created_at ?? null });
}

/** Test hook: forget that this app start already logged in. */
export function resetLoginOnce(): void { loggedIn = false; }

/* ------------------------------ the admin view ------------------------------ */

export interface UserStat {
  userId: string;
  email: string;
  /** When the account itself was created, when a login row carried it. */
  signedUp: string | null;
  firstSeen: string;
  lastSeen: string;
  logins: number;
  calls: number;
  callSeconds: number;
  reviews: number;
  reviewSeconds: number;
  /** Distinct calendar days with any activity — the only honest measure of a habit. */
  activeDays: number;
}

const day = (iso: string): string => (iso || '').slice(0, 10);

/** Rolls the raw rows into one line per user, newest activity first.
 *
 *  Aggregated here rather than in the database because PostgREST cannot group, and because
 *  a handful of users produce a handful of rows — the moment that stops being true this
 *  belongs in a view, and the shape of `UserStat` is what that view would return. */
export function summarise(rows: UserEvent[]): UserStat[] {
  const byUser = new Map<string, UserStat & { days: Set<string> }>();
  for (const r of rows) {
    if (!r.user_id) continue;
    let u = byUser.get(r.user_id);
    if (!u) {
      u = {
        userId: r.user_id, email: (r.email || '').toLowerCase(), signedUp: null,
        firstSeen: r.created_at, lastSeen: r.created_at,
        logins: 0, calls: 0, callSeconds: 0, reviews: 0, reviewSeconds: 0,
        activeDays: 0, days: new Set<string>()
      };
      byUser.set(r.user_id, u);
    }
    if (r.email && !u.email) u.email = r.email.toLowerCase();
    if (r.created_at < u.firstSeen) u.firstSeen = r.created_at;
    if (r.created_at > u.lastSeen) u.lastSeen = r.created_at;
    u.days.add(day(r.created_at));
    const created = r.meta && typeof r.meta.created_at === 'string' ? r.meta.created_at : null;
    if (created && (!u.signedUp || created < u.signedUp)) u.signedUp = created;
    const secs = Math.max(0, Number(r.seconds) || 0);
    if (r.kind === 'login') u.logins++;
    else if (r.kind === 'call') { u.calls++; u.callSeconds += secs; }
    else if (r.kind === 'review') { u.reviews++; u.reviewSeconds += secs; }
  }
  return [...byUser.values()]
    .map(({ days, ...u }) => ({ ...u, activeDays: days.size }))
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : a.lastSeen > b.lastSeen ? -1 : 0));
}

export interface Totals {
  users: number;
  /** Users with any activity in the last seven days. */
  active7: number;
  calls: number;
  callMinutes: number;
  reviews: number;
  reviewMinutes: number;
}

export function totals(stats: UserStat[], now = new Date().toISOString()): Totals {
  const cutoff = new Date(Date.parse(now) - 7 * 86_400_000).toISOString();
  return {
    users: stats.length,
    active7: stats.filter(u => u.lastSeen >= cutoff).length,
    calls: stats.reduce((a, u) => a + u.calls, 0),
    callMinutes: Math.round(stats.reduce((a, u) => a + u.callSeconds, 0) / 60),
    reviews: stats.reduce((a, u) => a + u.reviews, 0),
    reviewMinutes: Math.round(stats.reduce((a, u) => a + u.reviewSeconds, 0) / 60)
  };
}

/** Everyone's rows, for the admin screen. Returns null when the table is missing or the
 *  database refuses — which is what a non-admin gets, and is not an error worth a toast. */
export async function fetchEvents(sinceDays = 90): Promise<UserEvent[] | null> {
  const c = supaClient();
  if (!c) return null;
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  try {
    const { data, error } = await c
      .from('user_events')
      .select('user_id,email,kind,seconds,meta,created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) return null;
    return (data ?? []) as UserEvent[];
  } catch {
    return null;
  }
}
