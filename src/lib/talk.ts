import type { Memory, TranscriptItem } from '../types';

/** Who did the talking.
 *
 *  Across ten real calls Odile produced 69% of the words: 3,477 to the student's 1,540.
 *  Every one of those words is a word he did not say, and in a conversation class the
 *  ratio is supposed to run the other way — an eight-minute call at that rate buys about
 *  two and a half minutes of actual speaking practice. Nothing in the app could see this,
 *  which is why it survived seventeen sessions unnoticed, so it is measured here, stored
 *  on the session, shown in the debrief, and fed back into the next briefing. */

/** Share of the spoken words that were hers, 0..1. Null when there is nothing to judge. */
export function tutorShare(transcript: TranscriptItem[] | undefined): number | null {
  const words = (t: TranscriptItem) => (t.text || '').trim().split(/\s+/).filter(Boolean).length;
  let her = 0;
  let his = 0;
  for (const t of transcript ?? []) {
    if (t.role === 'assistant') her += words(t);
    else his += words(t);
  }
  const total = her + his;
  // Under a hundred words nobody has settled into a rhythm yet and the number is noise.
  if (total < 100) return null;
  return her / total;
}

/** What she should be under. A tutor may reasonably take a bit less than half of a
 *  beginner's conversation — she is modelling, asking, sometimes explaining — but past
 *  this she is holding the microphone. */
export const TALK_TARGET = 0.45;
/** Past this it is not a conversation the student is having, it is one he is watching. */
export const TALK_HIGH = 0.55;

/** Her share across the last few calls, which is what the briefing should react to: one
 *  talkative call is a call, three in a row is a habit. */
export function recentTutorShare(mem: Memory, n = 4): number | null {
  const shares = (mem.sessions ?? [])
    .slice(-n)
    .map(s => (typeof s.tutorShare === 'number' ? s.tutorShare : tutorShare(s.transcript)))
    .filter((x): x is number => typeof x === 'number');
  if (shares.length < 2) return null;              // one call is not a tendency
  return shares.reduce((a, b) => a + b, 0) / shares.length;
}

export type TalkVerdict = 'good' | 'high' | 'hogging';

export function talkVerdict(share: number): TalkVerdict {
  return share <= TALK_TARGET ? 'good' : share <= TALK_HIGH ? 'high' : 'hogging';
}
