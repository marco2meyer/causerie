import type { CostRow } from './supa';
import { activeProfile } from './profiles';

/* ---- local ledger (no account): same shape as the server rows ------------- */

/** USD per 1M tokens — mirror of the server table (developers.openai.com/api/docs/pricing,
 *  short-context tier, re-checked 2026-08-21); the local ledger is an estimate for
 *  access-code/own-key users who have no server rows. The three gpt-5.6 rows carried
 *  exactly half the real rate until that check, so every text leg — the analysis on every
 *  call — read at half what it actually cost. `*_cached` matters on Realtime calls: the whole conversation is
 *  re-sent as input every turn, and those repeat tokens bill at a fraction of the full rate.
 *  `per_minute` is USD per MINUTE OF AUDIO — the transcription models bill that way, and
 *  those rows need `audio_seconds` rather than a token count. */
interface Price {
  text_in?: number; text_cached?: number; text_out?: number;
  audio_in?: number; audio_cached?: number; audio_out?: number;
  per_minute?: number;
}

const LOCAL_PRICES: Record<string, Price> = {
  'gpt-realtime': { text_in: 4, text_cached: 0.4, text_out: 24, audio_in: 32, audio_cached: 0.4, audio_out: 64 },
  'gpt-realtime-mini': { text_in: 0.6, text_cached: 0.06, text_out: 2.4, audio_in: 10, audio_cached: 0.3, audio_out: 20 },
  'gpt-5.6-sol': { text_in: 5, text_cached: 0.5, text_out: 30 },
  'gpt-5.6-terra': { text_in: 2, text_cached: 0.2, text_out: 12 },
  'gpt-5.6-luna': { text_in: 0.2, text_cached: 0.02, text_out: 1.2 },
  'gpt-5.5': { text_in: 1.25, text_cached: 0.125, text_out: 10 },
  'gpt-5.4': { text_in: 1.25, text_cached: 0.125, text_out: 10 },
  'gpt-5.4-mini': { text_in: 0.25, text_cached: 0.025, text_out: 2 },
  'gpt-transcribe': { per_minute: 0.0045 },
  'gpt-live-transcribe': { per_minute: 0.017 },
  'gpt-realtime-whisper': { per_minute: 0.017 },
  'gpt-4o-transcribe': { per_minute: 0.006 },
  'gpt-4o-mini-transcribe': { per_minute: 0.003 },
  tts: { text_in: 0.6, audio_out: 12 },
  image: {} // images report cost_usd directly
};

function localPriceFor(model = ''): Price {
  if (LOCAL_PRICES[model]) return LOCAL_PRICES[model];
  if (model.startsWith('gpt-realtime')) return model.includes('mini') ? LOCAL_PRICES['gpt-realtime-mini'] : LOCAL_PRICES['gpt-realtime'];
  if (model.includes('transcribe')) return LOCAL_PRICES['gpt-transcribe'];
  if (model.includes('tts')) return LOCAL_PRICES.tts;
  if (model.includes('image')) return LOCAL_PRICES.image;
  return LOCAL_PRICES['gpt-5.6-sol'];
}

/** Cached tokens are reported INSIDE the input totals, so they are subtracted out here and
 *  re-added at the cached rate. Per-minute models ignore tokens entirely. */
export function estimateCost(entry: Record<string, unknown>): number {
  if (typeof entry.cost_usd === 'number') return entry.cost_usd;
  const p = localPriceFor(String(entry.model ?? ''));
  const M = 1e6;
  const n = (x: unknown) => Math.max(0, Number(x) || 0);
  if (p.per_minute) return Math.round(n(entry.audio_seconds) / 60 * p.per_minute * 1e5) / 1e5;
  const tin = n(entry.input_tokens);
  const ain = n(entry.audio_input_tokens);
  const ctin = p.text_cached === undefined ? 0 : Math.min(n(entry.cached_input_tokens), tin);
  const cain = p.audio_cached === undefined ? 0 : Math.min(n(entry.cached_audio_input_tokens), ain);
  return Math.round((
    (tin - ctin) / M * (p.text_in ?? 0) +
    ctin / M * (p.text_cached ?? 0) +
    (ain - cain) / M * (p.audio_in ?? 0) +
    cain / M * (p.audio_cached ?? 0) +
    n(entry.output_tokens) / M * (p.text_out ?? 0) +
    n(entry.audio_output_tokens) / M * (p.audio_out ?? 0)
  ) * 1e5) / 1e5;
}

const localKey = () => 'causerie.costs:' + (activeProfile()?.id ?? 'solo');

/** Appends one estimated row to the local ring (kept: last 600 rows). */
export function appendLocalCost(entry: Record<string, unknown>): void {
  try {
    const rows = JSON.parse(localStorage.getItem(localKey()) ?? '[]') as CostRow[];
    rows.push({
      created_at: new Date().toISOString(),
      kind: String(entry.kind ?? 'realtime'),
      model: String(entry.model ?? ''),
      seconds: Number(entry.seconds) || 0,
      cost_usd: estimateCost(entry)
    } as CostRow);
    localStorage.setItem(localKey(), JSON.stringify(rows.slice(-600)));
  } catch { /* full storage: the ledger is best-effort */ }
}

export function localCostRows(): CostRow[] {
  try { return JSON.parse(localStorage.getItem(localKey()) ?? '[]') as CostRow[]; } catch { return []; }
}

/** The raw ledger writes one row per API hit — a single card-review evening produces a
 *  dozen tiny TTS rows that drown the one expensive call row. The display groups per
 *  day × kind × model so the realtime calls stay visible. */

export interface CostGroup {
  day: string;            // YYYY-MM-DD
  kind: string;
  model: string;
  n: number;
  usd: number;
  seconds: number;        // summed; call duration for realtime, wall time elsewhere
  last: string;           // newest created_at in the group (sort key)
}

export const COST_KIND_FR: Record<string, string> = {
  realtime: 'appel',
  analysis: 'analyse',
  transcribe: 'transcription',
  tts: 'voix',
  chat: 'appel (tour par tour)',
  stt: 'transcription',
  image: 'images de cartes'
};

export function groupCosts(rows: CostRow[]): CostGroup[] {
  const map = new Map<string, CostGroup>();
  for (const r of rows) {
    const day = (r.created_at || '').slice(0, 10);
    const key = day + '|' + r.kind + '|' + (r.model || '');
    let g = map.get(key);
    if (!g) map.set(key, g = { day, kind: r.kind, model: r.model || '', n: 0, usd: 0, seconds: 0, last: r.created_at });
    g.n += 1;
    g.usd += Number(r.cost_usd || 0);
    g.seconds += Number(r.seconds || 0);
    if (r.created_at > g.last) g.last = r.created_at;
  }
  return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}

export const fmtUsd = (v: number): string => (v >= 0.1 ? v.toFixed(2) : v.toFixed(3)) + ' $';

/** One compact French line per group, e.g. "appel · gpt-realtime-2.1 · 8 min". */
export function costLabel(g: CostGroup): string {
  const parts = [COST_KIND_FR[g.kind] ?? g.kind];
  if (g.model) parts.push(g.model);
  if (g.n > 1) parts.push('×' + g.n);
  if (g.kind === 'realtime' && g.seconds > 0) parts.push(Math.max(1, Math.round(g.seconds / 60)) + ' min');
  return parts.join(' · ');
}
