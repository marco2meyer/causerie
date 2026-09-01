import { Odile } from 'causerie-ds';
import { Cap, Surface } from './_lib/kit';

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 132, height: 132 }}>{children}</div>
      <span style={{ fontSize: 11.5, color: 'var(--ink3)', fontFamily: 'var(--disp)', fontWeight: 600, letterSpacing: '.06em' }}>{label}</span>
    </div>
  );
}

/** The tutor at the size the call screen uses her. */
export function OnTheCallScreen() {
  return (
    <Surface width={340}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 200, height: 200 }}><Odile state="speaking" level={0.55} /></div>
        <div style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 24, letterSpacing: '-.01em' }}>Odile</div>
        <div style={{ fontSize: 13, color: 'var(--ink3)' }}>en conversation · 04:12</div>
      </div>
    </Surface>
  );
}

/** The four states. `listening` tilts her head and lifts a brow; `thinking` looks away. */
export function States() {
  return (
    <Surface width={620}>
      <Cap>state</Cap>
      <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
        <Cell label="idle"><Odile state="idle" /></Cell>
        <Cell label="listening"><Odile state="listening" /></Cell>
        <Cell label="speaking"><Odile state="speaking" level={0.6} /></Cell>
        <Cell label="thinking"><Odile state="thinking" /></Cell>
      </div>
    </Surface>
  );
}

/** While speaking, `level` (0..1 output audio) drives the mouth. */
export function LipSync() {
  return (
    <Surface width={620}>
      <Cap>level, state="speaking"</Cap>
      <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
        {[0, 0.25, 0.6, 1].map(l => (
          <Cell key={l} label={l.toFixed(2)}><Odile state="speaking" level={l} /></Cell>
        ))}
      </div>
    </Surface>
  );
}
