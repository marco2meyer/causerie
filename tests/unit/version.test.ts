import { describe, expect, it, vi } from 'vitest';
import { buildDate, buildTime, deployedBuild, isStale, isStaleBuild, isStamp, versionLabel, watchForUpdate } from '../../src/lib/version';

/** A stub fetch standing in for the one call version.ts makes. */
const stub = (status: number, body: string): typeof fetch =>
  (async () => ({ ok: status >= 200 && status < 300, text: async () => body })) as unknown as typeof fetch;

const dead: typeof fetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;

describe('deployed build stamp', () => {
  it('accepts a stamp and rejects anything that merely came back with a 200', () => {
    expect(isStamp('20260819122500')).toBe(true);
    expect(isStamp(' 20260819122500 ')).toBe(true);
    expect(isStamp('<!doctype html><html>…')).toBe(false); // SPA fallback answering /build.txt
    expect(isStamp('')).toBe(false);
  });

  it('reads the stamp the server is serving', async () => {
    expect(await deployedBuild(stub(200, '20260819122500\n'))).toBe('20260819122500');
  });

  it('returns null rather than guessing when it cannot be established', async () => {
    expect(await deployedBuild(stub(404, 'Not found'))).toBeNull();
    expect(await deployedBuild(stub(200, '<!doctype html>'))).toBeNull();
    expect(await deployedBuild(dead)).toBeNull();
  });

  it('is stale only when a different build is demonstrably deployed', () => {
    expect(isStaleBuild('20260819122500', '20260819130000')).toBe(true);
    expect(isStaleBuild('20260819122500', '20260819122500')).toBe(false);
    expect(isStaleBuild('20260819122500', null)).toBe(false);  // unknown is never stale
    expect(isStaleBuild('dev', '20260819130000')).toBe(false); // dev server has no deploy
    expect(isStaleBuild('single', '20260819130000')).toBe(false);
  });

  it('never nags when the server cannot answer', async () => {
    expect(await isStale(dead)).toBe(false);
    expect(await isStale(stub(404, 'Not found'))).toBe(false);
    expect(await isStale(stub(200, '<!doctype html>'))).toBe(false);
  });
});

describe('watching for an update', () => {
  it('keeps looking while the tab just sits there in the foreground', async () => {
    // Regression: the watcher only re-checked on visibilitychange, so a tab opened and left
    // alone never noticed a deploy. A call was then made on a bundle hours out of date, and
    // the fix it was missing got reported as broken.
    vi.useFakeTimers();
    try {
      let checks = 0;
      let stale = false;
      const seen: number[] = [];
      const stop = watchForUpdate(() => seen.push(checks), async () => { checks++; return stale; }, 60_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(checks).toBe(1);            // the mount check

      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(checks).toBeGreaterThan(1); // …and it kept looking on its own
      expect(seen).toHaveLength(0);      // nothing deployed yet, so no nag

      stale = true;
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(seen).toHaveLength(1);      // fires once…

      const after = checks;
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(seen).toHaveLength(1);      // …and only once
      expect(checks).toBe(after);        // and stops looking afterwards
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops checking once unsubscribed', async () => {
    vi.useFakeTimers();
    try {
      let checks = 0;
      const stop = watchForUpdate(() => {}, async () => { checks++; return false; }, 60_000);
      await vi.advanceTimersByTimeAsync(0);
      stop();
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(checks).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the version number', () => {
  it('is the build time, shortened, and sorts chronologically', () => {
    expect(versionLabel('20260819193450')).toBe('v26.08.19.1934');
    expect(versionLabel('20261231000500')).toBe('v26.12.31.0005');
    expect(versionLabel('20260819193450') < versionLabel('20260819194000')).toBe(true);
  });

  it('leaves anything that is not a build stamp alone', () => {
    expect(versionLabel('dev')).toBe('dev');
    expect(versionLabel('single')).toBe('single');
    expect(versionLabel('20261345000000')).toBe('20261345000000'); // month 13, not a date
  });

  it('reads the stamp as an instant, strictly', () => {
    expect(buildDate('20260819193450')?.toISOString()).toBe('2026-08-19T19:34:50.000Z');
    expect(buildDate('20260230120000')).toBeNull(); // 30 February
    expect(buildDate('2026081919345')).toBeNull();  // 13 digits
    expect(buildDate('dev')).toBeNull();
  });

  it('shows the build time in German wall clock, not UTC', () => {
    // CEST in August: 19:34 UTC is 21:34 in Berlin. Reading a raw stamp is off by two
    // hours exactly when someone is checking whether the thing they just shipped is live.
    expect(buildTime('20260819193450', 'de-DE')).toBe('19.08.2026, 21:34');
    // …and CET in January, one hour.
    expect(buildTime('20260119193450', 'de-DE')).toBe('19.01.2026, 20:34');
  });

  it('has nothing to show when there is no build', () => {
    expect(buildTime('dev')).toBeNull();
  });
});
