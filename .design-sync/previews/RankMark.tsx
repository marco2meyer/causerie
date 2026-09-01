import { RankMark } from 'causerie-ds';
import { Cap, Surface } from './_lib/kit';

/** The badge at the size it is actually used: next to a name in a list row. */
export function InAList() {
  return (
    <Surface width={320}>
      {[
        { name: 'Camille', level: 3 },
        { name: 'Jonas', level: 7 },
        { name: 'Amaia', level: 12 },
      ].map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
          <span style={{ color: 'var(--rose)', display: 'flex' }}><RankMark level={p.level} /></span>
          <span style={{ flex: 1, fontSize: 15 }}>{p.name}</span>
          <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>rang {p.level}</span>
        </div>
      ))}
    </Surface>
  );
}

/** All twelve ranks: one bar per rank to nine, then the envelope opens. */
export function TheTwelveRanks() {
  return (
    <Surface width={470}>
      <Cap>Rang 1 → 12</Cap>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginTop: 12 }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(l => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--rose)', display: 'flex' }}><RankMark level={l} size={30} /></span>
            <span style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'var(--disp)', fontWeight: 600 }}>{l}</span>
          </div>
        ))}
      </div>
    </Surface>
  );
}

/** It is a currentColor mark, so it takes the tone of whatever it sits in. */
export function Tones() {
  const tones: [string, string][] = [
    ['--rose', 'rose'],
    ['--blue', 'blue'],
    ['--teal', 'teal'],
    ['--amber', 'amber'],
    ['--ink2', 'ink2'],
  ];
  return (
    <Surface>
      <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end' }}>
        {tones.map(([v, label]) => (
          <div key={v} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ color: `var(${v})`, display: 'flex' }}><RankMark level={9} size={38} /></span>
            <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{label}</span>
          </div>
        ))}
      </div>
    </Surface>
  );
}
