import { SpeakBtn } from 'causerie-ds';
import { Cap, Surface } from './_lib/kit';

/** Where it lives: on the front of a card, next to the word it reads aloud. */
export function OnACard() {
  return (
    <Surface width={420}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--disp)', fontWeight: 600, fontSize: 22, letterSpacing: '-.01em' }}>la pluie</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 2 }}>der Regen</div>
          </div>
          <SpeakBtn text="la pluie" title="Écouter" />
        </div>
      </div>
    </Surface>
  );
}

/** `cls` picks the shell. The app uses two: the default `speakbtn` on a review card,
 *  and `speakbtn sm` in the tighter rows of the card list. */
export function Shells() {
  return (
    <Surface width={420}>
      <Cap>cls</Cap>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 12 }}>
        {[
          ['speakbtn', 'speakbtn (default)'],
          ['speakbtn sm', 'speakbtn sm'],
        ].map(([cls, label]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <SpeakBtn text="bonjour" cls={cls} title="Écouter" />
            <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{label}</span>
          </div>
        ))}
      </div>
    </Surface>
  );
}

/** In a card-list row, where `speakbtn sm` sits at the end of the line. */
export function InACardRow() {
  return (
    <Surface width={430}>
      {[
        ['le brouillard', 'der Nebel'],
        ['s’inquiéter', 'sich sorgen'],
      ].map(([front, back]) => (
        <div key={front} className="card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.5 }}>{front}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{back}</div>
          </div>
          <SpeakBtn text={front} cls="speakbtn sm" title="Écouter" />
        </div>
      ))}
    </Surface>
  );
}
