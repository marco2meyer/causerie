import { resolveKey, recordCost } from './lib/supauth.mjs';

/** Card audio, and Odile's own voice in the turn-by-turn call engine: proxies OpenAI TTS
 *  so the key stays server-side. The call engine sends her persona as `instructions` and
 *  the level-ramped rate as `speed`; the card path sends neither and gets the plain,
 *  unhurried reading it always had. */
export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const k = await resolveKey(req);
  if (k.error) return new Response(k.error, { status: k.status });
  let body = {};
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  // One sentence of hers at a time (the engine cuts her answer up before sending), with
  // enough headroom for a long one; a card's front is far shorter than either.
  const text = String(body.text || '').slice(0, 1000);
  if (!text.trim()) return new Response('empty text', { status: 400 });
  // English name of the target language; multilingual profiles pass it along.
  const lang = /^[A-Za-z ]{2,20}$/.test(String(body.lang || '')) ? body.lang : 'French';
  const voice = ['coral', 'sage', 'marin', 'cedar', 'ash', 'alloy', 'ballad', 'echo', 'shimmer', 'verse'].includes(body.voice) ? body.voice : 'coral';
  const instructions = String(body.instructions || '').slice(0, 600)
    || `Calm, clear ${lang} for a language learner. Natural, unhurried pace.`;
  const speed = Math.min(1.5, Math.max(0.5, Number(body.speed) || 1));
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + k.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      instructions,
      speed,
      response_format: 'mp3'
    })
  });
  if (!r.ok) return new Response('openai: ' + (await r.text()).slice(0, 300), { status: 502 });
  const buf = await r.arrayBuffer();
  if (k.user) {
    // TTS reports no usage: approximate by characters (≈4 chars/token in + ~10 audio tok/s).
    void recordCost(k.user, {
      kind: 'tts', model: 'gpt-4o-mini-tts', key_source: k.source,
      input_tokens: Math.ceil(text.length / 4),
      audio_output_tokens: Math.ceil(text.length * 1.4)
    });
  }
  return new Response(buf, {
    status: 200,
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=86400' }
  });
};
export const config = { path: '/api/tts' };
