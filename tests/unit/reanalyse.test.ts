import { describe, expect, it, vi } from 'vitest';
import type { Analysis, Memory, SessionRecord } from '../../src/types';

/** The model is the one thing a late analysis still needs from the network; everything else
 *  comes off the stored record. Faked here so the merge and the bookkeeping can be checked. */
const calls: { verbatim: string | null | undefined; topic: string }[] = [];
vi.mock('../../src/lib/analysis', async orig => ({
  ...(await orig<typeof import('../../src/lib/analysis')>()),
  runAnalysis: async (_m: Memory, sess: { topic: string }, _t: unknown, verbatim?: string | null) => {
    calls.push({ verbatim, topic: sess.topic });
    return {
      hauptpunkt: 'Il a parlé de sa chambre.', kommentar: 'Bien.',
      cefr: { overall: 'A2+', grammar: 'A2', vocabulary: 'A2+', fluency: 'A2', comprehension: 'B1', confidence: 0.6, begruendung: 'x' },
      corrections: [], highlights: [], new_vocab: [{ fr: 'la colocation', de: 'die WG', ex: 'Une colocation à six.' }],
      weaknesses: [], strengths: [], interests: [], facts: [{ text: 'Il loue une chambre.', category: 'alltag' as const }],
      targets: [], next_focus: [], topics: ['la colocation'], prune: { facts: [], interests: [] }, competencies: [],
      _model: 'gpt-5.6-sol', _usage: { input_tokens: 4000, output_tokens: 1200 }
    } as Analysis;
  }
}));

const { analysable, reanalyseSession, NO_SESSION, NOTHING_SAID } = await import('../../src/lib/reanalyse');
const { blankMem } = await import('../../src/lib/storage');

/** What app.tsx keepCall() leaves behind when a call ends and its analysis then fails. */
const kept = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: 'sess-kept', date: '2026-09-08', at: '2026-09-08T08:13:00.000Z', topic: 'La chambre libre',
  source: 'causerie', minutes: 10, seconds: 600, analysis: null,
  transcript: [
    { role: 'assistant', text: 'Alors, cette chambre ?' },
    { role: 'user', text: 'Elle est libre depuis juin, je cherche quelqu’un de calme.' }
  ],
  costs: [{ kind: 'realtime', model: 'gpt-realtime-2.1', usd: 0.42 }],
  ...over
});

const memWith = (rec: SessionRecord): Memory => {
  const m = blankMem();
  m.sessions.push(rec);
  return m;
};

describe('analysable', () => {
  it('is true for a call this app recorded, kept without an analysis', () => {
    expect(analysable(kept())).toBe(true);
  });
  it('is false once it has one, for an import, and for a call he said nothing in', () => {
    expect(analysable(kept({ analysis: { hauptpunkt: 'x' } as Analysis }))).toBe(false);
    expect(analysable(kept({ source: 'duolingo' }))).toBe(false);
    expect(analysable(kept({ transcript: [{ role: 'assistant', text: 'Allô ?' }] }))).toBe(false);
    expect(analysable(undefined)).toBe(false);
  });
});

describe('reanalyseSession', () => {
  it('fills the kept record in, days later, without moving the call', async () => {
    const mem = memWith(kept());
    const { mem: out, rec } = await reanalyseSession(mem, 'sess-kept');
    expect(out.sessions).toHaveLength(1);
    expect(rec.id).toBe('sess-kept');
    expect(rec.date).toBe('2026-09-08');                 // the day of the conversation
    expect(rec.at).toBe('2026-09-08T08:13:00.000Z');     // and its hour
    expect(rec.analysis?.hauptpunkt).toBe('Il a parlé de sa chambre.');
    expect(rec.xp).toBeGreaterThan(0);
    expect(out.vocab.map(v => v.fr)).toContain('la colocation');
    expect(out.facts[0]).toMatchObject({ text: 'Il loue une chambre.', firstSaid: '2026-09-08' });
    // The call's own legs are kept and the analysis adds its own.
    expect(rec.costs?.map(l => l.kind)).toEqual(['realtime', 'analysis']);
    expect(rec.costs?.find(l => l.kind === 'analysis')?.usd).toBeGreaterThan(0);
    // The memory handed in is never touched: the caller saves what comes back.
    expect(mem.sessions[0].analysis).toBe(null);
    expect(mem.vocab).toHaveLength(0);
  });

  it('reads the verbatim the failed attempt had already stored', async () => {
    calls.length = 0;
    const mem = memWith(kept({ verbatim: 'Elle est libre depuis juin euh je cherche quelqu’un de calme.' }));
    const { rec } = await reanalyseSession(mem, 'sess-kept');
    expect(calls[0].verbatim).toContain('euh');
    expect(rec.wpm).toBe(1);    // eleven words of his own over ten minutes, from the verbatim
  });

  it('replaces the leg of an earlier attempt rather than billing twice', async () => {
    const mem = memWith(kept({ costs: [{ kind: 'realtime', model: 'gpt-realtime-2.1', usd: 0.42 }, { kind: 'analysis', model: 'gpt-5.6-sol', usd: 0.01 }] }));
    const { rec } = await reanalyseSession(mem, 'sess-kept');
    expect(rec.costs?.filter(l => l.kind === 'analysis')).toHaveLength(1);
  });

  it('says why when there is nothing to analyse', async () => {
    await expect(reanalyseSession(memWith(kept()), 'nope')).rejects.toThrow(NO_SESSION);
    await expect(reanalyseSession(memWith(kept({ analysis: { hauptpunkt: 'x' } as Analysis })), 'sess-kept')).rejects.toThrow(NOTHING_SAID);
  });
});
