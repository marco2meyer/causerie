import { describe, expect, it } from 'vitest';
import { sessionObject, SILENCE_MS, VERBATIM_HINT, verbatimHint } from '../../src/lib/realtime';
import { buildAnalysisMessages } from '../../src/lib/analysis';
import { seedMem } from '../../src/lib/seed';
import { migrate, blankMem } from '../../src/lib/storage';
import { PREFS_REV } from '../../src/types';

const sess = { topic: 'x', targets: [] };

describe('realtime session shape (verified live against client_secrets)', () => {
  it('steers live transcription to verbatim learner speech', () => {
    const o = sessionObject(seedMem('M'), sess, false) as any;
    // VERBATIM_HINT is the template; the session fills in the learner's own language.
    expect(o.audio.input.transcription.prompt).toBe(verbatimHint('French', 'German'));
    expect(VERBATIM_HINT).toContain('Never correct');
  });

  it('uses gpt-transcribe by default, with a working legacy override', () => {
    // Not the streaming transcriber: it costs 3.8x as much ($0.017/min against $0.0045),
    // and nothing shows the student their own captions while the call is running, so the
    // only thing the streaming buys is a bigger bill.
    const m = seedMem('M');
    expect((sessionObject(m, sess, false) as any).audio.input.transcription.model).toBe('gpt-transcribe');
    expect((sessionObject(m, sess, false, 'gpt-4o-transcribe') as any).audio.input.transcription.model).toBe('gpt-4o-transcribe');
    m.settings.transcribeModel = 'gpt-4o-transcribe';
    expect((sessionObject(m, sess, false) as any).audio.input.transcription.model).toBe('gpt-4o-transcribe');
  });

  it('ships the end_call tool so Odile hangs up after the goodbyes', () => {
    const o = sessionObject(seedMem('M'), sess, false) as any;
    expect(o.tools).toHaveLength(1);
    expect(o.tools[0].name).toBe('end_call');
    expect(o.tools[0].description).toContain('goodbye');
    expect(o.tool_choice).toBe('auto');
    // and the briefing tells her to use it
    expect(o.instructions).toContain('end_call');
  });

  it('defaults to semantic VAD with near-field noise reduction', () => {
    const o = sessionObject(seedMem('M'), sess, false) as any;
    expect(o.audio.input.turn_detection.type).toBe('semantic_vad');
    expect(o.audio.input.noise_reduction).toEqual({ type: 'near_field' });
  });

  it('keeps patience live in noisy mode too — the two settings are orthogonal', () => {
    // Regression: the ternary used to pin its own 700 ms window in noisy mode, so for anyone
    // with "loud environment" on, the patience setting wrote a value nothing ever read.
    const m = seedMem('M');
    m.settings.noisyEnv = true;
    const win = (e: 'low' | 'auto' | 'high') => {
      m.settings.eagerness = e;
      return (sessionObject(m, sess, false) as any).audio.input.turn_detection.silence_duration_ms;
    };
    expect(win('low')).toBe(2000);
    expect(win('auto')).toBe(1200);
    expect(win('high')).toBe(700);
    expect(win('low')).toBeGreaterThan(win('high'));
  });

  it('names the learner\'s own language to the transcriber', () => {
    const m = seedMem('M');
    m.profile.native = 'de';
    const p = (sessionObject(m, sess, false) as any).audio.input.transcription.prompt as string;
    expect(p).toContain('German');
    expect(p).toContain('never substitute a similar-sounding French word');
  });

  it('hints the languages a learner actually uses, and never the singular field', () => {
    // These models take `languages` (a list). The old code sent `language: "fr"`, which is
    // not a field they have: told to expect only French, a recogniser renders an English
    // word the learner reached for as the nearest French sound-alike ("claim" -> "lame").
    const m = seedMem('M');
    m.profile.target = 'fr';
    m.profile.native = 'de';
    const t = (sessionObject(m, sess, false) as any).audio.input.transcription;
    expect(t.languages).toEqual(['fr', 'de', 'en']);
    expect(t.language).toBeUndefined();
  });

  it('does not repeat a language when the learner is a native English speaker', () => {
    const m = seedMem('M');
    m.profile.target = 'es';
    m.profile.native = 'en';
    expect((sessionObject(m, sess, false) as any).audio.input.transcription.languages).toEqual(['es', 'en']);
  });

  it('can drop the language hints, so a mint that refuses them still connects', () => {
    const t = (sessionObject(seedMem('M'), sess, false, undefined, true) as any).audio.input.transcription;
    expect(t.languages).toBeUndefined();
    expect(t.model).toBe('gpt-transcribe');
    expect(t.prompt).toContain('Never correct');
  });

  it('moves a stored gpt-live-transcribe to the cheaper model exactly once', () => {
    const old = blankMem() as any;
    delete old.prefsRev;
    old.settings.transcribeModel = 'gpt-live-transcribe';
    const m = migrate(old)!;
    expect(m.settings.transcribeModel).toBe('gpt-transcribe');
    // and picking the streaming one back on purpose has to stick
    const chosen = { ...m, settings: { ...m.settings, transcribeModel: 'gpt-live-transcribe' } } as any;
    expect(migrate(chosen)!.settings.transcribeModel).toBe('gpt-live-transcribe');
  });

  it('defaults to the patient eagerness so a word search does not end the turn', () => {
    const o = sessionObject(seedMem('M'), sess, false) as any;
    expect(o.audio.input.turn_detection.eagerness).toBe('low');
  });

  it('respects an explicit eagerness choice', () => {
    const m = seedMem('M');
    m.settings.eagerness = 'high';
    expect((sessionObject(m, sess, false) as any).audio.input.turn_detection.eagerness).toBe('high');
  });

  it('migrates the old auto eagerness to the patient default exactly once', () => {
    const old = blankMem() as any;
    delete old.prefsRev;                 // stored before the patience change
    old.settings.eagerness = 'auto';
    const m = migrate(old)!;
    expect(m.settings.eagerness).toBe('low');
    // …and once migrated, choosing the middle setting on purpose has to stick: migrate()
    // is the read path, so a coercion without the prefsRev guard would run on every load.
    const chosen = { ...m, settings: { ...m.settings, eagerness: 'auto' } } as any;
    expect(migrate(chosen)!.settings.eagerness).toBe('auto');
  });

  it('respects an explicit patience choice through a migration', () => {
    const explicit = blankMem() as any;
    delete explicit.prefsRev;
    explicit.settings.eagerness = 'high';
    expect(migrate(explicit)!.settings.eagerness).toBe('high');
  });

  it('switches to strict server VAD in noisy mode and honors far/off', () => {
    const m = seedMem('M');
    m.settings.noisyEnv = true;
    m.settings.noiseReduction = 'far';
    const o = sessionObject(m, sess, false) as any;
    // 1.4 s, not the stock 0.5 s: a learner pausing to find a word must not end the turn.
    // Window comes from the patience setting, not from the noisy-mode branch (default: low).
    expect(o.audio.input.turn_detection).toMatchObject({ type: 'server_vad', threshold: 0.8, silence_duration_ms: 2000 });
    expect(o.audio.input.noise_reduction).toEqual({ type: 'far_field' });
    m.settings.noiseReduction = 'off';
    expect((sessionObject(m, sess, false) as any).audio.input.noise_reduction).toBeUndefined();
  });

  it('older stored memories get the new audio defaults via migrate', () => {
    const old = blankMem() as any;
    delete old.settings.noiseReduction;
    delete old.settings.noisyEnv;
    delete old.settings.verbatim;
    const m = migrate(old)!;
    expect(m.settings.noiseReduction).toBe('near');
    expect(m.settings.verbatim).toBe(true);
    expect(m.settings.noisyEnv).toBe(false);
  });
});

describe('analysis with verbatim ground truth', () => {
  const m = seedMem('Marco');
  const transcript = [
    { role: 'assistant' as const, text: 'Salut.' },
    { role: 'user' as const, text: 'Je me promène chaque jour.' } // ASR-cleaned version
  ];

  it('includes the verbatim block and instructs judging errors from it', () => {
    const msgs = buildAnalysisMessages(m, sess, transcript, 'je promène chaque jour euh… wie sagt man');
    expect(msgs[1].content).toContain('VERBATIM RE-TRANSCRIPTION');
    expect(msgs[1].content).toContain('wie sagt man');
    expect(msgs[0].content).toContain('PRIMARILY from that verbatim text');
    expect(msgs[0].content).toContain('silently CORRECTS learner errors');
  });

  it('still warns about ASR cleanup and noise without a verbatim pass', () => {
    const msgs = buildAnalysisMessages(m, sess, transcript);
    expect(msgs[1].content).not.toContain('VERBATIM RE-TRANSCRIPTION');
    expect(msgs[0].content).toContain('treat it as approximate');
    expect(msgs[0].content).toContain('hallucinated turns');
  });
});

/* The Settings pills and the API disagree about direction: OpenAI's `eagerness` measures how
 * keen the model is to interrupt, so the most patient choice is the LOWEST eagerness. The
 * pills used to pair the "patience: high" label with eagerness 'high', i.e. the shortest
 * wait under the most patient-sounding label. */
describe('patience pills point the right way', () => {
  it('maps the most patient label to the longest wait', async () => {
    const { PATIENCE } = await import('../../src/views/Settings');
    const [mostPatient, middle, leastPatient] = PATIENCE;
    expect(mostPatient[1]).toBe('patienceHigh');
    expect(leastPatient[1]).toBe('patienceLow');
    expect(SILENCE_MS[mostPatient[0]]).toBeGreaterThan(SILENCE_MS[leastPatient[0]]);
    expect(SILENCE_MS[middle[0]]).toBeLessThan(SILENCE_MS[mostPatient[0]]);
    // and the semantic path agrees: "patience high" must be the eagerness the API calls low
    expect(mostPatient[0]).toBe('low');
  });
});

/* A profile pulled from the server used to skip migrate() entirely, so a device still on an
 * older build could hand back superseded defaults and the receiving device would save them
 * straight back. That is how "listening patience" stayed on the old 'auto' after the
 * migration shipped. */
describe('sync pull runs migrations', () => {
  it('migrates a remote blob written by an older build', async () => {
    const { migrate } = await import('../../src/lib/storage');
    const remote = blankMem() as any;
    delete remote.prefsRev;
    remote.settings.eagerness = 'auto';
    const m = migrate(remote)!;
    expect(m.settings.eagerness).toBe('low');
    expect(m.prefsRev).toBe(PREFS_REV);
  });
});
