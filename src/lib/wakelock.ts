/** Keeps the phone from locking itself while a screen is doing something hands-off.
 *
 *  A call is five to ten minutes in which the student never touches anything, and a phone
 *  locks well inside that. On iOS the locked page is suspended, WebRTC goes with it, and
 *  the call comes back as `connectionState: failed` — which the engine reports as a lost
 *  connection and the app ends as a dropped session. So this is not a comfort feature: it
 *  is the difference between a ten-minute conversation and four two-minute ones.
 *
 *  Two properties of the lock decide whether an implementation works at all:
 *
 *  - It is ALWAYS released when the document goes hidden. That is the specification, not
 *    a bug, so the visibility listener IS the feature: a request-once version survives
 *    every test and then dies the first time someone glances at a notification.
 *  - The request can simply be refused — low battery, power-saver mode, an older browser,
 *    an installed iOS PWA before 18.4. Every failure here is swallowed on purpose. A call
 *    must never fail because the screen wanted to sleep.
 */

/** Acquires a screen wake lock and keeps re-acquiring it for as long as the returned
 *  release function has not been called. Safe to call where the API does not exist, where
 *  it is refused, and on the server — it does nothing and says nothing. */
export function keepAwake(): () => void {
  let sentinel: WakeLockSentinel | null = null;
  let stopped = false;
  /** Bumped whenever the lock we are holding stops being the one we want, so a request
   *  still in flight when the page hides cannot install itself after the fact. */
  let gen = 0;

  const drop = (): void => {
    gen++;
    const s = sentinel;
    sentinel = null;
    if (s && !s.released) void s.release().catch(() => { /* the browser got there first */ });
  };

  const acquire = async (): Promise<void> => {
    if (stopped || sentinel) return;
    if (typeof navigator === 'undefined' || !navigator.wakeLock) return;
    // Requesting one for a hidden document is rejected anyway; not asking keeps the
    // console clean on every tab switch.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    const mine = gen;
    try {
      const s = await navigator.wakeLock.request('screen');
      if (stopped || mine !== gen) {
        void s.release().catch(() => { /* noop */ });
        return;
      }
      sentinel = s;
      // The browser lets go on its own terms too. Forget the sentinel when it does, so
      // the next visibility change asks for a new one instead of assuming it still holds.
      s.addEventListener('release', () => { if (sentinel === s) sentinel = null; });
    } catch { /* refused: the screen dims, and that is the whole consequence */ }
  };

  const onVis = (): void => {
    if (document.visibilityState === 'visible') void acquire();
    else drop();
  };

  void acquire();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);

  return () => {
    stopped = true;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    drop();
  };
}
