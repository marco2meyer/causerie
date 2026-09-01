/* Shared auth + ledger for EDGE functions. The Deno edge runtime has no node:crypto or
   Buffer, so the pieces of functions/lib/supauth.mjs needed here are ported to web APIs.
   Keep the two in sync when the ladder changes. */

export const env = (k) => {
  try { if (globalThis.Netlify?.env?.get) return globalThis.Netlify.env.get(k) || ''; } catch { /* fall through */ }
  try { return globalThis.process?.env?.[k] || ''; } catch { return ''; }
};

const SUPA_URL = () => env('SUPABASE_URL') || 'https://zkvcfrmctxgslqeicmsn.supabase.co';
const SUPA_KEY = () => env('SUPABASE_ANON_KEY') || 'sb_publishable_dvwajJuqITMgTp8ObFnjOw_1Ic44rF-';

const rest = (path, jwt, opts = {}) =>
  fetch(SUPA_URL() + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: SUPA_KEY(), authorization: 'Bearer ' + jwt, 'content-type': 'application/json', ...(opts.headers || {}) }
  });

async function supaUser(req) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  try {
    const r = await fetch(SUPA_URL() + '/auth/v1/user', { headers: { apikey: SUPA_KEY(), authorization: auth } });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u?.id) return null;
    return { id: u.id, email: (u.email || '').toLowerCase(), jwt: auth.slice(7).trim() };
  } catch { return null; }
}

/** Same ladder as functions/lib/supauth.mjs: allowlist → own key → 402; access-code fallback. */
export async function resolveKey(req) {
  const user = await supaUser(req);
  if (user) {
    try {
      const r = await rest('server_key_allowlist?select=email&email=eq.' + encodeURIComponent(user.email), user.jwt);
      if (r.ok && (await r.json()).length > 0) {
        const k = env('OPENAI_API_KEY');
        return k ? { key: k, source: 'server', user } : { status: 503, error: 'NO_SERVER_KEY' };
      }
    } catch { /* fall through to own key */ }
    try {
      const r = await rest('user_keys?select=openai_key&user_id=eq.' + user.id, user.jwt);
      const own = r.ok ? (await r.json())?.[0]?.openai_key : null;
      if (own) return { key: own, source: 'own', user };
    } catch { /* fall through */ }
    return { status: 402, error: 'NEED_KEY' };
  }
  // Legacy access-code gate (pre-Supabase clients, e2e). No embedded fallback: with
  // ACCESS_CODE unset, `want` is empty, no `given` can match it, and the gate stays shut.
  const given = req.headers.get('x-access-code') || '';
  const want = env('ACCESS_CODE') || '';
  let diff = given.length === want.length ? 0 : 1;
  for (let i = 0; i < Math.min(given.length, want.length); i++) diff |= given.charCodeAt(i) ^ want.charCodeAt(i);
  if (given && diff === 0) {
    const k = env('OPENAI_API_KEY');
    return k ? { key: k, source: 'server', user: null } : { status: 503, error: 'NO_SERVER_KEY' };
  }
  return { status: 401, error: 'AUTH' };
}

/** Prices in USD per 1M tokens (text models), from developers.openai.com/api/docs/pricing,
 *  re-checked 2026-08-21, short-context tier. Must stay in step with the same table in
 *  netlify/functions/lib/supauth.mjs and src/lib/costs.ts. `text_cached` is the rate for
 *  input the model has already seen, which the analysis re-sends across a session. */
export const PRICES = {
  'gpt-5.6-sol': { text_in: 5, text_cached: 0.5, text_out: 30 },
  'gpt-5.6-terra': { text_in: 2, text_cached: 0.2, text_out: 12 },
  'gpt-5.6-luna': { text_in: 0.2, text_cached: 0.02, text_out: 1.2 },
  'gpt-5.5': { text_in: 1.25, text_cached: 0.125, text_out: 10 },
  'gpt-5.4': { text_in: 1.25, text_cached: 0.125, text_out: 10 },
  'gpt-5.4-mini': { text_in: 0.25, text_cached: 0.025, text_out: 2 },
  'gpt-4o-mini': { text_in: 0.15, text_cached: 0.075, text_out: 0.6 }
};

/** Fire-and-forget-safe insert into conversation_costs under the user's own JWT.
 *  entry.cost_usd wins; otherwise text-token pricing via PRICES. */
export async function recordCost(user, entry) {
  if (!user?.jwt) return; // legacy access-code callers have no ledger row
  try {
    const p = PRICES[entry.model] || PRICES['gpt-5.6-sol'];
    // Cached tokens are reported inside input_tokens, so they are subtracted out and re-added
    // at the cached rate.
    const tin = Math.max(0, entry.input_tokens || 0);
    const cin = Math.min(Math.max(0, entry.cached_input_tokens || 0), tin);
    const cost = entry.cost_usd ??
      Math.round((
        (tin - cin) / 1e6 * p.text_in + cin / 1e6 * (p.text_cached || p.text_in) +
        (entry.output_tokens || 0) / 1e6 * p.text_out
      ) * 1e5) / 1e5;
    await rest('conversation_costs', user.jwt, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: user.id, email: user.email, session_id: entry.session_id || null,
        kind: entry.kind, model: entry.model || null, key_source: entry.key_source || null,
        input_tokens: entry.input_tokens || 0, output_tokens: entry.output_tokens || 0,
        audio_input_tokens: entry.audio_input_tokens || 0, audio_output_tokens: entry.audio_output_tokens || 0,
        seconds: entry.seconds ?? null, cost_usd: cost, meta: entry.meta || null
      })
    });
  } catch { /* the ledger must never break the product */ }
}
