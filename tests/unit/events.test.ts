import { describe, expect, it } from 'vitest';
import { isAdmin, parseAdminEmails, summarise, totals, type UserEvent } from '../../src/lib/events';

/* Who is using this, and how much. The app knew what one learner's memory held and what
 * their calls cost; it did not know whether anyone else had ever opened it. */

const ev = (o: Partial<UserEvent> & { user_id: string; kind: string; created_at: string }): UserEvent =>
  ({ email: null, seconds: null, meta: null, ...o });

describe('who counts as an admin', () => {
  const admins = parseAdminEmails('odile@example.test');

  it('is the configured address, and only that address', () => {
    expect(isAdmin('odile@example.test', admins)).toBe(true);
    expect(isAdmin('ODILE@example.test', admins)).toBe(true);   // case is not a credential
    expect(isAdmin('  odile@example.test  ', admins)).toBe(true);
    expect(isAdmin('odile@example.com', admins)).toBe(false);    // a different mailbox
    expect(isAdmin('odile@example.test.evil.test', admins)).toBe(false);
    expect(isAdmin('', admins)).toBe(false);
    expect(isAdmin(null, admins)).toBe(false);
    expect(isAdmin(undefined, admins)).toBe(false);
  });

  it('reads the list the way the env var is written: commas, spare whitespace, any case', () => {
    // docs/SCHEMA.sql carries the authoritative copy (the RLS policy); this list only
    // decides whether the app offers the screen. They have to agree or the entrance
    // leads nowhere.
    expect(parseAdminEmails(' A@x.test, b@y.test ,,')).toEqual(['a@x.test', 'b@y.test']);
    expect(parseAdminEmails('')).toEqual([]);
    expect(parseAdminEmails(undefined)).toEqual([]);
    // Nobody configured: nobody is an admin — the screen fails closed.
    expect(isAdmin('anyone@example.test', parseAdminEmails(undefined))).toBe(false);
  });
});

describe('rolling the log into one line per user', () => {
  const rows: UserEvent[] = [
    ev({ user_id: 'u1', email: 'a@x.test', kind: 'login', created_at: '2026-08-20T08:00:00Z', meta: { created_at: '2026-05-02T10:00:00Z' } }),
    ev({ user_id: 'u1', kind: 'call', seconds: 480, created_at: '2026-08-20T08:10:00Z' }),
    ev({ user_id: 'u1', kind: 'review', seconds: 300, created_at: '2026-08-20T20:00:00Z' }),
    ev({ user_id: 'u1', kind: 'call', seconds: 300, created_at: '2026-08-21T08:00:00Z' }),
    ev({ user_id: 'u2', email: 'b@x.test', kind: 'login', created_at: '2026-08-19T09:00:00Z' })
  ];

  it('counts each kind separately and sums the time', () => {
    const [u1] = summarise(rows).filter(u => u.userId === 'u1');
    expect(u1.calls).toBe(2);
    expect(u1.callSeconds).toBe(780);
    expect(u1.reviews).toBe(1);
    expect(u1.reviewSeconds).toBe(300);
    expect(u1.logins).toBe(1);
  });

  it('counts active DAYS, not events — three sittings in one day is one day', () => {
    const [u1] = summarise(rows).filter(u => u.userId === 'u1');
    expect(u1.activeDays).toBe(2);
  });

  it('takes the signup date from the account, and falls back to the first thing it saw', () => {
    const s = summarise(rows);
    expect(s.find(u => u.userId === 'u1')!.signedUp).toBe('2026-05-02T10:00:00Z');
    expect(s.find(u => u.userId === 'u2')!.signedUp).toBeNull();
    expect(s.find(u => u.userId === 'u2')!.firstSeen).toBe('2026-08-19T09:00:00Z');
  });

  it('finds the address wherever in the stream it appears', () => {
    // Only the login row carries an e-mail; a user whose login fell outside the window
    // would otherwise be an anonymous uuid.
    expect(summarise(rows).find(u => u.userId === 'u1')!.email).toBe('a@x.test');
  });

  it('puts whoever was here most recently first', () => {
    expect(summarise(rows).map(u => u.userId)).toEqual(['u1', 'u2']);
  });

  it('survives an empty log and rows with nothing in them', () => {
    expect(summarise([])).toEqual([]);
    expect(summarise([ev({ user_id: '', kind: 'login', created_at: '2026-08-20T08:00:00Z' })])).toEqual([]);
    const odd = summarise([ev({ user_id: 'u9', kind: 'call', seconds: null, created_at: '2026-08-20T08:00:00Z' })]);
    expect(odd[0].callSeconds).toBe(0);
  });
});

describe('the totals line', () => {
  const stats = summarise([
    ev({ user_id: 'u1', kind: 'call', seconds: 600, created_at: '2026-08-22T08:00:00Z' }),
    ev({ user_id: 'u2', kind: 'call', seconds: 600, created_at: '2026-08-01T08:00:00Z' }),
    ev({ user_id: 'u3', kind: 'review', seconds: 120, created_at: '2026-08-21T08:00:00Z' })
  ]);

  it('counts everyone, and separately whoever came back this week', () => {
    const t = totals(stats, '2026-08-23T00:00:00Z');
    expect(t.users).toBe(3);
    expect(t.active7).toBe(2);          // u2 was three weeks ago
    expect(t.calls).toBe(2);
    expect(t.callMinutes).toBe(20);
    expect(t.reviews).toBe(1);
    expect(t.reviewMinutes).toBe(2);
  });
});
