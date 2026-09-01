import { resolveKey, recordCost } from './lib/supauth.mjs';

/** Verbatim re-transcription of the caller's raw mic recording (error ground truth).
 *  Body: JSON { audio_b64, type, lang, native } — base64 because Netlify's function bridge
 *  mangles raw binary request bodies. Keep this prompt in step with src/lib/transcribe.ts. */

const VERBATIM_PROMPT =
  'This is a native German speaker practising imperfect French. The audio is almost entirely French. Transcribe VERBATIM exactly what is said: keep every grammar mistake, wrong word, wrong gender, false start, repetition and hesitation exactly as spoken. When the speaker falls back on a German or English word because they do not know the French one, write that word as it was said, in its own language; never translate it into French and never replace it with a similar-sounding French word. Never correct, complete or polish the French. Ignore background noise; transcribe speech only.';

const LANG_EN = { fr: 'French', es: 'Spanish', it: 'Italian', en: 'English', pt: 'Portuguese' };
const NATIVE_EN = { de: 'German', en: 'English' };
const promptFor = (lang, native = 'de') =>
  VERBATIM_PROMPT.replace(/French/g, LANG_EN[lang] ?? 'French').replace(/German/g, NATIVE_EN[native] ?? 'German');

const extFor = (type) =>
  type.includes('mp4') ? 'audio.mp4' : type.includes('mpeg') || type.includes('mp3') ? 'audio.mp3' : type.includes('ogg') ? 'audio.ogg' : 'audio.webm';

export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const k = await resolveKey(req);
  if (k.error) return new Response(k.error, { status: k.status });
  let body;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const lang = String(body.lang || 'fr').slice(0, 5);
  const native = String(body.native || 'de').slice(0, 5);
  const type = String(body.type || 'audio/webm');
  const audioSeconds = Math.max(0, Math.min(7200, Number(body.audio_seconds) || 0));
  let buf;
  try { buf = Buffer.from(String(body.audio_b64 || ''), 'base64'); } catch { return new Response('bad audio', { status: 400 }); }
  if (!buf.byteLength || buf.byteLength > 8_000_000) return new Response('bad size', { status: 413 });

  // gpt-transcribe (July 2026 batch model) first, legacy fallback.
  let lastErr = '';
  const t0 = Date.now();
  for (const model of ['gpt-transcribe', 'gpt-4o-transcribe']) {
    const form = new FormData();
    form.append('file', new Blob([buf], { type }), extFor(type));
    form.append('model', model);
    // No `language` field on purpose: pinning the decoder to the target language is what
    // turns a word the learner reached for in their own language into a target sound-alike,
    // and this pass is the ground truth the analysis judges code-switches from.
    form.append('prompt', promptFor(lang, native));
    form.append('temperature', '0');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + k.key },
      body: form
    });
    const text = await r.text();
    if (r.ok) {
      if (k.user) {
        // ~50 audio tokens/second at 16 kHz; opus ≈ 4 KB/s at our bitrate.
        // Awaited: a fire-and-forget insert gets killed with the function instance.
        // gpt-transcribe is billed per minute of audio, so the client sends the real
        // duration. The byte-count guess this replaced assumed 4 KB/s and was out by half.
        // `seconds` stays wall time, matching every other row; `audio_seconds` is the audio.
        await recordCost(k.user, {
          kind: 'transcribe', model, key_source: k.source,
          session_id: body.session_id || null,
          audio_seconds: audioSeconds,
          meta: audioSeconds ? { audio_seconds: audioSeconds } : null,
          seconds: Math.round((Date.now() - t0) / 1000)
        });
      }
      return new Response(text, { status: 200, headers: { 'content-type': 'application/json' } });
    }
    lastErr = text.slice(0, 300);
  }
  return new Response('openai: ' + lastErr, { status: 502 });
};
export const config = { path: '/api/transcribe' };
