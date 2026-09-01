import { api, OAI } from './api';

/** Post-call ground truth: re-transcribes the raw mic recording VERBATIM (errors kept),
 *  because live ASR tends to silently correct learner mistakes. The result is handed to
 *  the analysis alongside the turn transcript.
 *
 *  Deliberately NOT language-pinned. The live stream is decoded with `language` fixed to the
 *  target, which is right for conversational stability but is exactly what turns a word the
 *  learner reached for in their own language into the nearest target-language sound-alike.
 *  This pass is the one the analysis judges code-switches from, so it must be able to return
 *  a German or English word as itself. The prompt still says which language dominates, which
 *  biases decoding without forbidding the others. */

export const VERBATIM_PROMPT =
  'This is a native German speaker practising imperfect French. The audio is almost entirely French. Transcribe VERBATIM exactly what is said: keep every grammar mistake, wrong word, wrong gender, false start, repetition and hesitation exactly as spoken. When the speaker falls back on a German or English word because they do not know the French one, write that word as it was said, in its own language; never translate it into French and never replace it with a similar-sounding French word. Never correct, complete or polish the French. Ignore background noise; transcribe speech only.';
const LANG_EN: Record<string, string> = { fr: 'French', es: 'Spanish', it: 'Italian', en: 'English', pt: 'Portuguese' };
const NATIVE_EN: Record<string, string> = { de: 'German', en: 'English' };
export const promptFor = (lang: string, native = 'de'): string =>
  VERBATIM_PROMPT.replace(/French/g, LANG_EN[lang] ?? 'French').replace(/German/g, NATIVE_EN[native] ?? 'German');

/** The model both paths reach for first (the server function uses it unconditionally).
 *  Named here so the cost breakdown can price the leg without guessing. */
export const VERBATIM_MODEL = 'gpt-transcribe';

const extFor = (type: string): string =>
  type.includes('mp4') ? 'audio.mp4' : type.includes('mpeg') || type.includes('mp3') ? 'audio.mp3' : type.includes('ogg') ? 'audio.ogg' : 'audio.webm';

export async function transcribeVerbatim(blob: Blob, language: string, native = 'de', seconds = 0): Promise<string | null> {
  if (!blob || blob.size < 4000) return null;         // under ~1s of audio: nothing to gain
  if (blob.size > 8_000_000) return null;             // guard; ~32 kbps keeps calls far below this
  try {
    if (api.useServer()) {
      // Base64 JSON transport: Netlify's function bridge mangles raw binary bodies.
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
      }
      const r = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...api.authHeaders() },
        // audio_seconds is what the server bills on: gpt-transcribe is priced per minute of
        // audio, and inferring the duration from the byte count was out by roughly half.
        body: JSON.stringify({ audio_b64: btoa(bin), type: blob.type || 'audio/webm', lang: language, native, audio_seconds: Math.round(seconds) })
      });
      if (!r.ok) throw new Error('transcribe ' + r.status);
      const j = await r.json();
      return (j.text || '').trim() || null;
    }
    // gpt-transcribe (July 2026 batch model) first, legacy fallback.
    for (const model of [VERBATIM_MODEL, 'gpt-4o-transcribe']) {
      const form = new FormData();
      form.append('file', blob, extFor(blob.type || ''));
      form.append('model', model);
      // No `language` field on purpose — see the note above the prompt.
      form.append('prompt', promptFor(language, native));
      form.append('temperature', '0');
      const r = await fetch(OAI() + '/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + api.getKey() },
        body: form
      });
      if (!r.ok) continue;
      const j = await r.json();
      return (j.text || '').trim() || null;
    }
    throw new Error('transcribe failed');
  } catch (e) {
    console.warn('verbatim transcription failed', e);
    return null;
  }
}
