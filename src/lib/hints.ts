import type { Card } from '../types';
import { norm, stemsMatch, words } from './utils';

/** Card hints that give the answer away.
 *
 *  A cloze asks the learner to produce one word; a hint printed under it is meant to point
 *  at that word from the outside — its meaning, its tense, the contrast it sits in. When the
 *  hint contains the word itself the card stops being a retrieval exercise and becomes a
 *  copying exercise, and the spacing schedule goes on rewarding a recall that never happened.
 *
 *  The model is told not to do it (see the analysis and forge prompts), but a card is
 *  forever and a prompt is a request, so every hint passes through here on its way into the
 *  deck — and every hint already in a deck passes through the migration. */

/** Words too common to carry a hint on their own once the leak is masked out. */
const FILLER = new Set([
  'von', 'vom', 'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem', 'nicht',
  'und', 'oder', 'mit', 'ohne', 'sich', 'ist', 'sind', 'war', 'form', 'wort',
  'the', 'and', 'not', 'with', 'without', 'for', 'his', 'her', 'its', 'word',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'pas', 'avec', 'sans',
  'est', 'sont', 'mot', 'forme', 'el', 'los', 'las', 'il', 'lo', 'gli', 'o', 'os', 'as'
]);

/** A hint shaped as a choice between two forms ("savoir / connaître", "ser oder estar").
 *  Masking one side of a pair is worse than dropping it: what survives reads as the answer,
 *  and it is precisely the form the learner got wrong. */
const PAIR = /\s*\/\s*|\s+(?:ou|oder|or|vs\.?|versus|anstatt|statt|au lieu de|instead of)\s+/i;

const leaking = (w: string, answer: string[]): boolean => answer.some(a => stemsMatch(w, a));

/** Everything the hint must not name: the answer and each of its words. */
function answerForms(answer: string): string[] {
  const whole = norm(answer);
  if (!whole) return [];
  return [...new Set([whole, ...words(answer)])].filter(Boolean);
}

/** Does this hint name the answer (in any inflected form)? */
export function hintLeaks(hint: string | undefined, answer: string): boolean {
  const forms = answerForms(answer);
  if (!forms.length || !hint) return false;
  return words(hint).some(w => leaking(w, forms));
}

/** The hint as it may reach the learner: unchanged when it keeps the answer to itself,
 *  masked when the leak is one word inside a hint that still says something without it,
 *  and dropped when what is left would be empty or misleading. No hint beats a wrong one:
 *  the front of a cloze already carries the whole sentence. */
export function scrubHint(hint: string | undefined | null, answer: string): string | undefined {
  const h = String(hint ?? '').trim();
  if (!h) return undefined;
  const forms = answerForms(answer);
  if (!forms.length) return h;
  if (!words(h).some(w => leaking(w, forms))) return h;
  if (PAIR.test(h)) return undefined; // half a contrast pair points at the wrong half
  const masked = tidy(h.replace(/[\p{L}\p{M}-]+/gu, w => (leaking(w, forms) ? '…' : w)));
  // The masking works word by word, so a leak welded into a longer token (elisions,
  // hyphenated forms) can survive it. Whatever the mask could not remove, the hint loses.
  if (words(masked).some(w => leaking(w, forms))) return undefined;
  const rest = words(masked).filter(w => w.length >= 3 && !FILLER.has(w));
  return rest.length ? masked : undefined;
}

/** Punctuation left stranded by the masking: empty brackets, doubled marks, loose edges. */
function tidy(s: string): string {
  return s
    .replace(/\(\s*…\s*\)|\[\s*…\s*\]/g, '')
    .replace(/^…\s*[=:,;–—-]\s*/, '') // "… = anfechten" is just "anfechten"
    .replace(/…(\s*…)+/g, '…')
    .replace(/\s*([,;:=])\s*(?=[,;:=]|$)/g, '')
    .replace(/^[\s,;:=–—-]+|[\s,;:=–—-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Is this card one whose hint must be checked? Only a gap card has a single short answer
 *  to give away; the fix-the-sentence shape asks for a whole sentence, where an explanation
 *  quoting part of it is the point rather than a leak. */
export function isGapCard(c: Pick<Card, 'type' | 'front' | 'back'>): boolean {
  return c.type === 'cloze' && c.front.includes('___')
    && c.back.trim().length <= 32 && words(c.back).length <= 4;
}

/** Scrubs every hint already in a deck. Returns how many it changed. Run once per deck
 *  (latched in storage.ts): a hint the learner rewrote by hand is left alone by the same
 *  rule that leaves a clean hint alone — it only ever removes the answer. */
export function scrubDeckHints(cards: Card[]): number {
  let n = 0;
  for (const c of cards) {
    if (!c.hint || !isGapCard(c)) continue;
    const next = scrubHint(c.hint, c.back);
    if (next === c.hint) continue;
    if (next) c.hint = next;
    else delete c.hint;
    n++;
  }
  return n;
}
