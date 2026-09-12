import type { GrammarViz } from '../types';

/** The four drawings a grammar lesson may ask for.
 *
 *  A fixed menu rather than free-form SVG from the model: whatever comes back can always be
 *  rendered, always in the app's own hand, and a diagram can never arrive broken. Each one
 *  earns its place by saying something a sentence cannot —
 *
 *    timeline  where two tenses sit relative to each other (imparfait against passé composé,
 *              the concordance des temps, si + imparfait → conditionnel)
 *    table     a paradigm worth seeing whole, with the cells that matter picked out
 *    chunks    word order as slots: ne · verbe · pas, the pronoun before the auxiliary
 *    split     a two-way contrast: être verbs against avoir verbs, du/de la against de
 *
 *  `none` is the usual answer, and the lesson is told so. A picture that only redraws the
 *  sentence under it is noise on a phone screen. */

/* Everything below reads the viz's arrays through these. The schema says every field is
   present, and it usually is — but this renders inside full-screen views, which sit OUTSIDE
   the error boundary (that is keyed on the nav shell), so one missing field would take the
   whole lesson down rather than one diagram. A drawing is never worth that. */
const list = <T,>(x: T[] | undefined | null): T[] => (Array.isArray(x) ? x : []);
const side = (x: { title: string; items: string[] } | undefined | null) =>
  ({ title: x?.title ?? '', items: list(x?.items) });

const TONE: Record<string, string> = { a: 'var(--tomato)', b: 'var(--blue)', c: 'var(--jaune)' };
const TONE_INK: Record<string, string> = { a: 'var(--cream)', b: 'var(--cream)', c: 'var(--ink)' };

function Timeline({ v, lang }: { v: GrammarViz; lang?: string }) {
  const marks = list(v.marks).slice(0, 6);
  if (!marks.length) return null;
  // The axis runs 0–10 whatever the lesson claimed; a mark outside it is clamped rather
  // than allowed to draw off the edge of the card.
  const at = (n: number) => Math.max(0, Math.min(10, n)) * 10;
  const LANE = 30;
  // Every child is absolutely positioned, so the container has no height of its own and
  // would collapse to nothing. One lane per span, plus room for the axis under them.
  const height = 6 + marks.length * LANE + 8;
  return (
    <div class="viz-time">
      <div class="viz-axis" style={{ height: height + 'px' }}>
        {marks.map((m, i) => {
          // A point mark carries its label OUTSIDE its own box, to the right, so it needs
          // room left on the axis; the frame clips, and one placed at the far end would be
          // drawn off the edge and simply never seen.
          const point = Math.max(0, m.len) * 10 < 2;
          const left = Math.min(at(m.at), point ? 60 : 100);
          const width = Math.min(100 - left, Math.max(0, m.len) * 10);
          return (
            <div key={i} class={'viz-span t-' + m.tone + (point ? ' pt' : '')}
              style={{ left: left + '%', width: Math.max(width, 2) + '%', top: 6 + i * LANE + 'px' }}>
              <span lang={lang}>{m.label}</span>
            </div>
          );
        })}
        <div class="viz-line" style={{ top: 6 + marks.length * LANE + 4 + 'px' }}></div>
      </div>
    </div>
  );
}

function Table({ v, lang }: { v: GrammarViz; lang?: string }) {
  const cols = list(v.cols).slice(0, 4);
  const rows = list(v.rows).slice(0, 8);
  if (!rows.length) return null;
  // A paradigm can arrive headerless — "je / tu / il" down the side and one column of forms
  // is a perfectly good table. Falling back to the widest row keeps those cells rather than
  // truncating every row to one because there was no header to count.
  const width = cols.length || Math.min(4, Math.max(1, ...rows.map(r => list(r.cells).length)));
  const hot = new Set(list(v.hi).map(h => String(h).replace(/\s/g, '')));
  return (
    <div class="viz-tablewrap">
      <table class="viz-table">
        {cols.length > 0 && (
          <thead><tr><th></th>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        )}
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              <th scope="row">{r.head}</th>
              {list(r.cells).slice(0, width).map((c, ci) => (
                <td key={ci} class={hot.has(ri + ',' + ci) ? 'hi' : ''} lang={lang}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chunks({ v, lang }: { v: GrammarViz; lang?: string }) {
  const slots = list(v.slots).slice(0, 5);
  if (!slots.length) return null;
  return (
    <div class="viz-chunks">
      {slots.map((s, i) => (
        <div key={i} class="viz-slot">
          <div class="viz-box" style={{ background: TONE[s.tone] ?? 'var(--sand2)', color: TONE_INK[s.tone] ?? 'var(--ink)' }} lang={lang}>{s.text}</div>
          <div class="viz-slotlab">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function Split({ v, lang }: { v: GrammarViz; lang?: string }) {
  const sides = [side(v.left), side(v.right)];
  if (!sides.every(s => s.title || s.items.length)) return null;
  return (
    <div class="viz-split">
      {sides.map((s, i) => (
        <div key={i} class={'viz-side s-' + (i === 0 ? 'a' : 'b')}>
          <div class="viz-sidet">{s.title}</div>
          <ul>{s.items.slice(0, 6).map((x, j) => <li key={j} lang={lang}>{x}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

/** Renders a viz, or nothing at all — which is the common case and must stay silent
 *  rather than leaving an empty framed box on the screen. */
export function Viz({ viz, lang }: { viz?: GrammarViz | null; lang?: string }) {
  if (!viz || viz.kind === 'none') return null;
  const body = viz.kind === 'timeline' ? <Timeline v={viz} lang={lang} />
    : viz.kind === 'table' ? <Table v={viz} lang={lang} />
      : viz.kind === 'chunks' ? <Chunks v={viz} lang={lang} />
        : viz.kind === 'split' ? <Split v={viz} lang={lang} />
          : null;
  if (!body) return null;
  return (
    <figure class="viz">
      {body}
      {viz.caption && <figcaption>{viz.caption}</figcaption>}
    </figure>
  );
}
