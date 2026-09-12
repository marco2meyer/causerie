// Optional extension module. A build may carry a private module at
// src/lib/companion/index.ts; this seam finds it without a static import, so
// the public tree compiles and runs exactly the same when the folder is absent.
import type { ComponentType } from 'preact';
import type { Memory, Settings } from '../types';

/** What the app hands the extension so it can read and write the profile through the normal save path. */
export interface ExtensionHost {
  mem(): Memory | null;
  setMem(m: Memory): void;
  go(view: string): void;
  toast(msg: string, err?: boolean): void;
}

export interface CompanionModule {
  /** True when the server says this account has the extension. Never throws. */
  probe(): Promise<boolean>;
  attach(host: ExtensionHost): void;
  CompanionView: ComponentType<{ back(): void }>;
  TodayChip: ComponentType<{ open(): void }>;
  SettingsCard: ComponentType;
  AdminCard: ComponentType;
  /** Optional opt-in card shown inside the new-profile form: the extension pitches
   *  itself for the tutor being chosen (`tutor` is the profile's key, null until the
   *  student picks one), the choice rides `onChange`, and a yes routes to its page after
   *  signup. */
  OnboardingCard?: ComponentType<{ enabled: boolean; onChange(v: boolean): void; tutor?: string | null }>;
  /** Optional veto on a tutor change from the settings: the extension may ask the student
   *  and do its own bookkeeping first. False leaves the profile as it was. */
  onTutorSwitch?(key: string): Promise<boolean>;
  syncInbox(reason: 'boot' | 'visible' | 'call'): Promise<void>;
  /** A profile is being deleted: whatever the extension was running for it must go too,
   *  named by the profile's sync token. Nothing here knows what that means; the app only
   *  owes the call. Never throws — a deletion is not held up by an extension. */
  forgetProfile?(profileKey: string): Promise<boolean>;
  /** Cards the extension adds to each sitting while it is feeding the deck; 0 or absent when idle. */
  sessionSizeBonus?(): number;
  debug: Record<string, unknown>;
}

/** What the extension adds to a sitting right now: a whole number, never negative, 0 without one. */
export function sittingBonus(ext: CompanionModule | null | undefined): number {
  try {
    const n = Math.floor(ext?.sessionSizeBonus?.() ?? 0);
    return n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** The memory as the sitting planner and the queue builder should see it: the same object
 *  when the extension adds nothing, else a copy whose session size carries the bonus. */
export function withSittingBonus<M extends { settings: Pick<Settings, 'sessionSize'> }>(mem: M, ext: CompanionModule | null | undefined): M {
  const bonus = sittingBonus(ext);
  return bonus ? { ...mem, settings: { ...mem.settings, sessionSize: mem.settings.sessionSize + bonus } } : mem;
}

type Loader = () => Promise<unknown>;

// Empty object when the folder does not exist: the glob is resolved at build time.
const mods = import.meta.glob('./companion/index.ts') as Record<string, Loader>;

/** Load the first module in `map` whose probe answers yes; null when there is none. Pure enough to test. */
export async function loadFrom(map: Record<string, Loader>): Promise<CompanionModule | null> {
  for (const load of Object.values(map)) {
    try {
      const m = (await load()) as { companion?: CompanionModule; default?: CompanionModule };
      const mod = m.companion || m.default;
      if (!mod || typeof mod.probe !== 'function') continue;
      if (await mod.probe()) return mod;
    } catch {
      // A broken or refused module is the same as no module.
    }
  }
  return null;
}

let loading: Promise<CompanionModule | null> | null = null;
const waiters: ((m: CompanionModule) => void)[] = [];

/** Load once; later calls share the same answer. Call after the API mode is known. */
export function loadCompanion(): Promise<CompanionModule | null> {
  if (!loading) loading = loadFrom(mods).then(m => {
    if (m) for (const w of waiters.splice(0)) w(m);
    return m;
  });
  return loading;
}

/** Run `fn` once the module is loaded, without triggering the load itself. */
export function onCompanion(fn: (m: CompanionModule) => void): void {
  if (loading) void loading.then(m => { if (m) fn(m); });
  else waiters.push(fn);
}

/** Probe again. The boot load runs before anyone is signed in on a fresh device, and its
 *  null answer is memoized — so a login has to be allowed to ask a second time. */
export function reloadCompanion(): Promise<CompanionModule | null> {
  loading = null;
  return loadCompanion();
}
