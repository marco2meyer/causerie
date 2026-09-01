import type { Memory } from '../types';
import { api, OAI } from './api';
import { band } from './cefr';
import { compById } from './competencies';
import { pack, uiLangCode } from '../lang';
import { activeProfile } from './profiles';
import { norm, todayISO } from './utils';
import type { TopicSuggestion } from './topics';

/** The hook is read by the student, so it is written in the language the app is speaking. */
const HOOK_LANG: Record<string, string> = { de: 'German', en: 'English', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese' };

/** Where the day's conversation subjects come from.
 *
 *  The catalogue this replaces held about twenty phrases per language and was filtered to
 *  the learner's band, so a regular student saw the same handful in rotation; stored
 *  interests were concatenated in front of it, which made it worse, because those are a
 *  short list that the app itself keeps reinforcing. The result circles: a learner talks
 *  about their four known interests forever, and the vocabulary never has to leave.
 *
 *  So the subject is chosen by a model that can see the whole learner, with the catalogue
 *  kept as the offline fallback. The instruction that matters is the split: most proposals
 *  must open ground the student has NOT covered, and the personal facts are there to decide
 *  HOW to come at a new subject, not which subject to pick. Knowing someone reads about
 *  urban policy is a reason to talk to them about beekeeping in a particular way, not a
 *  reason to talk about urban policy again. */

export interface TopicGenProposal {
  title: string;
  phrase: string;
  tags: string[];
  hook: string;
  kind: 'fresh' | 'familiar';
}

const SCHEMA = {
  name: 'topic_proposals',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      proposals: {
        type: 'array',
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string', description: 'what the student sees, in the target language, max 7 words' },
            phrase: { type: 'string', description: 'what the tutor is told, in the target language, an instruction she can open with, max 25 words' },
            tags: { type: 'array', maxItems: 3, items: { type: 'string' }, description: 'the 2-3 vocabulary or grammar fields this subject forces, in the target language' },
            hook: { type: 'string', description: 'one short sentence, in the language named in the instructions, naming what about THIS person makes this subject worth their while' },
            kind: { type: 'string', enum: ['fresh', 'familiar'] }
          },
          required: ['title', 'phrase', 'tags', 'hook', 'kind']
        }
      }
    },
    required: ['proposals']
  }
} as const;

/** How many of the six may sit inside something the learner is already known to like. */
export const MAX_FAMILIAR = 2;
const WANTED = 6;

export function topicSystemPrompt(langEn: string, hookLangEn: string, bandName: string): string {
  return `You choose what a language tutor and her student will talk about next. The student is a ${bandName} learner of ${langEn}.

Return exactly ${WANTED} proposals.

RANGE IS THE POINT. This student's stored interests are a short list and the app has been circling them for weeks. At most ${MAX_FAMILIAR} proposals may sit inside a stored interest (kind "familiar"). Every other proposal must open subject matter that is NOT in recent_topics and NOT a restatement of a stored interest (kind "fresh").

Use the facts to decide HOW to come at a subject, never WHICH subject to pick. Knowing what someone does for a living, where they live, who is around them and how they already think is what lets you take them somewhere new and have it land. Name that connection in "hook" — one sentence, in ${hookLangEn}, about this person specifically. A hook that would fit any learner means the proposal is not doing its job.

Every proposal must force vocabulary the student is unlikely to have. "tags" names 2-3 of those fields in ${langEn}. Avoid words already in known_vocab: the point is what they cannot say yet.

Pitch it at or just above their level. A ${bandName} learner can discuss almost anything if the angle is concrete, so prefer the concrete to the abstract and a question to a category ("why cities plant trees" beats "the environment"). Do not confuse a hard SUBJECT with hard LANGUAGE.

Vary the form as well as the subject: at least one proposal must be a role play, a game with missing information, an explanation task, or a position to argue for, and its "phrase" must set that up.

Never propose anything in recent_topics or a paraphrase of one, and never repeat the shape of the tutor's own last few openings.`;
}

/** Everything the chooser is allowed to know. Kept small on purpose: the whole memory would
 *  bury the two lists that decide the answer (what they have done, and who they are). */
export function topicContext(mem: Memory): Record<string, unknown> {
  const lib = compById(mem.profile.target);
  const gaps = Object.entries(mem.comp ?? {})
    .filter(([, e]) => e.status === 'ko')
    .map(([id]) => lib[id]?.label)
    .filter(Boolean)
    .slice(0, 6);
  return {
    level: band(mem.cefr.overall),
    skills: {
      grammar: mem.cefr.skills.grammar, vocabulary: mem.cefr.skills.vocabulary,
      fluency: mem.cefr.skills.fluency, comprehension: mem.cefr.skills.comprehension
    },
    // Long horizon on purpose: two calls of memory is what let three subjects cycle forever.
    recent_topics: (mem.sessions ?? []).slice(-25).map(s => s.topic).filter(Boolean),
    interests: (mem.interests ?? []).slice().sort((a, b) => b.weight - a.weight).slice(0, 8).map(i => i.label),
    facts: (mem.facts ?? []).slice(-24).map(f => f.text),
    open_weaknesses: (mem.weaknesses ?? []).filter(w => w.status !== 'resolved').slice(0, 6).map(w => w.label),
    competency_gaps: gaps,
    chosen_direction: mem.checkins?.direction || null,
    known_vocab: (mem.vocab ?? []).slice(-40).map(v => v.fr)
  };
}

/** Keeps the promised mix even when the model does not: no more than MAX_FAMILIAR familiar
 *  proposals survive, and anything matching a recent topic is dropped outright rather than
 *  trusted. Order alternates so the shuffle button does not walk through all the safe ones
 *  first. */
export function shapeProposals(raw: TopicGenProposal[], recent: string[]): TopicGenProposal[] {
  const seen = new Set(recent.map(norm));
  const ok = raw.filter(p => p?.title && p.phrase && !seen.has(norm(p.title)));
  const fresh = ok.filter(p => p.kind !== 'familiar');
  const familiar = ok.filter(p => p.kind === 'familiar').slice(0, MAX_FAMILIAR);
  const out: TopicGenProposal[] = [];
  let f = 0, m = 0;
  // Two fresh, then one familiar: new ground leads, and the safe one is never far away.
  while (f < fresh.length || m < familiar.length) {
    if (f < fresh.length) out.push(fresh[f++]);
    if (f < fresh.length) out.push(fresh[f++]);
    if (m < familiar.length) out.push(familiar[m++]);
  }
  return out;
}

const asSuggestion = (p: TopicGenProposal, lv: string): TopicSuggestion => ({
  t: p.title, fr: p.phrase, lv, tags: p.tags ?? [],
  why: p.kind === 'familiar' ? 'interest' : 'fresh',
  kind: p.kind === 'familiar' ? 'interest' : 'fresh',
  note: p.hook
});

/* ---- day cache ----------------------------------------------------------- */

interface Cached { key: string; list: TopicSuggestion[] }

/** Regenerated on a new day, a new level, a new language — and after every call, because
 *  the call is what changes the answer most. */
export function cacheKey(mem: Memory, today = todayISO()): string {
  return [today, mem.profile.target, band(mem.cefr.overall), (mem.sessions ?? []).length].join('|');
}

const storeKey = () => 'causerie.topicgen:' + (activeProfile()?.id ?? 'solo');

export function readCache(mem: Memory, today = todayISO()): TopicSuggestion[] | null {
  try {
    const raw = localStorage.getItem(storeKey());
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    return c.key === cacheKey(mem, today) && c.list?.length ? c.list : null;
  } catch {
    return null;
  }
}

function writeCache(mem: Memory, list: TopicSuggestion[]): void {
  try {
    localStorage.setItem(storeKey(), JSON.stringify({ key: cacheKey(mem), list } as Cached));
  } catch { /* a full quota is not worth failing a call over */ }
}

/* ---- the call ------------------------------------------------------------ */

/** One request in flight per cache key, and a cool-down after a failure. Today unmounts
 *  whenever the student taps Cards or Settings, so without these two guards coming back to
 *  the home screen fired a fresh model call every time, and an offline phone fired one on
 *  every visit forever. */
const inFlight = new Map<string, Promise<TopicSuggestion[]>>();
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 10 * 60 * 1000;

export async function generateTopics(mem: Memory): Promise<TopicSuggestion[]> {
  const cached = readCache(mem);
  if (cached) return cached;
  const key = cacheKey(mem);
  const running = inFlight.get(key);
  if (running) return running;
  const failed = failedAt.get(key);
  if (failed && Date.now() - failed < RETRY_AFTER_MS) return [];
  const p = fetchTopics(mem).catch(e => { failedAt.set(key, Date.now()); throw e; })
    .finally(() => { inFlight.delete(key); });
  inFlight.set(key, p);
  return p;
}

async function fetchTopics(mem: Memory): Promise<TopicSuggestion[]> {

  const P = pack(mem.profile.target);
  // The hook is shown on the home screen, so it is written in whatever language the app is
  // currently speaking — an immersion UI must not sprout a German sentence.
  const hookLangEn = HOOK_LANG[uiLangCode()] ?? 'English';
  const ctx = topicContext(mem);
  const body = {
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: topicSystemPrompt(P.en, hookLangEn, band(mem.cefr.overall)) },
      { role: 'user', content: JSON.stringify(ctx) }
    ],
    response_format: { type: 'json_schema', json_schema: SCHEMA },
    reasoning_effort: 'low'
  };

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
  if (!r.ok) throw new Error('topics ' + r.status);
  const j = await r.json();
  const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? '{"proposals":[]}') as { proposals: TopicGenProposal[] };
  const shaped = shapeProposals(parsed.proposals ?? [], ctx.recent_topics as string[]);
  const list = shaped.map(p => asSuggestion(p, band(mem.cefr.overall)));
  if (list.length) writeCache(mem, list);
  return list;
}
