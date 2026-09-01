import { HistoryChart } from 'causerie-ds';
import { Cap, Surface } from './_lib/kit';

// The chart reads mem.cefr.history only — a realistic six-month climb from A2 to B1+,
// with the source each reading came from.
const history = [
  { date: '2026-02-14', overall: 2, source: 'call' },
  { date: '2026-03-02', overall: 3, source: 'call' },
  { date: '2026-03-28', overall: 3, source: 'review' },
  { date: '2026-04-19', overall: 4, source: 'call' },
  { date: '2026-05-11', overall: 4, source: 'call' },
  { date: '2026-06-07', overall: 5, source: 'checkin' },
  { date: '2026-07-02', overall: 5, source: 'call' },
  { date: '2026-08-01', overall: 6, source: 'call' },
];

const mem = { cefr: { overall: 6, history } } as any;

/** The level curve as it appears in the memory view. */
export function SixMonths() {
  return (
    <Surface width={640}>
      <div className="card">
        <Cap>Progression du niveau</Cap>
        <HistoryChart mem={mem} />
      </div>
    </Surface>
  );
}

/** Below two readings there is no curve to draw, so it says so instead. */
export function NotEnoughData() {
  return (
    <Surface width={640}>
      <div className="card">
        <Cap>Progression du niveau</Cap>
        <HistoryChart mem={{ cefr: { overall: 2, history: [{ date: '2026-08-01', overall: 2 }] } } as any} />
      </div>
    </Surface>
  );
}
