import { norm, words } from './utils';

/** Did that "student" turn actually come out of the loudspeaker?
 *
 *  Without headphones the tutor's voice leaves the speaker and re-enters the microphone
 *  beside it. The realtime model's default detector is semantic — it decides somebody is
 *  talking by understanding them, and it has no loudness threshold at all — so echo is
 *  perfectly intelligible speech and it interrupts her with it. The result is a tutor who
 *  cannot finish a sentence, and, worse and more quietly, a transcript in which HER words
 *  are attributed to the student and then graded as their French.
 *
 *  Two things have to be true before a turn is called an echo, because the cost of being
 *  wrong is deleting something the learner really said:
 *
 *  1. They started talking WHILE her audio was playing. A learner repeating a word back at
 *     her — which is a thing learners do constantly, and the whole point of a recast — comes
 *     after she has finished, not on top of her.
 *  2. What came through is HER words. Not similar words: her words, in her order, as a run
 *     inside something she has just said.
 *
 *  Only the first few seconds of an interruption ever get transcribed, so the echo is short
 *  and the match is a prefix or a fragment rather than the whole sentence. */

/** Longer than this and it stopped being an echo fragment and became a person talking. */
const MAX_ECHO_WORDS = 12;

/** Is `said` a run of consecutive words from `spoken`? */
function fragmentOf(said: string[], spoken: string[]): boolean {
  if (!said.length || said.length > spoken.length) return false;
  for (let i = 0; i + said.length <= spoken.length; i++) {
    let k = 0;
    while (k < said.length && spoken[i + k] === said[k]) k++;
    if (k === said.length) return true;
  }
  return false;
}

/** `recent` is what the tutor has said lately, newest last. */
export function looksLikeEcho(said: string, recent: string[]): boolean {
  const w = words(said);
  if (!w.length || w.length > MAX_ECHO_WORDS) return false;
  // A single short word is too little to be sure of: "oui" said over her is a student
  // agreeing, not a loudspeaker.
  if (w.length === 1 && norm(said).length < 4) return false;
  return recent.some(r => fragmentOf(w, words(r)));
}
