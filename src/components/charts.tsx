import type { WeaknessStatus } from '../types';
import type { Pace } from '../lib/pace';
import { BANDS } from '../lib/cefr';
import { ui } from '../lang';

export function Ladder({ idx }: { idx: number }) {
  return (
    <div>
      <div class="ladder">
        {BANDS.map((_, i) => {
          const full = idx >= i * 2 + 1;
          const half = idx === i * 2;
          return <div key={i} class={'rung ' + (full ? 'hit ' : '') + (half ? 'half' : '')} />;
        })}
      </div>
      <div class="ladder-labels">{BANDS.map(b => <span key={b}>{b}</span>)}</div>
    </div>
  );
}

export function statusLabel(s: WeaknessStatus): string {
  return ui().status[s] ?? s;
}
export function statusIcon(s: WeaknessStatus): string {
  return { new: '•', persisting: '!', improving: '↗', resolved: '✓' }[s] ?? '';
}

/** Seven days of "is the deck keeping up with itself".
 *
 *  One unit on both sides — new cards a day — because reviews and cards are different
 *  things and a chart holding one of each is decoration. The bars are the cards each day
 *  made; the line across them is what that day's reviewing can carry. Bar above line, the
 *  pile grew that day. It is drawn rather than tabulated because the shape is the answer:
 *  a week of bars poking over the line says something a weekly average rounds away. */
export function PaceChart({ pace }: { pace: Pace }) {
  const S = ui();
  const top = Math.max(1, ...pace.days.map(d => Math.max(d.added, d.carried)));
  const pc = (v: number) => Math.round((v / top) * 100);
  const w = 100 / pace.days.length;
  // The carry line as a polyline across the plot, in the same 0..100 box as the bars.
  const pts = pace.days
    .map((d, i) => `${w * (i + 0.5)},${100 - pc(d.carried)}`)
    .join(' ');
  return (
    <div class="pace">
      <div class="pace-plot">
        <svg class="pace-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={pts} vector-effect="non-scaling-stroke" />
        </svg>
        {pace.days.map(d => (
          <div key={d.date} class="pace-col" title={`${d.date} · ${S.pace.addedN(d.added)} · ${S.pace.reviewsN(d.reviews)}`}>
            <div class={'pace-bar' + (d.added > d.carried ? ' over' : '')} style={`height:${pc(d.added)}%`} />
          </div>
        ))}
      </div>
      <div class="pace-days">
        {pace.days.map(d => <span key={d.date}>{d.date.slice(8)}</span>)}
      </div>
    </div>
  );
}
