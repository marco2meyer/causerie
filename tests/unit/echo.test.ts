import { describe, expect, it } from 'vitest';
import { looksLikeEcho } from '../../src/lib/echo';
import { hardenedInput } from '../../src/lib/realtime';

/* Every "student" line here is one this app really recorded, off a phone on speaker: the
 * tutor's own words, coming back through the microphone and filed as the learner's French.
 * (Call of 28 August 2026.) */
const HERS = [
  'Marco. Aujourd’hui, tu dis ce que tu ferais si ton contrat finit',
  'On parle de ce que tu ferais si ton contrat finit, puis de ce que tu conseillerais à un ami',
  'Ça te va, ou tu préfères parler d’autre chose aujourd’hui ?'
];

describe('looksLikeEcho', () => {
  it('catches the loudspeaker coming back', () => {
    expect(looksLikeEcho('Marco.', HERS)).toBe(true);
    expect(looksLikeEcho('On parle.', HERS)).toBe(true);
    expect(looksLikeEcho('tu ferais si ton contrat finit', HERS)).toBe(true);
    expect(looksLikeEcho('Ça te va', HERS)).toBe(true);
  });

  it('leaves the student alone', () => {
    expect(looksLikeEcho('Je n’ai pas compris ce que tu dis. Est-ce que tu peux le répéter ?', HERS)).toBe(false);
    expect(looksLikeEcho('Oui, ça me va très bien, on peut commencer', HERS)).toBe(false);
    expect(looksLikeEcho('mon contrat finit en mai et je ne sais pas encore', HERS)).toBe(false);
  });

  /* A learner repeating a word she just used is the recast doing its job. It is only ever
   * treated as echo when it arrived ON TOP of her — see the caller, which will not even ask
   * unless the speech began while her audio was playing. */
  it('will not be fooled by a single small word', () => {
    expect(looksLikeEcho('Ça', HERS)).toBe(false);
    expect(looksLikeEcho('va', HERS)).toBe(false);
  });

  it('needs her words, not merely similar ones', () => {
    expect(looksLikeEcho('tu dis ce que je ferais', HERS)).toBe(false);   // wrong pronoun
    expect(looksLikeEcho('contrat ton si', HERS)).toBe(false);            // wrong order
  });

  it('stops calling a whole paragraph an echo', () => {
    const long = 'Marco Aujourd’hui tu dis ce que tu ferais si ton contrat finit et ensuite tu donnes un conseil';
    expect(looksLikeEcho(long, HERS)).toBe(false);
  });

  it('says no when she has not said anything yet', () => {
    expect(looksLikeEcho('Marco.', [])).toBe(false);
  });
});

/* What the call switches to once it has heard itself. */
describe('hardenedInput', () => {
  const mem = { settings: { eagerness: 'low' } } as never;

  it('keeps the student able to cut in on her, which is the point of this engine', () => {
    const td = (hardenedInput(mem).audio as never as Record<string, Record<string, Record<string, unknown>>>)
      .input.turn_detection;
    expect(td.interrupt_response).toBe(true);
    expect(td.create_response).toBe(true);
  });

  it('swaps the detector that has no loudness threshold for the one that has', () => {
    const input = (hardenedInput(mem).audio as never as Record<string, Record<string, Record<string, unknown>>>).input;
    // semantic_vad decides somebody is talking by understanding them — which an echo is.
    expect(input.turn_detection.type).toBe('server_vad');
    expect(Number(input.turn_detection.threshold)).toBeGreaterThan(0.5);
    expect(input.noise_reduction).toEqual({ type: 'far_field' });
  });

  it('changes only the microphone, so the call keeps its cached briefing', () => {
    // The full session object is frozen for the life of a call because the realtime cache
    // keys on the instructions prefix; a rebuilt one would re-bill every remaining turn.
    // `type` rides along because the GA API refuses any session.update without it —
    // "Missing required parameter: 'session.type'", on screen, mid-call.
    expect(Object.keys(hardenedInput(mem))).toEqual(['type', 'audio']);
    expect(hardenedInput(mem).type).toBe('realtime');
    expect(Object.keys(hardenedInput(mem).audio as object)).toEqual(['input']);
  });

  it('still waits as long as the learner’s patience setting asks', () => {
    const slow = { settings: { eagerness: 'low' } } as never;
    const quick = { settings: { eagerness: 'high' } } as never;
    const ms = (m: never) => ((hardenedInput(m).audio as never as Record<string, Record<string, Record<string, number>>>)
      .input.turn_detection.silence_duration_ms);
    expect(ms(slow)).toBeGreaterThan(ms(quick));
  });
});
