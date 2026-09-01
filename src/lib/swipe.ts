/** Horizontal drag gestures, kept out of the components so they can be reasoned about.
 *
 *  Two screens use one: the stop button on a call, where a tap holds the conversation and a
 *  drag to the right ends it — the gesture IS the confirmation, which is why nothing asks
 *  whether the student meant it — and the card in a review, where a drag to the right steps
 *  back. Both are the same shape: rightward travel past a distance, abandoned once the
 *  movement turns out to be going up or down instead. */

/** How far right the button must travel before letting go ends the call. Far enough that
 *  the slip of a thumb does not reach it, short enough for one comfortable movement. */
export const SWIPE_END_PX = 56;

/** And how far a review card must travel to step back. Shorter: going back is cheap and
 *  reversible — the step it undoes is one tap away again — so it need not be defended the
 *  way hanging up on someone does. */
export const SWIPE_BACK_PX = 44;

/** A thumb does not travel in a straight line. It pivots from the base of the hand, so a
 *  swipe across a phone is an ARC, and by the time it has gone eighty pixels sideways it
 *  has usually gone thirty or forty up or down as well. Judging that against a fixed budget
 *  of vertical pixels failed the gesture exactly when it was performed naturally and passed
 *  it when performed carefully, which is how a swipe comes to feel "difficult".
 *
 *  So the test is a direction, not a distance: a movement counts while it is going more
 *  sideways than up. Below a few pixels of travel there is no direction to speak of yet, so
 *  nothing is abandoned until the movement has committed to one. */
const ABANDON_RATIO = 1;
const DIRECTION_AT_PX = 12;

export interface Point { x: number; y: number }

/** Where the button should sit for this movement: 0..SWIPE_END_PX+overshoot, or null when
 *  the gesture has wandered off vertically and should be given up on. Leftward movement
 *  reads as 0 rather than as negative — the button never travels the wrong way. */
export function dragOffset(from: Point, to: Point, travel = SWIPE_END_PX): number | null {
  const dx = to.x - from.x;
  const dy = Math.abs(to.y - from.y);
  if (Math.max(Math.abs(dx), dy) >= DIRECTION_AT_PX && dy > Math.abs(dx) * ABANDON_RATIO) return null;
  return Math.max(0, Math.min(travel + 18, dx));
}

/** Would letting go here do the thing? */
export const swipeArmed = (offset: number, travel = SWIPE_END_PX): boolean => offset >= travel;
