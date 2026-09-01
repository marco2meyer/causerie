import type { Card, Memory } from '../types';
import { api, OAI } from './api';
import { band } from './cefr';
import { pack } from '../lang';
import { newCard, recognitionCards } from './srs';
import { norm } from './utils';
import { scrubHint } from './hints';

/** Card forge: turn a typed term, a phrase or a pasted conversation excerpt into up to
 *  three complementary card proposals (recognition, cloze, production) the user picks
 *  from. One cheap model call; Fluent-Forever card shapes. */

export interface ForgedCard {
  type: 'fr2de' | 'de2fr' | 'cloze';
  front: string;
  back: string;
  hint: string;
  example: string;
  audio: string;
}

const FORGE_SCHEMA = {
  name: 'forged_cards',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      cards: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['fr2de', 'de2fr', 'cloze'] },
            front: { type: 'string' },
            back: { type: 'string' },
            hint: { type: 'string', description: 'short native-language cue; for a cloze it must never contain the answer or a word sharing its stem. Empty string if none.' },
            example: { type: 'string', description: 'natural example sentence in the target language; empty string if none' },
            audio: { type: 'string', description: 'target-language line for TTS (the example sentence, or the item itself)' }
          },
          required: ['type', 'front', 'back', 'hint', 'example', 'audio']
        }
      }
    },
    required: ['cards']
  }
} as const;

export async function suggestCards(input: string, mem: Memory): Promise<ForgedCard[]> {
  const P = pack(mem.profile.target);
  const nativeName = mem.profile.native === 'en' ? 'English' : 'German';
  // From A2 the recognition direction is not asked for at all: proposing a card the app
  // would then refuse to add is worse than proposing one fewer.
  const recog = recognitionCards(mem);
  const sys = recog ? `You create Fluent-Forever-style flashcards for a ${P.en} learner (native ${nativeName}, level ${band(mem.cefr.overall)}). The input is a term, a phrase, or an excerpt of a tutoring conversation, in either language. Identify the SINGLE most valuable learnable item (in an excerpt: a word the learner asked about, an idiom, or a corrected mistake) and propose EXACTLY three complementary cards: (1) type "fr2de" — front: the ${P.en} item, back: a concise ${nativeName} translation, example: one short, natural ${P.en} sentence using it, level-appropriate; (2) type "cloze" — front: that example sentence with the item replaced by ___, back: the item, hint: a 2-3 word ${nativeName} cue that never contains the item itself or any word sharing its stem (empty string if the only cue would be the answer); (3) type "de2fr" — front: the ${nativeName} translation, back: the ${P.en} item. audio is always the ${P.en} example sentence (or the bare item). Keep everything short. If the input is not usable for a card, return an empty cards array.`
    : `You create Fluent-Forever-style flashcards for a ${P.en} learner (native ${nativeName}, level ${band(mem.cefr.overall)}). The input is a term, a phrase, or an excerpt of a tutoring conversation, in either language. Identify the SINGLE most valuable learnable item (in an excerpt: a word the learner asked about, an idiom, or a corrected mistake) and propose EXACTLY two cards, both of which make the learner PRODUCE the ${P.en}: (1) type "cloze" — front: one short, natural, level-appropriate ${P.en} sentence using the item with the item replaced by ___, back: the item, hint: a 2-3 word ${nativeName} cue that never contains the item itself or any word sharing its stem (empty string if the only cue would be the answer); (2) type "de2fr" — front: a concise ${nativeName} translation of the item, back: the ${P.en} item, example: that same ${P.en} sentence. Never propose a card whose front is the ${P.en} item and whose back is the translation: at this level recognition is the half the learner already gets free from every conversation. audio is always the ${P.en} example sentence (or the bare item). Keep everything short. If the input is not usable for a card, return an empty cards array.`;
  const body = {
    model: 'gpt-5.4-mini',
    messages: [{ role: 'system', content: sys }, { role: 'user', content: input.slice(0, 600) }],
    response_format: { type: 'json_schema', json_schema: FORGE_SCHEMA },
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
  if (!r.ok) throw new Error('forge ' + r.status);
  const j = await r.json();
  const out = JSON.parse(j.choices?.[0]?.message?.content ?? '{"cards":[]}') as { cards: ForgedCard[] };
  return (out.cards ?? []).filter(c => c.front && c.back && (recog || c.type !== 'fr2de')).slice(0, 3);
}

/** The deck key a proposal would occupy. Exported so the sheet can say which proposals
 *  are already in the deck BEFORE the student picks them — silently dropping a pick at
 *  add time reads as the button doing nothing. */
export function forgeKey(f: Pick<ForgedCard, 'type' | 'front'>): string {
  return f.type + '|' + norm(f.front);
}

/** The proposals that are already in the deck, by index. */
export function forgeExisting(props: ForgedCard[], deck: { cards: Card[] }): boolean[] {
  const existing = new Set(deck.cards.map(c => c.type + '|' + norm(c.front)));
  return props.map(f => existing.has(forgeKey(f)));
}

/** Materializes the picked proposals as deck cards, skipping duplicates of the deck.
 *  `turnId` and `sessionId` link them back to the conversation they were forged out of,
 *  so a card made from an old transcript belongs to that call rather than to today. */
export function forgeToCards(
  picked: ForgedCard[], deck: { cards: Card[] }, turnId?: string, sessionId?: string
): Card[] {
  const existing = new Set(deck.cards.map(c => c.type + '|' + norm(c.front)));
  const out: Card[] = [];
  for (const f of picked) {
    const key = forgeKey(f);
    if (existing.has(key)) continue;
    existing.add(key);
    out.push(newCard({
      type: f.type,
      front: f.front,
      back: f.back,
      // A forged cloze is a gap like any other: its hint may not name what fills it.
      hint: (f.type === 'cloze' ? scrubHint(f.hint, f.back) : f.hint) || undefined,
      example: f.example || undefined,
      audioText: f.audio || undefined,
      tag: 'vocabulaire',
      sourceKind: 'manual',
      ...(turnId ? { sourceTurnId: turnId } : {}),
      ...(sessionId ? { sourceSessionId: sessionId } : {})
    }));
  }
  return out;
}
