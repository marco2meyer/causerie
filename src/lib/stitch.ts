import type { TranscriptItem } from '../types';

/** Turn-transcript repair.
 *
 *  The realtime API commits a turn whenever its VAD decides the speaker has stopped, and a
 *  learner hunting for a word stops often. One spoken sentence therefore arrives as three or
 *  four consecutive "user" items with nothing from the tutor between them, e.g.
 *
 *    U: Quand il y a beaucoup de gens et l'ambiance est forte
 *    U: Et la chose qui gêne
 *    U: Si mes amis
 *    U: Rencontre
 *
 *  Odile answered the whole thing once, so those four items are one turn in the conversation
 *  and reading them as four makes the transcript look scrambled. Stitching them back is safe:
 *  no information is lost, and downstream (analysis, Sx indexing, the transcript view) then
 *  sees the turn structure that actually happened.
 *
 *  What this does NOT do is recover audio that fell in the gap between two committed
 *  segments — that is what the verbatim re-transcription of the raw mic recording is for. */

/** Joins two fragments of one utterance with a single space. Deliberately no case or
 *  punctuation surgery: this transcript is the record of what the learner said, and
 *  "tidying" the seam is the same class of error the verbatim pipeline exists to avoid. */
function joinFragments(a: string, b: string): string {
  const left = a.replace(/\s+$/, '');
  const right = b.replace(/^\s+/, '');
  return right ? left + ' ' + right : left;
}

/** Merges runs of consecutive same-role items into one item per conversational turn. */
export function stitchTranscript(items: TranscriptItem[]): TranscriptItem[] {
  const out: TranscriptItem[] = [];
  // Tracked separately from `out`: a tutor turn cut off by barge-in before its first
  // transcript delta is textless, but it still happened, and the student turns on either
  // side of it are two turns rather than one interrupted sentence.
  let lastRole: TranscriptItem['role'] | null = null;
  for (const it of items) {
    const text = (it.text || '').trim();
    if (!text) { lastRole = it.role; continue; }
    const prev = out[out.length - 1];
    if (prev && lastRole === it.role && prev.role === it.role) {
      prev.text = joinFragments(prev.text, text);
    } else {
      out.push({ ...it, text });
    }
    lastRole = it.role;
  }
  return out;
}
