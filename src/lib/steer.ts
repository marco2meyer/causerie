import type { CheckinAnswer } from '../types';

/** The chosen answers as something a tutor can act on.
 *
 *  They used to be joined bare — "Alterne les deux ; Travaille le subjonctif" — and half of
 *  that is unreadable without the question it answered. "Alternate the two" alternates WHAT?
 *  The briefing was handed a sentence with its subject removed and asked to steer by it.
 *  Keeping the question makes each one an instruction: "Quel niveau de difficulté : alterne
 *  les deux". */
export function directionFrom(answers: CheckinAnswer[]): string {
  return answers
    .filter(a => a.answer)
    .map(a => (a.question ? a.question.replace(/\s*[?？]\s*$/, '') + ' : ' : '') + a.answer)
    .join(' ; ');
}
