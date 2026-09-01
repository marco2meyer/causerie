import type { Card, Memory } from '../types';
import { api, OAI } from './api';
import { LANGS } from './langs';

/** AI images for cards, Fluent-Forever style: the point is a scene that is personal,
 *  concrete and slightly absurd, because that is what sticks. A small model proposes
 *  two such scenes for the card; the student picks one, edits it, or writes their own. */

export interface PromptIdeas { a: string; b: string }

const IDEAS_SCHEMA = {
  name: 'image_prompt_ideas',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      a: { type: 'string', description: 'the personal scene: the student\'s own life, interests or the card\'s example sentence taken literally. Max 40 words, in the target language, feature-anchored per the rules.' },
      b: { type: 'string', description: 'the absurd scene: physically impossible, funny, unforgettable. Same feature, different KIND of picture — not a rewording of a. Max 40 words, in the target language.' }
    },
    required: ['a', 'b']
  }
} as const;

/** Pure builder, unit-tested: the card, plus the student's interests AND the facts the
 *  tutor has learned about them, as personal hooks.
 *
 *  The rules below are worth their length. Three of them were fixing something specific:
 *
 *  The old prompt offered "flying calendar pages, melting clock" as ways to show a tense,
 *  and then forbade numbers in the image. A calendar and a clock face are made of numbers.
 *  Every time the model took that suggestion the generator either wrote digits on the card
 *  or produced a smeared dial, so the time cues here are ones that carry no writing at all.
 *
 *  The gender anchor is a Fluent-Forever convention and belongs on nouns, which is where it
 *  now stays: a queen hugging an adverb teaches nothing, and the monarch was crowding the
 *  object it was supposed to be marking.
 *
 *  And two ideas that differ only in their scenery are one idea shown twice. They now
 *  differ in KIND — one from the student's own life, one impossible — so the choice offered
 *  is an actual choice. */
export function buildIdeaMessages(card: Pick<Card, 'front' | 'back' | 'hint' | 'example' | 'type'>, mem: Memory) {
  const L = LANGS[mem.profile.target] ?? LANGS.fr;
  const interests = (mem.interests ?? []).slice(0, 4).map(i => i.label).join(', ');
  // The tutor's own notes on the student beat a list of topic labels: "works on AI safety"
  // puts a person in a place, where "technology" only picks a backdrop.
  const facts = [...(mem.facts ?? [])]
    .sort((a, b) => (b.lastSaid || '').localeCompare(a.lastSaid || ''))
    .slice(0, 4).map(f => f.text).filter(Boolean).join('; ');
  // English is the one target here without grammatical gender, and a king-and-queen rule
  // for a language that has no genders is noise the model will obey anyway.
  const gendered = mem.profile.target !== 'en';

  const sys = [
    `You help a language student build Fluent-Forever picture flashcards. Given one flashcard, propose exactly TWO short prompts (max 40 words each) for an image generator. Write them in ${L.en}.`,
    'FIRST name to yourself the single FEATURE the card tests — a word\'s meaning, a gender, an article, a preposition, a verb form or tense, a fixed expression — and build the scene around THAT, not around the topic. The test of a good prompt: someone who has never seen the card should be able to say the word back from the picture alone.',
    'ANCHORS, fixed so the whole deck stays consistent:',
    ...(gendered ? ['· NOUN: a giant QUEEN in red owns, wears or hugs the object when the noun is feminine; a giant KING in blue when it is masculine. The monarch is a marker, not the subject — the object stays the centre of the picture. Nouns only: never a monarch for a verb, an adverb or an expression.'] : []),
    '· PREPOSITION or spatial relation: the relation itself IS the picture — something absurdly on, under, between, through, behind.',
    '· VERB FORM or TENSE: show time with NO clock, calendar or written date — the same character young and old in one frame, a seed beside the tree it became, a sun and a moon in one sky.',
    '· ABSTRACT IDEA: one concrete mini-story that embodies it, with a person doing something. Not a symbol.',
    'THE PICTURE: one single frame. No panels, no before/after splits, no collage, no arrows, no diagrams, no speech bubbles — generators render those as mush and smuggle writing in. Concrete nouns, one clear action, one strong emotion, exaggerated to just past the point of ridiculous. Nothing written anywhere: no signs, labels, book covers, clock faces or calendars.',
    'THE TWO MUST DIFFER IN KIND, not in scenery. a: the student\'s own world — their life, their interests, or the card\'s example sentence taken literally. b: absurd and physically impossible, funny enough to be remembered involuntarily.',
    'Use the hint and the example to settle WHICH SENSE of the word is meant; a card with a gap should have its own sentence acted out in a.'
  ].join(' ');

  const usr = `Flashcard (${L.en} learning): type=${card.type}, front=${JSON.stringify(card.front)}, back=${JSON.stringify(card.back)}`
    + (card.hint ? ', hint=' + JSON.stringify(card.hint) : '')
    + (card.example ? ', example=' + JSON.stringify(card.example) : '')
    + (interests ? `\nThe student cares about: ${interests}.` : '')
    + (facts ? `\nTrue of the student: ${facts}.` : '')
    + (interests || facts ? '\nUse one of these as the setting or the cast of a, when it fits naturally. Never force one in.' : '');
  return [{ role: 'system' as const, content: sys }, { role: 'user' as const, content: usr }];
}

export async function suggestPrompts(card: Card, mem: Memory): Promise<PromptIdeas | null> {
  const body = {
    model: 'gpt-5.4-mini',
    messages: buildIdeaMessages(card, mem),
    response_format: { type: 'json_schema', json_schema: IDEAS_SCHEMA },
    reasoning_effort: 'low' // 'minimal' exists only from 5.6 on; 'low' is fast everywhere
  };
  try {
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
    if (!r.ok) return null;
    const j = await r.json();
    const out = JSON.parse(j.choices?.[0]?.message?.content ?? '') as PromptIdeas;
    return out.a && out.b ? out : null;
  } catch { return null; }
}

/** The cheap/fast tier is plenty for mnemonic card images ('flash level'):
 *  ~13 s and ~$0.002 per image vs ~25 s and ~$0.008 on gpt-image-2. */
export const IMG_MODEL = 'gpt-image-1-mini';

/** Appended to EVERY generation prompt: flashcard images must stay text-free. */
export const NO_TEXT_SUFFIX = ' — no text, no letters, no numbers, no captions, no watermarks anywhere in the image.';

/** One generated image as a raw data URL (caller downscales before storing). */
export async function generateImage(prompt: string): Promise<string> {
  const base = prompt.trim().slice(0, 600);
  if (!base) throw new Error('empty prompt');
  const p = base + NO_TEXT_SUFFIX;
  if (api.useServer()) {
    const r = await fetch('/api/image', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...api.authHeaders() },
      body: JSON.stringify({ prompt: p, model: IMG_MODEL })
    });
    if (!r.ok) throw new Error('image ' + r.status + ' : ' + (await r.text()).slice(0, 120));
    const j = await r.json();
    if (!j.img) throw new Error('empty image');
    return j.img as string;
  }
  const r = await fetch(OAI() + '/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + api.getKey() },
    body: JSON.stringify({ model: IMG_MODEL, prompt: p, size: '1024x1024', quality: 'low', output_format: 'webp' })
  });
  if (!r.ok) throw new Error('image ' + r.status + ' : ' + (await r.text()).slice(0, 120));
  const j = await r.json();
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error('empty image');
  return 'data:image/webp;base64,' + b64;
}
