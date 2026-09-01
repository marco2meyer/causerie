import { describe, expect, it } from 'vitest';
import { dragOffset, SWIPE_BACK_PX, SWIPE_END_PX, swipeArmed } from '../../src/lib/swipe';

/* The stop button holds the call on a tap and ends it on a drag. That makes the gesture the
 * confirmation, so the line between the two has to be somewhere a thumb does not cross by
 * accident — and has to stay out of the way of scrolling the screen behind it. */
describe('the stop button gesture', () => {
  const from = { x: 200, y: 700 };

  it('does not arm on a tap or a twitch', () => {
    expect(swipeArmed(dragOffset(from, { x: 200, y: 700 })!)).toBe(false);
    expect(swipeArmed(dragOffset(from, { x: 208, y: 703 })!)).toBe(false);
    expect(swipeArmed(dragOffset(from, { x: 200 + SWIPE_END_PX - 1, y: 700 })!)).toBe(false);
  });

  it('arms once the button has travelled far enough', () => {
    expect(swipeArmed(dragOffset(from, { x: 200 + SWIPE_END_PX, y: 700 })!)).toBe(true);
    expect(swipeArmed(dragOffset(from, { x: 400, y: 712 })!)).toBe(true);
  });

  /* A thumb pivots from the base of the hand, so a swipe across a phone is an arc: eighty
   * pixels sideways usually comes with thirty or forty up or down. Judged against a fixed
   * budget of vertical pixels, the gesture failed exactly when it was performed naturally
   * — which is how a swipe comes to feel "difficult". The test is a direction now. */
  it('accepts the arc a thumb actually travels in', () => {
    expect(swipeArmed(dragOffset(from, { x: 200 + SWIPE_END_PX + 20, y: 745 })!)).toBe(true);
    expect(swipeArmed(dragOffset(from, { x: 200 + SWIPE_END_PX + 20, y: 655 })!)).toBe(true);
  });

  it('gives up once the movement is going more up than along, so a scroll cannot end a call', () => {
    expect(dragOffset(from, { x: 240, y: 820 })).toBeNull();
    expect(dragOffset(from, { x: 240, y: 580 })).toBeNull();
    expect(dragOffset(from, { x: 200, y: 800 })).toBeNull();
  });

  it('does not call a two-pixel wobble a direction', () => {
    // Nothing has committed yet at this distance, so nothing is abandoned either.
    expect(dragOffset(from, { x: 202, y: 706 })).not.toBeNull();
  });

  it('never travels left, and never runs away to the right', () => {
    expect(dragOffset(from, { x: 100, y: 700 })).toBe(0);
    expect(dragOffset(from, { x: 9000, y: 700 })).toBeLessThanOrEqual(SWIPE_END_PX + 18);
  });

  it('asks for a real movement rather than a nudge, but not for a planned one', () => {
    // Long enough that a thumb resting on the button cannot reach it by accident; short
    // enough to cross without lifting the hand, which is what made it feel difficult.
    expect(SWIPE_END_PX).toBeGreaterThanOrEqual(40);
    expect(SWIPE_END_PX).toBeLessThanOrEqual(74);   // the button's own width
  });
});

/* The review card uses the same gesture over a shorter distance: stepping back is cheap and
 * reversible, so it does not need defending the way hanging up on somebody does. */
describe('the review card gesture', () => {
  const from = { x: 60, y: 400 };
  const at = (x: number, y = 400) => dragOffset(from, { x, y }, SWIPE_BACK_PX);

  it('asks for less travel than ending a call', () => {
    expect(SWIPE_BACK_PX).toBeLessThan(SWIPE_END_PX);
    expect(SWIPE_BACK_PX).toBeGreaterThanOrEqual(40);
  });

  it('arms at its own threshold, not the call button’s', () => {
    expect(swipeArmed(at(60 + SWIPE_BACK_PX)!, SWIPE_BACK_PX)).toBe(true);
    expect(swipeArmed(at(60 + SWIPE_BACK_PX - 1)!, SWIPE_BACK_PX)).toBe(false);
    // …and the same distance would not yet have ended a call.
    expect(swipeArmed(SWIPE_BACK_PX)).toBe(false);
  });

  it('still gives up when the finger goes more up than along', () => {
    expect(at(120, 520)).toBeNull();
    // …but an arc across the card is a swipe, not a scroll.
    expect(at(300, 470)).not.toBeNull();
  });

  it('clamps its overshoot to its own travel', () => {
    expect(at(9000)).toBeLessThanOrEqual(SWIPE_BACK_PX + 18);
  });
});
