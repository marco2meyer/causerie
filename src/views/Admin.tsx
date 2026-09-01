import { useEffect, useState } from 'preact/hooks';
import { fetchEvents, summarise, totals, type UserStat } from '../lib/events';
import { fmtDate } from '../lib/utils';
import { ui } from '../lang';

/** Who is using this, and how much.
 *
 *  Reachable only from an address the database agrees with: the app hides the entrance,
 *  and row-level security decides whether any rows come back — so a determined non-admin
 *  reaches an empty screen rather than someone else's data. Deliberately plain. It is an
 *  operator's screen, not part of the product, and dressing it up would be the tell that
 *  someone thought it was. */
export function Admin({ onBack }: { onBack: () => void }) {
  const S = ui();
  const [stats, setStats] = useState<UserStat[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    void fetchEvents().then(rows => {
      if (!rows) { setErr(true); return; }
      setStats(summarise(rows));
    });
  }, []);

  const t = stats ? totals(stats) : null;
  const mins = (s: number) => Math.round(s / 60);

  return (
    <div class="fadein" style="max-width:900px">
      <div class="spread" style="margin-bottom:16px">
        <h2 style="font-size:28px;line-height:1.1">{S.admin.title}</h2>
        <button class="btn subtle" onClick={onBack}>{S.common.close}</button>
      </div>

      {err && <div class="card muted">{S.admin.unavailable}</div>}
      {!err && !stats && <div class="card muted">{S.common.loading}</div>}

      {t && (
        <div class="stats" style="margin-bottom:16px">
          <div class="stat"><div class="v">{t.users}</div><div class="l">{S.admin.users}</div></div>
          <div class="stat"><div class="v">{t.active7}</div><div class="l">{S.admin.active7}</div></div>
          <div class="stat"><div class="v">{t.calls}</div><div class="l">{S.admin.calls}</div></div>
          <div class="stat"><div class="v">{t.callMinutes}</div><div class="l">{S.admin.callMin}</div></div>
          <div class="stat"><div class="v">{t.reviews}</div><div class="l">{S.admin.reviews}</div></div>
        </div>
      )}

      {stats && stats.length > 0 && (
        <div class="card">
          {/* A table on a phone is a table that scrolls, not one that wraps into mush. */}
          <div style="overflow-x:auto">
            <table class="vocab-t" style="min-width:640px">
              <tr>
                <th style="text-align:left">{S.admin.who}</th>
                <th style="text-align:left">{S.admin.signedUp}</th>
                <th style="text-align:left">{S.admin.lastSeen}</th>
                <th style="text-align:right">{S.admin.days}</th>
                <th style="text-align:right">{S.admin.calls}</th>
                <th style="text-align:right">{S.admin.callMin}</th>
                <th style="text-align:right">{S.admin.reviews}</th>
                <th style="text-align:right">{S.admin.logins}</th>
              </tr>
              {stats.map(u => (
                <tr key={u.userId}>
                  <td style="font-weight:600">{u.email || u.userId.slice(0, 8)}</td>
                  <td class="tiny">{u.signedUp ? fmtDate(u.signedUp.slice(0, 10)) : fmtDate(u.firstSeen.slice(0, 10)) + ' *'}</td>
                  <td class="tiny">{fmtDate(u.lastSeen.slice(0, 10))}</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums">{u.activeDays}</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums">{u.calls}</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums">{mins(u.callSeconds)}</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums">{u.reviews}</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums">{u.logins}</td>
                </tr>
              ))}
            </table>
          </div>
          <div class="tiny" style="margin-top:10px;line-height:1.5">{S.admin.note}</div>
        </div>
      )}

      {stats && stats.length === 0 && <div class="card muted">{S.admin.empty}</div>}
    </div>
  );
}
