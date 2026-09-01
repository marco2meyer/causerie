import type { LangCode } from '../types';
import { PACKS } from '../lang';

/** Derived from the language packs: `name` is each language's name in ITSELF
 *  (universal picker convention), `en` feeds model instructions. */
export const LANGS: Record<LangCode, { name: string; en: string; flag: string }> =
  Object.fromEntries(Object.values(PACKS).map(p => [p.code, { name: p.self, en: p.en, flag: p.flag }])) as Record<LangCode, { name: string; en: string; flag: string }>;

export const VOICES = ['marin', 'cedar', 'sage', 'coral', 'alloy', 'ash', 'ballad', 'echo', 'shimmer', 'verse'];

/** Allowlists mirrored server-side in netlify/functions — keep both in sync. */
/** Call model. The standard model is the default; the mini is roughly a quarter of the
 *  price per call and correspondingly weaker at catching learner errors live. */
export const RT_DEFAULT = 'gpt-realtime-2.1';
export const RT_MINI = 'gpt-realtime-2.1-mini';
export const RT_MODELS = [RT_DEFAULT, 'gpt-realtime', 'gpt-realtime-2', 'gpt-realtime-1.5', RT_MINI, 'gpt-realtime-mini'];
export const AN_MODELS = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini'];
/** Text model that plays Odile in the turn-by-turn engine. `terra` by default rather than
 *  the cheapest tier: this leg costs a few cents either way — the voice is the expensive
 *  part of that engine — so the money is better spent on the model that actually holds a
 *  two-thousand-word briefing. First entry = default. */
export const TURN_DEFAULT = 'gpt-5.6-terra';
export const TURN_MODELS = [TURN_DEFAULT, 'gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.4-mini'];
/** Live in-call transcription (first entry = default; later entries = fallbacks). */
export const TR_MODELS = ['gpt-transcribe', 'gpt-live-transcribe', 'gpt-4o-transcribe'];
