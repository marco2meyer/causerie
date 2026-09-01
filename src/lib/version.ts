/** Is the running bundle the deployed one?
 *
 *  The app is installable (`apple-mobile-web-app-capable`), and an installed web app on
 *  iOS will happily keep serving a bundle it cached days ago. The failure mode is silent
 *  and expensive: every shipped fix looks like it never shipped, and the bug report comes
 *  back against code that no longer exists. The build stamp is baked into the bundle by
 *  vite and emitted next to it as /build.txt; comparing the two is the whole mechanism. */

export const BUILD: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';

/** The versioning scheme, such as it is: the version IS the build time, in UTC, shortened
 *  to `v<YY.MM.DD.HHMM>`. Nothing to remember to bump, two builds can never collide, they
 *  sort chronologically as strings, and the age of what you are running is readable off
 *  the number itself. `dev` and `single` have no build time and stay as they are. */
export function versionLabel(build: string = BUILD): string {
  const d = buildDate(build);
  return d ? 'v' + build.slice(2, 4) + '.' + build.slice(4, 6) + '.' + build.slice(6, 8)
    + '.' + build.slice(8, 12) : build;
}

/** The stamp as a real instant, or null when it is not a stamp (dev, single, garbage).
 *  Parsed strictly: `20261345000000` is not a date and must not be shown as one. */
export function buildDate(build: string = BUILD): Date | null {
  if (!/^\d{14}$/.test(build)) return null;
  const n = (a: number, b: number) => Number(build.slice(a, b));
  const [y, mo, da, h, mi, s] = [n(0, 4), n(4, 6), n(6, 8), n(8, 10), n(10, 12), n(12, 14)];
  const d = new Date(Date.UTC(y, mo - 1, da, h, mi, s));
  const roundTrip = d.getUTCFullYear() === y && d.getUTCMonth() === mo - 1 && d.getUTCDate() === da
    && d.getUTCHours() === h && d.getUTCMinutes() === mi;
  return roundTrip ? d : null;
}

/** When this build went out, in German wall-clock time. The stamp is UTC and the person
 *  reading it is not, so a raw stamp is off by an hour or two exactly when it matters. */
export function buildTime(build: string = BUILD, locale = 'de-DE'): string | null {
  const d = buildDate(build);
  if (!d) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Berlin',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(d);
}

/** A build stamp, and nothing that merely looks like one. An SPA fallback answers any
 *  path with index.html, so an unvalidated body would report "stale" forever. */
const STAMP = /^[A-Za-z0-9._-]{4,40}$/;

export function isStamp(text: string): boolean {
  return STAMP.test(text.trim());
}

/** The stamp the server is currently serving, or null when it cannot be established
 *  (offline, dev server, single-file copy) — unknown never counts as stale. */
export async function deployedBuild(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const r = await fetchImpl('/build.txt', { cache: 'no-store' });
    if (!r.ok) return null;
    const t = (await r.text()).trim();
    return isStamp(t) ? t : null;
  } catch {
    return null;
  }
}

/** The comparison itself: stale only when a DIFFERENT build is demonstrably deployed.
 *  A dev server and the single-file copy have no deploy to be behind. */
export function isStaleBuild(local: string, remote: string | null): boolean {
  if (!remote || local === 'dev' || local === 'single') return false;
  return remote !== local;
}

/** True only when a different build is demonstrably deployed. */
export async function isStale(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (BUILD === 'dev' || BUILD === 'single') return false;
  return isStaleBuild(BUILD, await deployedBuild(fetchImpl));
}

/** Debounce for the foreground check, so flipping between tabs cannot hammer the server. */
const MIN_GAP_MS = 60 * 1000;
/** How often to look, independent of anything the user does. */
const POLL_MS = 5 * 60 * 1000;

/** Checks now, on every poll, and whenever the tab comes back to the foreground.
 *  Returns an unsubscribe. Fires `onStale` once and stops.
 *
 *  The poll is not redundant with the visibility handler. A tab that is opened and simply
 *  left in the foreground never fires `visibilitychange`, so the mount check was the only
 *  one it ever ran: the app would go on serving a bundle from hours ago, silently, which
 *  is how a shipped fix ends up being reported as not working. */
export function watchForUpdate(
  onStale: () => void, staleCheck: () => Promise<boolean> = isStale, pollMs = POLL_MS
): () => void {
  let stopped = false;
  let last = 0;
  const check = async () => {
    if (stopped || Date.now() - last < MIN_GAP_MS) return;
    last = Date.now();
    if (await staleCheck()) {
      if (stopped) return;
      stopped = true;
      onStale();
    }
  };
  const timer = setInterval(() => void check(), pollMs);
  const onVis = () => { if (document.visibilityState === 'visible') void check(); };
  void check();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
  return () => {
    stopped = true;
    clearInterval(timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
  };
}
