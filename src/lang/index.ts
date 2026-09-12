import type { LangCode, Memory } from '../types';
import { setDateLocale } from '../lib/utils';
import type { LangPack } from './types';
import { tutorize, type TutorIdentity } from './tutor';
import { fr, type UIStrings } from './fr';
import { es } from './es';
import { it } from './it';
import { pt } from './pt';
import { en } from './en';
import { deUi } from './de';

/** Registry + active-language switch. CONTENT (tutor briefing, competency map, cheat
 *  sheets) always comes from the target-language pack. The UI language is separate:
 *  it follows the target language from B1 on (immersion), and the support language
 *  below that (an A1 learner cannot read an all-target-language app) — overridable in
 *  the settings. German exists as a UI-only pack for German-native learners.
 *  app.tsx calls setUiLang on every render, so switching profiles relabels instantly. */

export const PACKS: Record<LangCode, LangPack> = { fr, es, it, pt, en };

export type UiLangCode = LangCode | 'de';

const UI_ONLY: Record<'de', UIStrings> = { de: deUi };

let current: UiLangCode = 'fr';

export function setUiLang(code?: string): void {
  current = code && (code === 'de' || PACKS[code as LangCode]) ? (code as UiLangCode) : 'fr';
  setDateLocale(current === 'de' ? 'de-DE' : PACKS[current as LangCode].locale);
  // Screen readers pick the right voice for the chrome; content spans carry their own lang.
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}

/* The packs are written for Odile; when another tutor takes the calls, every string that
 * comes out of pack()/ui() is rewritten for them (lang/tutor.ts). The rewrite runs once
 * per (language, tutor) and is cached; with Odile it costs nothing at all. app.tsx keeps
 * this in step with the active profile the same way it does setUiLang. */
let tutorId: TutorIdentity = { key: 'odile', name: 'Odile', gender: 'f' };
const tutorized = new WeakMap<object, { key: string; value: unknown }>();

export function setTutor(t: TutorIdentity): void {
  tutorId = t;
}

function forTutor<T extends object>(obj: T, lang: string): T {
  if (tutorId.key === 'odile') return obj;
  const hit = tutorized.get(obj);
  if (hit && hit.key === tutorId.key) return hit.value as T;
  const value = tutorize(obj, lang, tutorId);
  tutorized.set(obj, { key: tutorId.key, value });
  return value;
}

/** The content pack for an explicit language, or the active UI language when omitted
 *  (falls back to French when the UI runs in a support-only language like German). */
export function pack(code?: string): LangPack {
  const c = code && PACKS[code as LangCode] ? (code as LangCode) : current;
  const p = PACKS[c as LangCode] ?? PACKS.fr;
  return forTutor(p, p.code);
}

export const ui = (): UIStrings =>
  current === 'de' ? forTutor(UI_ONLY.de, 'de') : forTutor(PACKS[current as LangCode].ui, current);

/** The UI language currently in effect. */
export const uiLangCode = (): UiLangCode => current;

/** BCP-47 locale for the active UI language, for Intl formatting. */
export const uiLocale = (): string => (current === 'de' ? 'de-DE' : PACKS[current as LangCode].locale);

/** UI strings a given memory WILL use (e.g. to toast in the language being switched to). */
export function uiFor(mem: Memory): UIStrings {
  const c = uiLangFor(mem);
  return c === 'de' ? UI_ONLY.de : PACKS[c].ui;
}

/** Browser locale → a UI language we have; used before any profile exists. */
export function detectUiLang(): UiLangCode {
  const l = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase();
  if (l === 'de') return 'de';
  return PACKS[l as LangCode] ? (l as LangCode) : 'en';
}

const B1_IDX = 4; // LEVELS index of B1

const supportUi = (native: 'de' | 'en' | undefined): UiLangCode => (native === 'en' ? 'en' : 'de');

/** UI language for a profile: setting override, else target from B1, support below. */
export function uiLangFor(mem: Memory | null | undefined): UiLangCode {
  if (!mem) return detectUiLang();
  const sup = mem.profile.support ?? mem.profile.native;
  const pref = mem.settings.uiLang ?? 'auto';
  if (pref === 'target') return mem.profile.target;
  if (pref === 'support') return supportUi(sup);
  return mem.cefr.overall >= B1_IDX ? mem.profile.target : supportUi(sup);
}
