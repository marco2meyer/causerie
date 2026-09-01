import { Ladder } from 'causerie-ds';
import { Cap, Surface } from './_lib/kit';

/** How the ladder reads inside a stat card — the shape it always ships in. */
export function InAStatCard() {
  return (
    <Surface width={380}>
      <div className="card">
        <Cap>Niveau global</Cap>
        <div style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 23, letterSpacing: '-.02em', margin: '6px 0 2px' }}>B1+</div>
        <Ladder idx={5} />
      </div>
    </Surface>
  );
}

/** `idx` is the LEVELS index (0 = A1 … 11 = C2+): two steps per CEFR band, so an odd
 *  index fills a rung and an even one half-fills the next. */
export function AcrossTheScale() {
  return (
    <Surface width={420}>
      {[
        [1, 'A1+'],
        [4, 'B1'],
        [7, 'B2+'],
        [11, 'C2+'],
      ].map(([idx, label]) => (
        <div key={label as string} style={{ marginBottom: 14 }}>
          <Cap>{`idx ${idx} · ${label}`}</Cap>
          <Ladder idx={idx as number} />
        </div>
      ))}
    </Surface>
  );
}
