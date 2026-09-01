import { supaUser, recordCost, computeCost } from './lib/supauth.mjs';

/** Realtime calls run browser↔OpenAI directly, so the client reports the usage the
 *  data channel delivered (response.done events). The price math stays server-side. */
export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const user = await supaUser(req);
  if (!user) return new Response('AUTH', { status: 401 });
  let body = {};
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const n = (x) => Math.max(0, Math.min(50_000_000, Math.round(Number(x) || 0)));
  const entry = {
    kind: ['realtime', 'analysis', 'tts', 'transcribe'].includes(body.kind) ? body.kind : 'realtime',
    model: String(body.model || 'gpt-realtime-2.1').slice(0, 60),
    key_source: body.key_source === 'own' ? 'own' : 'server',
    session_id: String(body.session_id || '').slice(0, 60) || null,
    input_tokens: n(body.input_tokens),
    output_tokens: n(body.output_tokens),
    audio_input_tokens: n(body.audio_input_tokens),
    audio_output_tokens: n(body.audio_output_tokens),
    cached_input_tokens: n(body.cached_input_tokens),
    cached_audio_input_tokens: n(body.cached_audio_input_tokens),
    // Minutes of audio, distinct from `seconds` (which is wall time for the API call).
    audio_seconds: Math.max(0, Math.min(7200, Number(body.audio_seconds) || 0)),
    seconds: Math.max(0, Math.min(7200, Number(body.seconds) || 0))
  };
  entry.cost_usd = computeCost(entry.model, entry);
  // conversation_costs has no cached_* columns; meta is jsonb and already there, so the
  // split rides along and the row can be re-priced later without a migration.
  if (entry.cached_input_tokens || entry.cached_audio_input_tokens || entry.audio_seconds) {
    entry.meta = {
      ...(entry.cached_input_tokens ? { cached_input_tokens: entry.cached_input_tokens } : {}),
      ...(entry.cached_audio_input_tokens ? { cached_audio_input_tokens: entry.cached_audio_input_tokens } : {}),
      ...(entry.audio_seconds ? { audio_seconds: entry.audio_seconds } : {})
    };
  }
  await recordCost(user, entry);
  return Response.json({ ok: true, cost_usd: entry.cost_usd });
};
export const config = { path: '/api/cost' };
