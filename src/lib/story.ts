import type { Memory } from '../types';
import { api, OAI } from './api';
import { band } from './cefr';
import { pack } from '../lang';
import { activeProfile } from './profiles';
import { todayISO } from './utils';

/** Histoire du jour: a ~2-minute listening story in the target language, written for
 *  this learner (level, interests, recent trouble spots woven in). Fills the input
 *  strand the daily call alone cannot provide. One story per day is cached. */

export interface StoryQuestion { q: string; options: string[]; correct: number }
export interface Story { title: string; text: string; questions?: StoryQuestion[] }

const STORY_SCHEMA = {
  name: 'story',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string', description: 'Short story title in the target language, no quotes' },
      text: { type: 'string', description: 'The story itself, plain text, 3-4 short paragraphs separated by blank lines' },
      questions: {
        type: 'array',
        description: 'ONE comprehension question per paragraph, in paragraph order (question i is about paragraph i), in the target language, level-appropriate',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            q: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, description: 'exactly 3 short options' },
            correct: { type: 'integer', description: '0-based index of the right option' }
          },
          required: ['q', 'options', 'correct']
        }
      }
    },
    required: ['title', 'text', 'questions']
  }
} as const;

// v2: one question per paragraph (older cached stories carry 2 global questions).
const key = () => `causerie.story2:${activeProfile()?.id ?? 'solo'}:${todayISO()}`;
const legacyKey = () => `causerie.story:${activeProfile()?.id ?? 'solo'}:${todayISO()}`;

export function cachedStory(): Story | null {
  try {
    localStorage.removeItem(legacyKey());
    const raw = localStorage.getItem(key());
    return raw ? (JSON.parse(raw) as Story) : null;
  } catch { return null; }
}

/** Non-empty paragraphs of a story text (questions map onto these by index). */
export function paras(text: string): string[] {
  return text.split(/\n+/).map(s => s.trim()).filter(Boolean);
}

async function chat(body: unknown): Promise<string> {
  const r = api.useServer()
    ? await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...api.authHeaders() },
      body: JSON.stringify(body)
    })
    : await fetch(OAI() + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + api.getKey() },
      body: JSON.stringify(body)
    });
  if (!r.ok) throw new Error('llm ' + r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? '';
}

export async function makeStory(mem: Memory, fresh = false): Promise<Story> {
  if (!fresh) {
    const hit = cachedStory();
    if (hit) return hit;
  }
  const P = pack(mem.profile.target);
  const interests = (mem.interests ?? []).slice(0, 4).map(i => i.label).join(', ');
  const weak = (mem.weaknesses ?? []).filter(w => w.status !== 'resolved').slice(0, 3).map(w => w.label).join('; ');
  const sys = `You write a daily micro-story (${P.en}) for one language learner, to be READ ALOUD by TTS (~2 minutes: 200-240 words, in 3-4 short paragraphs separated by blank lines). Level ${band(mem.cefr.overall)}: short sentences, high-frequency vocabulary, a clear thread with a small twist at the end. Weave in 2-3 words slightly above their level, obvious from context. Where it fits naturally, quietly exercise their current trouble spots. No word lists, no questions to the reader, no title inside the text, no emoji. Then add ONE comprehension question PER PARAGRAPH, in paragraph order (${P.en}, same level, 3 short options each, exactly one right, answerable from that paragraph alone). Mix plain fact questions with ones needing a small inference.`;
  const usr = `Learner interests: ${interests || '(unknown)'}\nCurrent trouble spots: ${weak || '(none known)'}\nToday: ${todayISO()}. Write today's story in ${P.en}.`;
  const content = await chat({
    model: 'gpt-5.4-mini',
    messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
    response_format: { type: 'json_schema', json_schema: STORY_SCHEMA },
    reasoning_effort: 'low'
  });
  const story = JSON.parse(content) as Story;
  if (!story.text) throw new Error('empty story');
  try { localStorage.setItem(key(), JSON.stringify(story)); } catch { /* cache only */ }
  return story;
}

const TRANS_SCHEMA = {
  name: 'snippet_translation',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      translation: { type: 'string', description: 'the natural translation of the snippet as used in this context, short' },
      note: { type: 'string', description: 'optional 3-8 word usage or grammar note; empty string if none' }
    },
    required: ['translation', 'note']
  }
} as const;

/** Tap-to-translate: one cheap call for a word or phrase the learner didn't get,
 *  translated in context into their support language. */
export async function translateSnippet(snippet: string, context: string, mem: Memory): Promise<{ translation: string; note: string }> {
  const P = pack(mem.profile.target);
  const nativeName = mem.profile.native === 'en' ? 'English' : 'German';
  const content = await chat({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: `A ${P.en} learner (native ${nativeName}) tapped a word or phrase they did not understand in a story. Translate the snippet into ${nativeName} — the meaning it has IN THIS CONTEXT, not a dictionary list. Keep it short. Add a tiny ${nativeName} usage note only when it genuinely helps (idiom, false friend, irregular form); otherwise note is an empty string.` },
      { role: 'user', content: `Snippet: «${snippet.slice(0, 120)}»\nContext: ${context.slice(0, 400)}` }
    ],
    response_format: { type: 'json_schema', json_schema: TRANS_SCHEMA },
    reasoning_effort: 'low'
  });
  const out = JSON.parse(content) as { translation: string; note: string };
  if (!out.translation) throw new Error('empty translation');
  return out;
}

/** Strips punctuation from the edges of a tapped snippet (keeps inner apostrophes/hyphens). */
export function cleanSnippet(s: string): string {
  return s.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
}

/** Splits a text into TTS-sized chunks (the endpoint caps at 500 chars). */
function chunks(text: string): string[] {
  const parts: string[] = [];
  let buf = '';
  for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
    if ((buf + ' ' + sentence).length > 440) { if (buf) parts.push(buf); buf = sentence; }
    else buf = buf ? buf + ' ' + sentence : sentence;
  }
  if (buf) parts.push(buf);
  return parts;
}

/** Plays paragraphs in order starting at `from`; onPara(i+1) fires after paragraph i
 *  finishes (this is what reveals its question), onDone after the last or on cancel.
 *  Returns a cancel function. */
export function playParas(
  list: string[],
  from: number,
  speak: (t: string, onState?: (s: string) => void) => Promise<void>,
  onPara: (heard: number) => void,
  onDone: () => void
): () => void {
  let cancelled = false;
  void (async () => {
    for (let i = Math.max(0, from); i < list.length; i++) {
      for (const c of chunks(list[i])) {
        if (cancelled) break;
        await speak(c);
      }
      if (cancelled) break;
      onPara(i + 1);
    }
    if (!cancelled) onDone();
  })();
  return () => { cancelled = true; onDone(); };
}
