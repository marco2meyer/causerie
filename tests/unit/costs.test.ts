import { describe, expect, it } from 'vitest';
import { COST_KIND_FR, costLabel, estimateCost, fmtUsd, groupCosts } from '../../src/lib/costs';
import type { CostRow } from '../../src/lib/supa';

const row = (over: Partial<CostRow>): CostRow => ({
  created_at: '2026-08-18T08:55:00+00:00', kind: 'tts', model: 'gpt-4o-mini-tts',
  cost_usd: 0.001, seconds: null, key_source: 'server', ...over
});

describe('groupCosts', () => {
  it('collapses per-clip tts rows into one line per day and keeps the call visible', () => {
    const rows: CostRow[] = [
      ...Array.from({ length: 12 }, (_, i) => row({ created_at: `2026-08-18T08:55:${String(10 + i)}+00:00` })),
      row({ kind: 'realtime', model: 'gpt-realtime-2.1', cost_usd: 0.917, seconds: 469, created_at: '2026-08-18T08:21:23+00:00' }),
      row({ kind: 'analysis', model: 'gpt-5.6-sol', cost_usd: 0.029, seconds: 44, created_at: '2026-08-18T08:26:23+00:00' })
    ];
    const g = groupCosts(rows);
    expect(g).toHaveLength(3);
    expect(g[0].kind).toBe('tts');
    expect(g[0].n).toBe(12);
    expect(g.map(x => x.kind)).toContain('realtime');
    const call = g.find(x => x.kind === 'realtime')!;
    expect(call.usd).toBeCloseTo(0.917);
    expect(call.seconds).toBe(469);
  });

  it('separates days and sorts newest first', () => {
    const g = groupCosts([
      row({ created_at: '2026-08-17T20:00:00+00:00' }),
      row({ created_at: '2026-08-18T08:00:00+00:00' })
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].day).toBe('2026-08-18');
  });

  it('labels in French with count, minutes for calls, and sensible price formats', () => {
    const call = groupCosts([row({ kind: 'realtime', model: 'gpt-realtime-2.1', cost_usd: 0.9, seconds: 469 })])[0];
    expect(costLabel(call)).toBe('appel · gpt-realtime-2.1 · 8 min');
    // 'tts' rows are no longer only card audio: the turn-by-turn engine speaks Odile
    // through the same endpoint, so the label names the thing both have in common.
    const tts = groupCosts([row({}), row({})])[0];
    expect(costLabel(tts)).toContain('voix');
    expect(costLabel(tts)).toContain('×2');
    expect(fmtUsd(0.917)).toBe('0.92 $');
    expect(fmtUsd(0.002)).toBe('0.002 $');
    expect(Object.keys(COST_KIND_FR)).toEqual(['realtime', 'analysis', 'transcribe', 'tts', 'chat', 'stt', 'image']);
  });
});


/* Token counts from the real 9.2-minute call of 19 Aug 2026 (conversation_costs row). */
const CALL_19_AUG = {
  kind: 'realtime',
  input_tokens: 81094,
  output_tokens: 2565,
  audio_input_tokens: 34264,
  audio_output_tokens: 4425
};

describe('estimateCost', () => {
  it('prices the uncached worst case at list', () => {
    expect(estimateCost({ ...CALL_19_AUG, model: 'gpt-realtime-2.1' })).toBeCloseTo(1.766, 2);
  });

  it('charges cached input at the cached rate instead of full price', () => {
    // Realtime re-sends the conversation every turn; those repeats come back as cached.
    const cached = estimateCost({
      ...CALL_19_AUG, model: 'gpt-realtime-2.1',
      cached_input_tokens: Math.round(81094 * 0.9),
      cached_audio_input_tokens: Math.round(34264 * 0.9)
    });
    expect(cached).toBeLessThan(0.6);
    expect(cached).toBeGreaterThan(0.4);
  });

  it('never counts more cached tokens than were sent', () => {
    const a = estimateCost({ ...CALL_19_AUG, model: 'gpt-realtime-2.1', cached_input_tokens: 9e9, cached_audio_input_tokens: 9e9 });
    const b = estimateCost({ ...CALL_19_AUG, model: 'gpt-realtime-2.1', cached_input_tokens: 81094, cached_audio_input_tokens: 34264 });
    expect(a).toBeCloseTo(b, 5);
  });

  it('prices the mini call model well below the standard one', () => {
    const std = estimateCost({ ...CALL_19_AUG, model: 'gpt-realtime-2.1' });
    const mini = estimateCost({ ...CALL_19_AUG, model: 'gpt-realtime-2.1-mini' });
    expect(mini).toBeLessThan(std / 3);
  });

  it('keeps a server-reported cost as authoritative', () => {
    expect(estimateCost({ ...CALL_19_AUG, model: 'gpt-realtime-2.1', cost_usd: 0.42 })).toBe(0.42);
  });
});


describe('transcription is billed per minute of audio, not per token', () => {
  it('prices gpt-transcribe from the audio duration', () => {
    // 344 s of mic audio at $0.0045/min
    expect(estimateCost({ kind: 'transcribe', model: 'gpt-transcribe', audio_seconds: 344 }))
      .toBeCloseTo(0.0258, 4);
  });

  it('ignores any token count on a per-minute model', () => {
    const withTokens = estimateCost({ model: 'gpt-transcribe', audio_seconds: 344, audio_input_tokens: 23182 });
    const without = estimateCost({ model: 'gpt-transcribe', audio_seconds: 344 });
    expect(withTokens).toBe(without);
  });

  it('prices the live captions leg higher than the post-call pass, as OpenAI does', () => {
    const live = estimateCost({ model: 'gpt-live-transcribe', audio_seconds: 344 });
    const batch = estimateCost({ model: 'gpt-transcribe', audio_seconds: 344 });
    expect(live).toBeCloseTo(0.09747, 4);
    expect(live).toBeGreaterThan(batch * 3);
  });

  it('bills the legacy fallbacks per minute too', () => {
    // Every transcriber on the price list is per-minute; the token columns OpenAI also
    // publishes for the 4o pair are a second way of quoting the same charge, and reading
    // them as the rate made a ten-minute call look like a $2 one.
    expect(estimateCost({ model: 'gpt-4o-transcribe', audio_seconds: 600 })).toBeCloseTo(0.06, 4);
    expect(estimateCost({ model: 'gpt-4o-mini-transcribe', audio_seconds: 600 })).toBeCloseTo(0.03, 4);
  });

  it('is zero when no duration was captured rather than inventing one', () => {
    expect(estimateCost({ model: 'gpt-transcribe' })).toBe(0);
  });
});
