import { api, OAI } from './api';

/** Card audio (Fluent Forever: always hear the target language). Uses gpt-4o-mini-tts;
 *  through the server function when the server key is in use, directly otherwise.
 *  Object URLs are cached per text for the session.
 *
 *  Review flow contract: prefetch() is called when a card appears so the clip is local
 *  by the time it is revealed; speak() resolves when PLAYBACK ENDS, so the session can
 *  hold the current card until the audio has finished instead of letting it bleed into
 *  the next one. speak() reports its lifecycle via onState, so buttons can show
 *  loading and failure instead of dead air. */

export type SpeakState = 'loading' | 'playing' | 'done' | 'error';

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
let current: HTMLAudioElement | null = null;

/** English name of the active target language ("French", "Italian", …); set from
 *  app.tsx on profile changes so multilingual profiles get the right voice guidance. */
let ttsLang = 'French';
export function configureTts(langEnName: string): void {
  if (langEnName) ttsLang = langEnName;
}

async function fetchClip(t: string, voice = 'coral'): Promise<string | null> {
  try {
    let r: Response;
    if (api.useServer()) {
      r = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...api.authHeaders() },
        body: JSON.stringify({ text: t, lang: ttsLang, voice })
      });
    } else {
      r = await fetch(OAI() + '/v1/audio/speech', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + api.getKey() },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts', voice, input: t,
          instructions: `Calm, clear ${ttsLang} for a language learner. Natural, unhurried pace.`,
          response_format: 'mp3'
        })
      });
    }
    if (!r.ok) throw new Error('tts ' + r.status);
    const url = URL.createObjectURL(await r.blob());
    cache.set(voice + '|' + t, url);
    return url;
  } catch (e) {
    console.warn('tts failed', e);
    return null;
  }
}

function getClip(t: string, voice = 'coral'): Promise<string | null> {
  const k = voice + '|' + t;
  const hit = cache.get(k);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(k);
  if (!p) {
    p = fetchClip(t, voice).finally(() => pending.delete(k));
    pending.set(k, p);
  }
  return p;
}

/** Warms the cache without playing (fire when the card appears, not on reveal). */
export function prefetch(text: string, voice = 'coral'): void {
  const t = (text || '').trim();
  if (t && !cache.has(voice + '|' + t)) void getClip(t, voice);
}

/** Plays the clip; resolves when playback has ENDED (or on failure, after onState('error')). */
export async function speak(text: string, onState?: (s: SpeakState) => void, voice = 'coral'): Promise<void> {
  const t = (text || '').trim();
  if (!t) { onState?.('done'); return; }
  if (!cache.has(voice + '|' + t)) onState?.('loading');
  const url = await getClip(t, voice);
  if (!url) { onState?.('error'); return; }
  current?.pause();
  const el = new Audio(url);
  current = el;
  try {
    await el.play();
    onState?.('playing');
    await new Promise<void>(resolve => {
      el.onended = () => resolve();
      el.onpause = () => resolve(); // stopSpeaking() or a new speak() interrupting
      el.onerror = () => resolve();
    });
    onState?.('done');
  } catch (e) {
    console.warn('tts play failed', e);
    onState?.('error');
  }
}

export function isSpeaking(): boolean {
  return !!current && !current.paused && !current.ended;
}

export function stopSpeaking(): void {
  current?.pause();
  current = null;
}
