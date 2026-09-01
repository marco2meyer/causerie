import type { Analysis, CallSession, Memory, TranscriptItem } from '../types';
import { BANDS, idxLvl, LEVELS } from './cefr';
import { compLibForAnalysis } from './competencies';
import { LANGS, AN_MODELS } from './langs';
import { api, OAI } from './api';
import { normalizeAnalysis } from './anshape';

/** Strict JSON schema handed to chat completions (response_format json_schema). */
export const AN_SCHEMA = {
  name: 'session_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      hauptpunkt: { type: 'string', description: 'One headline takeaway in the SIMPLE TARGET LANGUAGE the student can read at their level, max 2 sentences, dry tone, informal address.' },
      kommentar: { type: 'string', description: 'ONE short target-language sentence (kept for the record, not displayed).' },
      cefr: {
        type: 'object', additionalProperties: false,
        properties: {
          overall: { type: 'string', enum: LEVELS }, grammar: { type: 'string', enum: LEVELS },
          vocabulary: { type: 'string', enum: LEVELS }, fluency: { type: 'string', enum: LEVELS },
          comprehension: { type: 'string', enum: LEVELS },
          confidence: { type: 'number', description: '0..1' },
          begruendung: { type: 'string', description: '1-2 sentences in the simple target language.' }
        },
        required: ['overall', 'grammar', 'vocabulary', 'fluency', 'comprehension', 'confidence', 'begruendung']
      },
      corrections: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            user_turn: { type: 'integer', description: 'index of the student turn this refers to' },
            original: { type: 'string' }, besser: { type: 'string' },
            erklaerung: { type: 'string', description: 'short explanation in the SIMPLE TARGET LANGUAGE the student understands; a native-language gloss in brackets only when truly needed' },
            category: { type: 'string', enum: ['grammar', 'vocab', 'phrase', 'pronunciation', 'register'] },
            cefr_topic: { type: 'string' },
            cloze_text: { type: 'string', description: 'the corrected sentence with the key element replaced by ___ (exactly one gap)' },
            cloze_answer: { type: 'string', description: 'what goes in the gap' },
            hint: { type: 'string', description: 'very short native-language cue pointing AT the gap from outside it; it must never contain cloze_answer or any word sharing its stem. Empty string when no such cue exists.' }
          },
          required: ['user_turn', 'original', 'besser', 'erklaerung', 'category', 'cefr_topic', 'cloze_text', 'cloze_answer', 'hint']
        }
      },
      highlights: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: { user_turn: { type: 'integer' }, quote: { type: 'string' }, kommentar: { type: 'string', description: 'short praise in the simple target language, dry' } },
          required: ['user_turn', 'quote', 'kommentar']
        }
      },
      new_vocab: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: { fr: { type: 'string' }, de: { type: 'string' }, ex: { type: 'string' } },
          required: ['fr', 'de', 'ex']
        }
      },
      weaknesses: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            id: { type: ['string', 'null'], description: 'existing weakness id if this matches one, else null' },
            label: { type: 'string', description: 'label of the pattern, in the target language (grammar terminology is fine)' },
            cefr: { type: 'string', enum: BANDS },
            status: { type: 'string', enum: ['new', 'persisting', 'improving', 'resolved'] },
            evidence: { type: 'string' }
          },
          required: ['id', 'label', 'cefr', 'status', 'evidence']
        }
      },
      strengths: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: { id: { type: ['string', 'null'] }, label: { type: 'string' }, evidence: { type: 'string' } },
          required: ['id', 'label', 'evidence']
        }
      },
      interests: { type: 'array', items: { type: 'string' }, description: 'interests the student showed, short target-language labels' },
      facts: {
        type: 'array',
        description: 'personal facts the STUDENT revealed, selective (significant, likely to matter in future conversations)',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            text: { type: 'string', description: 'TARGET-LANGUAGE noun phrase, max 12 words' },
            category: { type: 'string', enum: ['arbeit', 'familie', 'alltag', 'vorlieben', 'orte', 'sonstiges'] }
          },
          required: ['text', 'category']
        }
      },
      prune: {
        type: 'object', additionalProperties: false,
        description: 'memory curation: stored entries to drop because trivial, outdated or duplicated',
        properties: {
          facts: { type: 'array', items: { type: 'string' }, description: 'ids from known_facts to remove' },
          interests: { type: 'array', items: { type: 'string' }, description: 'labels from known_interests to remove' }
        },
        required: ['facts', 'interests']
      },
      competencies: {
        type: 'array',
        description: 'observations mapped onto the comp_library (islands of knowledge across A1-C2); only clear evidence, empty array is fine',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            id: { type: ['string', 'null'], description: 'exact id from comp_library, or null for an observation outside it (e.g. a higher-band island)' },
            label: { type: 'string' },
            category: { type: 'string', enum: ['grammaire', 'vocabulaire', 'fonctions'] },
            cefr: { type: 'string', enum: BANDS },
            status: { type: 'string', enum: ['demonstrated', 'failed', 'partial'] },
            evidence: { type: 'string', description: 'short quote from the student' }
          },
          required: ['id', 'label', 'category', 'cefr', 'status', 'evidence']
        }
      },
      targets: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: { label: { type: 'string' }, achieved: { type: 'boolean' }, evidence: { type: 'string' } },
          required: ['label', 'achieved', 'evidence']
        }
      },
      next_focus: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: { label: { type: 'string' }, cefr: { type: 'string', enum: BANDS }, grund: { type: 'string' } },
          required: ['label', 'cefr', 'grund']
        }
      },
      topics: { type: 'array', items: { type: 'string' } }
    },
    required: ['hauptpunkt', 'kommentar', 'cefr', 'corrections', 'highlights', 'new_vocab', 'weaknesses', 'strengths', 'interests', 'facts', 'prune', 'competencies', 'targets', 'next_focus', 'topics']
  }
} as const;

export interface ChatMessage { role: 'system' | 'user'; content: string }

export function buildAnalysisMessages(mem: Memory, sess: Pick<CallSession, 'topic' | 'targets' | 'mode'>, transcript: TranscriptItem[], verbatimUser?: string | null): ChatMessage[] {
  const userTurns: number[] = [];
  const lines = transcript.map((it, i) => {
    if (it.role === 'user') {
      userTurns.push(i);
      return `S${userTurns.length - 1} (Student): ${it.text}`;
    }
    return `T (Tutorin): ${it.text}`;
  }).join('\n');

  const ctx = {
    student: { name: mem.profile.name, native: mem.profile.native ?? 'de', target: mem.profile.target },
    current_cefr: {
      overall: idxLvl(mem.cefr.overall),
      grammar: idxLvl(mem.cefr.skills.grammar),
      vocabulary: idxLvl(mem.cefr.skills.vocabulary),
      fluency: idxLvl(mem.cefr.skills.fluency),
      comprehension: idxLvl(mem.cefr.skills.comprehension)
    },
    open_weaknesses: (mem.weaknesses ?? []).filter(w => w.status !== 'resolved').map(w => ({ id: w.id, label: w.label, status: w.status })),
    known_strengths: (mem.strengths ?? []).map(s => ({ id: s.id, label: s.label })),
    known_facts: (mem.facts ?? []).map(f => ({ id: f.id, text: f.text, lastSaid: f.lastSaid })),
    known_interests: (mem.interests ?? []).map(i => ({ label: i.label, weight: i.weight })),
    comp_library: compLibForAnalysis(mem).map(c => ({ id: c.id, cat: c.cat, band: c.band, label: c.label })),
    comp_known: Object.entries(mem.comp ?? {}).map(([id, e]) => ({ id, status: e.status })),
    session: { topic: sess.topic, focus_targets: (sess.targets ?? []).map(t => t.label) }
  };

  const L = LANGS[mem.profile.target] ?? LANGS.fr;
  const nativeName = (mem.profile.native ?? 'de') === 'en' ? 'English' : 'German';
  const intro = sess.mode === 'intro'
    ? ' This was a getting-to-know-you call: its purpose is to ESTABLISH the level from scratch, so estimate decisively from what you observe and use high confidence; extract personal facts and interests the student showed.'
    : '';
  const sys = `You are the analysis engine of a language tutoring app. The student (native ${nativeName}) just finished a spoken conversation in ${L.en}. Assess ONLY what the transcript supports. Write ALL student-facing text (hauptpunkt, kommentar, erklaerung, hint, weakness labels, praise, begruendung) in ${L.en}, kept simple enough for the student's level (informal address), in a dry, concrete, unenthusiastic but kind tone; never gush. Only when a point is impossible to get across at their level, add a short ${nativeName} gloss in brackets after the ${L.en}. Be a strict but fair European-framework (GER/CEFR) rater: base level estimates on the student's own production (Sx turns), not the tutor's. Sublevels with + are allowed (A2+ means solid A2, approaching B1). For corrections: pick the most instructive errors (max 6), quote the student verbatim in "original", and build a cloze exercise from the corrected sentence: cloze_text is the corrected sentence with the key element (the thing the student got wrong) replaced by ___, cloze_answer is that element, hint is a two-or-three-word cue in the student's native language. THE HINT MAY NEVER GIVE THE ANSWER AWAY: it must not contain cloze_answer, any inflected form of it, or any word sharing its stem (for an answer "contesté" that rules out "contester", "conteste", "contestation" — write the ${nativeName} meaning instead, e.g. "anfechten"). A hint that would only restate the answer is not worth writing: return an empty string and the card goes without one. These become spaced-repetition cards, so make the gap test the actual mistake: the gap covers ONLY the errorful element — the SHORTEST span containing the mistake, never neighbouring words the student already produced correctly (if they said "pas jamais dessiné", the gap is the negation part, not "jamais dessiné"). When the error is a choice between two confusable words or forms (savoir/connaître, jamais/pas encore, ser/estar), do NOT print the two forms — that hands over the answer. Give the contrast through its ${nativeName} meanings instead ("kennen, nicht wissen" for connaître against savoir; "noch nicht" for pas encore against jamais), so the card still trains the distinction without naming the form it wants. CODE-SWITCHES OUTRANK EVERYTHING: when the student drops a ${nativeName} or English word into the ${L.en} (e.g. "income", "Termin"), that word is NOT ${L.en} — never treat it as a ${L.en} style or register choice. Correct it with category "vocab", state plainly in erklaerung that the word is English/${nativeName} and give the ${L.en} equivalent, build the cloze around that ${L.en} word, and ALSO add it to new_vocab so it reliably becomes cards. Such gaps take precedence over minor grammar slips within the max-6 budget. For new_vocab: up to 5 genuinely useful words or phrases that came up — count words the TUTOR introduced and the student engaged with (repeated, asked about, or clearly met for the first time), not only words the student produced — each with the example sentence from THIS conversation where possible. MANDATORY: any word the student explicitly asked about ("what does X mean", "qu'est-ce que ça veut dire", "was heißt X", "how do you say Y") MUST appear in new_vocab — a word the student cared enough to ask about is never dropped, whatever else competes for the slots. For facts: BE SELECTIVE. Record only personal facts the student volunteered that are genuinely worth remembering long-term (their work, recurring people, places they live or frequent, ongoing projects, stable habits and preferences that shape conversations). Skip one-off trivia and passing remarks. Write facts as short ${L.en} noun phrases (they feed a ${L.en} tutor briefing); NEVER include health, medical, or similarly sensitive information; empty array if nothing new. Interests likewise in ${L.en}, only if they genuinely recur or matter. For prune: this is periodic memory curation, not bookkeeping — from known_facts, list the ids of entries that have become trivial, outdated or duplicated (the memory should stay small and sharp; when in doubt between two similar facts, keep the richer one); from known_interests, list labels that clearly stopped mattering. Empty arrays are fine when nothing should go. Match weaknesses to existing ids where they are the same underlying pattern; set status thoughtfully (persisting if it appeared again, improving if attempted and mostly right, resolved only with clear evidence). For competencies: learners have ISLANDS of knowledge across A1-C2, not one clean level — map what the student actually produced onto comp_library ids: "demonstrated" only when used correctly and spontaneously, "failed" when attempted and wrong or clearly missing right where it was needed, "partial" when mixed. Judge from evidence, never from absence (not using the subjunctive is not failing it). Prefer filling cells that have NO entry in comp_known, including LOWER bands (foundations a fluent-sounding student may lack) and HIGHER-band islands genuinely shown (use id from comp_library if listed, else id null with your own label). 3-8 competency observations per call is typical; quote the student in evidence. Transcription caveats: the turn-based transcript comes from live ASR that sometimes silently CORRECTS learner errors, so treat it as approximate${verbatimUser ? ' — a VERBATIM re-transcription of the student\'s own microphone audio is provided below; judge the student\'s errors PRIMARILY from that verbatim text (it preserves their real mistakes), use the turn transcript for conversational structure, the tutor\'s lines and user_turn indexing, and only flag errors that the verbatim text supports' : ''}. Ignore likely ASR artifacts (odd homophones, missing liaison) rather than treating them as student errors, and never grade punctuation or capitalization. Background noise can produce hallucinated turns (unrelated fragments, subtitle credits, stray words with no conversational context): treat such turns as noise, ignore them entirely, never grade them and never derive facts from them. If the transcript contains almost no student speech, say so in the Hauptpunkt, keep corrections empty, and return the current levels unchanged with low confidence.${intro}`;
  const usr = `CONTEXT:\n${JSON.stringify(ctx, null, 1)}\n\nTRANSCRIPT (Sx = student turn index you must reference in user_turn):\n${lines}${verbatimUser ? `\n\nVERBATIM RE-TRANSCRIPTION OF THE STUDENT'S MICROPHONE AUDIO (ground truth for their errors; unsegmented):\n${verbatimUser.slice(0, 6000)}` : ''}`;
  return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
}

/** Tolerant extraction of the JSON object from a model reply (fences, leading prose). */
export function parseAnalysisContent(content: string): Analysis {
  let c = content.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const m0 = c.indexOf('{');
  if (m0 > 0) c = c.slice(m0);
  return normalizeAnalysis(JSON.parse(c));
}

class FatalAuthError extends Error {
  fatal = true;
  constructor(msg: string) { super(msg); }
}

/** Incremental parser for a chat-completions SSE stream. Pure, so the chunk-boundary
 *  handling is unit-testable: lines can arrive split anywhere, [DONE] ends the stream,
 *  and a buffered proxy may deliver everything in one chunk. */
export function sseAccumulator() {
  let tail = '';
  let content = '';
  let usage: unknown = null;
  const take = (line: string) => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const j = JSON.parse(data);
      const d = j.choices?.[0]?.delta?.content;
      if (typeof d === 'string') content += d;
      const full = j.choices?.[0]?.message?.content; // non-stream shape, collapsed by a proxy
      if (typeof full === 'string' && full) content = full;
      if (j.usage) usage = j.usage;
    } catch { /* malformed line: skip */ }
  };
  return {
    push(chunk: string) {
      tail += chunk;
      const lines = tail.split(/\r?\n/);
      tail = lines.pop() ?? '';
      lines.forEach(take);
    },
    end() { if (tail) { take(tail); tail = ''; } },
    get content() { return content; },
    get usage() { return usage; }
  };
}

/** Chat Completions reports `prompt_tokens` / `completion_tokens`; the price table speaks
 *  `input_tokens` / `output_tokens`. The server function already translates between them
 *  (netlify/edge-functions/analyze.mjs); without the same translation on the client every
 *  term priced to zero and the analysis leg vanished from the call's cost breakdown. */
export function normalizeUsage(u: unknown): Record<string, number> {
  const x = (u ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => Math.max(0, Number(v) || 0);
  const det = (x.prompt_tokens_details ?? {}) as Record<string, unknown>;
  return {
    input_tokens: n(x.input_tokens ?? x.prompt_tokens),
    output_tokens: n(x.output_tokens ?? x.completion_tokens),
    cached_input_tokens: n(x.cached_input_tokens ?? det.cached_tokens)
  };
}

/** The schema spelled out for the attempt that cannot send one. Every field is required;
 *  an empty list or an empty string is how the model says "nothing here". */
const SCHEMA_IN_WORDS = `

Return ONLY a JSON object, no markdown, with exactly these keys — every one of them present,
every string a string (empty when there is nothing to say), every list a list (empty when
there is nothing in it):
{"hauptpunkt":string,"kommentar":string,
 "cefr":{"overall":string,"grammar":string,"vocabulary":string,"fluency":string,"comprehension":string,"confidence":number,"begruendung":string},
 "corrections":[{"user_turn":integer,"original":string,"besser":string,"erklaerung":string,"category":"grammar"|"vocab"|"phrase"|"pronunciation"|"register","cefr_topic":string,"cloze_text":string,"cloze_answer":string,"hint":string}],
 "highlights":[{"user_turn":integer,"quote":string,"kommentar":string}],
 "new_vocab":[{"fr":string,"de":string,"ex":string}],
 "weaknesses":[{"id":string|null,"label":string,"cefr":string,"status":"new"|"persisting"|"improving"|"resolved","evidence":string}],
 "strengths":[{"id":string|null,"label":string,"evidence":string}],
 "interests":[string],
 "facts":[{"text":string,"category":"arbeit"|"familie"|"alltag"|"vorlieben"|"orte"|"sonstiges"}],
 "prune":{"facts":[string],"interests":[string]},
 "competencies":[{"id":string|null,"label":string,"category":"grammaire"|"vocabulaire"|"fonctions","cefr":string,"status":"demonstrated"|"failed"|"partial","evidence":string}],
 "targets":[{"label":string,"achieved":boolean,"evidence":string}],
 "next_focus":[{"label":string,"cefr":string,"grund":string}],
 "topics":[string]}`;

/** Runs the post-call analysis. The response is STREAMED (SSE): the model needs
 *  ~30-60s to write the full report, which exceeds the serverless function's timeout
 *  when buffered — streaming keeps bytes flowing and doubles as a progress signal.
 *  Tries the preferred model first, then falls back down the chain — every model WITH the
 *  strict schema before any model goes without it.
 *
 *  And the schema is dropped only for the one failure it was ever meant to answer: a model
 *  that REFUSES `response_format`, which arrives as a 400 naming the schema. A timeout, a
 *  429, a 500, a dropped connection — none of those say anything about the shape, and
 *  answering them by asking the same model for free-form JSON trades the one guarantee this
 *  pipeline has for a guess, on evidence that is not about the guarantee at all. That is
 *  what happened on 23 August 2026: something transient killed the schema request (it never
 *  billed a token, so it died before the model wrote anything), the retry went out without
 *  the schema, and the reply came back in a French schema of the model's own invention —
 *  `corrected`, `term`, `praise`, `niveaux` — which the memory then kept. A failed analysis
 *  is a screen the student can retry from; a mangled one is a conversation quietly recorded
 *  wrong. Better the honest failure.
 *
 *  The schema-less attempt also has to be TOLD the shape: `response_format` was the only
 *  place it was ever written down, so removing it and asking for "the agreed schema" asked
 *  for something the model had never been shown. */
export async function runAnalysis(mem: Memory, sess: Pick<CallSession, 'topic' | 'targets' | 'mode'>, transcript: TranscriptItem[], verbatimUser?: string | null, onProgress?: (chars: number) => void): Promise<Analysis> {
  const messages = buildAnalysisMessages(mem, sess, transcript, verbatimUser);
  const pref = mem.settings.analysisModel || 'gpt-5.6-sol';
  const chain = [pref, ...AN_MODELS.filter(m => m !== pref)];
  let lastErr: Error | null = null;
  /** Did any model actually turn the schema down? Only that earns a schema-less pass. */
  let schemaRefused = false;

  for (const useSchema of [true, false]) {
    if (!useSchema && !schemaRefused) break;
    for (const model of chain) {
      const ctl = new AbortController();
      const kill = setTimeout(() => ctl.abort(), 150_000);
      try {
        const body: Record<string, unknown> = {
          model,
          messages: useSchema
            ? messages
            : [messages[0], { role: 'user', content: messages[1].content + SCHEMA_IN_WORDS }],
          stream: true,
          stream_options: { include_usage: true }
        };
        if (useSchema) body.response_format = { type: 'json_schema', json_schema: AN_SCHEMA };
        // Structured extraction needs little deliberation; low effort roughly halves latency.
        if (model.startsWith('gpt-5')) body.reasoning_effort = 'low';

        let r: Response;
        if (api.useServer()) {
          r = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...api.authHeaders() },
            body: JSON.stringify(body),
            signal: ctl.signal
          });
          if (r.status === 401) throw new FatalAuthError('AUTH');
        } else {
          r = await fetch(OAI() + '/v1/chat/completions', {
            method: 'POST',
            headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + api.getKey() },
            body: JSON.stringify(body),
            signal: ctl.signal
          });
        }
        if (!r.ok) {
          const tx = await r.text();
          lastErr = new Error(model + ' (' + r.status + '): ' + tx.slice(0, 160));
          if (r.status === 401 || r.status === 403) throw new FatalAuthError(lastErr.message);
          // A refusal of the schema itself, as opposed to a bad minute on the network.
          if (useSchema && r.status === 400 && /response_format|json_schema|schema/i.test(tx)) schemaRefused = true;
          continue;
        }
        let content: string;
        let acc0: ReturnType<typeof sseAccumulator> | null = null;
        if (r.body && (r.headers.get('content-type') || '').includes('text/event-stream')) {
          const acc = acc0 = sseAccumulator();
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            acc.push(dec.decode(value, { stream: true }));
            onProgress?.(acc.content.length);
          }
          acc.push(dec.decode());
          acc.end();
          content = acc.content;
        } else {
          // Older server function (or a proxy that collapsed the stream): plain JSON.
          const j = await r.json();
          content = j.choices?.[0]?.message?.content ?? '';
        }
        const out = parseAnalysisContent(content);
        out._model = model;
        // Which door this report came through. One field, written once, and the difference
        // between an afternoon of forensics and a single query the next time one of these
        // arrives shaped wrong.
        if (!useSchema) out._schema = false;
        if (acc0?.usage) out._usage = normalizeUsage(acc0.usage);
        return out;
      } catch (e) {
        if ((e as FatalAuthError).fatal) throw e;
        lastErr = e as Error;
      } finally {
        clearTimeout(kill);
      }
    }
  }
  throw lastErr ?? new Error('Analyse échouée');
}
