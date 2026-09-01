/* Supabase-backed auth for the functions. Zero server secrets beyond OPENAI_API_KEY:
   the functions only ever use the project URL, the PUBLIC publishable key, and the
   CALLER's own JWT — every table read runs under that user's row-level security.

   Key resolution ladder for OpenAI calls:
     1. valid Supabase session + email on server_key_allowlist → Netlify OPENAI_API_KEY
     2. valid session + row in user_keys                      → that user's own key
     3. valid session, neither                                → 402 (client asks for a key)
     4. no session → legacy access-code gate (kept for pre-Supabase deployments/tests)
*/
import { cfg } from './config.mjs';
import { authed } from './auth.mjs';

// No embedded fallback: Supabase is opt-in per deployment (SUPABASE_URL +
// SUPABASE_ANON_KEY in the Netlify env), and OFF otherwise — a fork must never
// route its users into somebody else's project.
export const SUPA_URL = process.env.SUPABASE_URL || '';
export const SUPA_KEY = process.env.SUPABASE_ANON_KEY || '';

export function supaEnabled() {
  return !!SUPA_URL && !!SUPA_KEY;
}

/** Validates the caller's Supabase JWT (Authorization: Bearer …). */
export async function supaUser(req) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  try {
    const r = await fetch(SUPA_URL + '/auth/v1/user', {
      headers: { apikey: SUPA_KEY, authorization: auth }
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u?.id) return null;
    return { id: u.id, email: (u.email || '').toLowerCase(), jwt: auth.slice(7).trim() };
  } catch {
    return null;
  }
}

function rest(path, jwt, opts = {}) {
  return fetch(SUPA_URL + '/rest/v1/' + path, {
    ...opts,
    headers: {
      apikey: SUPA_KEY,
      authorization: 'Bearer ' + jwt,
      'content-type': 'application/json',
      ...(opts.headers || {})
    }
  });
}

async function allowlisted(user) {
  try {
    const r = await rest('server_key_allowlist?select=email&email=eq.' + encodeURIComponent(user.email), user.jwt);
    if (!r.ok) return false;
    const j = await r.json();
    return Array.isArray(j) && j.length > 0;
  } catch { return false; }
}

async function ownKey(user) {
  try {
    const r = await rest('user_keys?select=openai_key&user_id=eq.' + user.id, user.jwt);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.[0]?.openai_key || null;
  } catch { return null; }
}

/** → { key, source, user } | { status, error } */
export async function resolveKey(req) {
  const user = await supaUser(req);
  if (user) {
    if (await allowlisted(user)) {
      const k = cfg().OPENAI_API_KEY;
      if (k) return { key: k, source: 'server', user };
      return { status: 503, error: 'NO_SERVER_KEY' };
    }
    const own = await ownKey(user);
    if (own) return { key: own, source: 'own', user };
    return { status: 402, error: 'NEED_KEY' };
  }
  // Legacy path: access code (pre-Supabase clients, e2e).
  if (await authed(req)) {
    const k = cfg().OPENAI_API_KEY;
    if (k) return { key: k, source: 'server', user: null };
    return { status: 503, error: 'NO_SERVER_KEY' };
  }
  return { status: 401, error: 'AUTH' };
}

/* ---- cost ledger -------------------------------------------------------- */

/** Raw token counts are stored alongside the money, so rows can be repriced if rates move.
 *  USD per 1M tokens, from developers.openai.com/api/docs/pricing (re-checked 2026-08-21).
 *  `*_cached` is the rate for input tokens the model had already seen: Realtime re-sends the
 *  whole conversation on every turn, so on a long call MOST input tokens are cached ones, and
 *  a table without those rates reports list price rather than the bill. gpt-5.x rows use the
 *  short-context tier, which is what the analysis payloads fall into.
 *
 *  `per_minute` is USD per MINUTE OF AUDIO, not per token: the transcription models are billed
 *  that way, and pricing them by a token count guessed from the file size was out by several
 *  times. Rows priced this way need `audio_seconds` on the entry. */
const PRICES = {
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
  'tts': { text_in: 0.6, audio_out: 12 }
};

export function priceFor(model = '') {
  if (PRICES[model]) return PRICES[model];
  if (model.startsWith('gpt-realtime')) return model.includes('mini') ? PRICES['gpt-realtime-mini'] : PRICES['gpt-realtime'];
  if (model.includes('transcribe')) return PRICES['gpt-transcribe'];
  if (model.includes('tts')) return PRICES['tts'];
  return PRICES['gpt-5.6-sol'];
}

/** Cached input tokens are counted INSIDE input_tokens/audio_input_tokens (the API reports
 *  totals), so they are subtracted out and re-added at the cached rate. */
export function computeCost(model, t) {
  const p = priceFor(model);
  const M = 1e6;
  const n = (x) => Math.max(0, Number(x) || 0);
  if (p.per_minute) return Math.round(n(t.audio_seconds) / 60 * p.per_minute * 1e5) / 1e5;
  const tin = n(t.input_tokens);
  const ain = n(t.audio_input_tokens);
  const ctin = p.text_cached === undefined ? 0 : Math.min(n(t.cached_input_tokens), tin);
  const cain = p.audio_cached === undefined ? 0 : Math.min(n(t.cached_audio_input_tokens), ain);
  return Math.round((
    (tin - ctin) / M * (p.text_in || 0) +
    ctin / M * (p.text_cached || 0) +
    (ain - cain) / M * (p.audio_in || 0) +
    cain / M * (p.audio_cached || 0) +
    n(t.output_tokens) / M * (p.text_out || 0) +
    n(t.audio_output_tokens) / M * (p.audio_out || 0)
  ) * 1e5) / 1e5;
}

/** Fire-and-forget insert into conversation_costs under the user's own JWT. */
export async function recordCost(user, entry) {
  if (!user?.jwt) return; // legacy access-code callers have no ledger row
  try {
    const cost = entry.cost_usd ?? computeCost(entry.model, entry);
    await rest('conversation_costs', user.jwt, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: user.id,
        email: user.email,
        session_id: entry.session_id || null,
        kind: entry.kind,
        model: entry.model || null,
        key_source: entry.key_source || null,
        input_tokens: entry.input_tokens || 0,
        output_tokens: entry.output_tokens || 0,
        audio_input_tokens: entry.audio_input_tokens || 0,
        audio_output_tokens: entry.audio_output_tokens || 0,
        seconds: entry.seconds ?? null,
        cost_usd: cost,
        meta: entry.meta || null
      })
    });
  } catch { /* the ledger must never break the product */ }
}
