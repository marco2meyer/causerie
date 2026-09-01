import { useEffect, useState } from 'preact/hooks';
import type { SessionRecord } from '../types';
import { xpPartsOf, xpShare } from '../lib/gamify';
import { talkVerdict } from '../lib/talk';
import { fmtDay } from '../lib/utils';
import { Odile } from '../components/Avatar';
import { ui } from '../lang';

/** Counts up to `target` once — the reward beat, and the only place in the app that keeps
 *  a number for its own sake. Instant when there is nothing to celebrate. */
function useCountUp(target: number, on: boolean): number {
  const [n, setN] = useState(on ? 0 : target);
  useEffect(() => {
    if (!on || target <= 0) { setN(target); return; }
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / 900);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, on]);
  return n;
}

/** What the call was worth, on its own screen and before anything is asked of you: the XP
 *  with the arithmetic that produced it, how much you said, and how fast. Every term is
 *  named and priced ("9 min +90"), because an unlabelled number gets read as a grade —
 *  which it is not. Dismissing it opens the review proper. */
export function CallStats({ sess, words, onDone }: { sess: SessionRecord; words: number; onDone: () => void }) {
  const S = ui();
  const gained = sess.xp ?? 0;
  const parts = xpPartsOf(sess);
  const share = xpShare(parts);
  const shown = useCountUp(gained, true);
  // Praise and corrections earn too, but they are not itemised: counting how many things
  // Odile praised or fixed is exactly what got read as a grade before.
  const chips = [
    { n: parts.minutes, label: S.common.min, xp: share.minutes },
    { n: parts.targets, label: S.review.dayTargets, xp: share.targets },
    // Words the call asked for and got. This one IS itemised: unlike praise and
    // corrections it counts something the learner set out to do on purpose.
    { n: parts.words, label: S.review.wordsPlaced, xp: share.words }
  ].filter(c => c.n > 0 && c.xp > 0);

  return (
    <div class="rev-stage fadein">
      <div style="position:relative;height:236px;flex-shrink:0;background:var(--blue);border-radius:var(--r);overflow:hidden">
        <div style="position:absolute;left:50%;transform:translateX(-50%);bottom:-22px;width:200px;height:200px"><Odile state="idle" /></div>
      </div>

      <div style="margin-top:20px">
        <div class="kicker">{S.review.callOf(sess.minutes ?? 0, fmtDay(sess.date))}</div>
        <div class="row" style="gap:8px;align-items:baseline;margin-top:6px">
          <span style="font-family:var(--disp);font-size:52px;font-weight:800;line-height:1;letter-spacing:-.03em">+{shown}</span>
          <span style="font-size:15px;font-weight:800;letter-spacing:.1em;color:var(--ink3)">XP</span>
        </div>
        {chips.length > 0 && (
          <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:12px">
            {chips.map(c => (
              <span key={c.label} class="chip sm">{c.n} {c.label} <b style="color:var(--tomato)">+{c.xp}</b></span>
            ))}
          </div>
        )}
      </div>

      <div class="stats" style="margin-top:16px">
        <div class="stat"><div class="v">{words}</div><div class="l">{S.review.yourWords}</div></div>
        {sess.wpm ? <div class="stat"><div class="v">{sess.wpm}</div><div class="l">{S.flu.wpm}</div></div> : null}
        {/* How much of the call was YOURS. A conversation lesson where the tutor does most
            of the talking is the commonest way for one to fail, and it is invisible from
            the inside — so it gets a number next to the others, and the number is the
            student's share rather than hers, because that is the one to grow. The number
            says it on its own — a sentence underneath explaining that it was her fault was
            an apology on a screen that is meant to be a reward. */}
        {typeof sess.tutorShare === 'number' && (
          <div class="stat">
            <div class="v" style={'color:' + (talkVerdict(sess.tutorShare) === 'good' ? 'var(--ink)' : 'var(--tomato-deep)')}>
              {Math.round((1 - sess.tutorShare) * 100)}%
            </div>
            <div class="l">{S.review.yourShare}</div>
          </div>
        )}
      </div>

      <div class="rev-actions" style="margin-top:auto">
        <button class="cta solo" onClick={onDone}>{S.review.continue}</button>
      </div>
    </div>
  );
}
