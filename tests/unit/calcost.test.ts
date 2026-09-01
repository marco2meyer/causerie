import { describe, expect, it } from 'vitest';
import { estimateCost } from '../../src/lib/costs';
import { normalizeUsage } from '../../src/lib/analysis';

/** The four legs of the 19 Aug 19:21 call, as the ledger recorded them. The panel in the
 *  Auswertung prices the same legs client-side, so the two have to agree. */
describe('the call cost breakdown', () => {
  const legs = [
    { kind: 'realtime', model: 'gpt-realtime-2.1', entry: { audio_input_tokens: 20_000, audio_output_tokens: 3_000, input_tokens: 40_000, output_tokens: 500 } },
    { kind: 'captions', model: 'gpt-live-transcribe', entry: { audio_seconds: 355 } },
    { kind: 'verbatim', model: 'gpt-transcribe', entry: { audio_seconds: 303 } },
    { kind: 'verbatim', model: 'gpt-transcribe', entry: { audio_seconds: 56 } }
  ];

  it('prices each leg and they add up', () => {
    const priced = legs.map(l => estimateCost({ model: l.model, ...l.entry }));
    expect(priced.every(n => n > 0)).toBe(true);
    expect(priced[1]).toBeCloseTo(0.1006, 4);   // 355 s at $0.017/min
    expect(priced[2] + priced[3]).toBeCloseTo(0.0269, 4); // both segments at $0.0045/min
    const total = priced.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(priced[0]);
  });

  it('makes the captions leg cost about four times the verbatim one', () => {
    // The whole reason for moving the live leg off gpt-live-transcribe.
    const cap = estimateCost({ model: 'gpt-live-transcribe', audio_seconds: 600 });
    const verb = estimateCost({ model: 'gpt-transcribe', audio_seconds: 600 });
    expect(cap / verb).toBeCloseTo(3.78, 1);
  });

  it('books nothing when a leg reports no usage, rather than a zero row', () => {
    expect(estimateCost({ model: 'gpt-transcribe' })).toBe(0);
    expect(estimateCost({ model: 'gpt-realtime-2.1' })).toBe(0);
  });
});

describe('the analysis leg', () => {
  it('speaks the price table\'s dialect, not the chat API\'s', () => {
    // Chat Completions says prompt_tokens/completion_tokens; the table reads
    // input_tokens/output_tokens. Without the translation every term priced to zero and the
    // whole Analyse row vanished from the breakdown.
    const u = normalizeUsage({
      prompt_tokens: 12_000, completion_tokens: 2_600, total_tokens: 14_600,
      prompt_tokens_details: { cached_tokens: 4_000 }
    });
    expect(u).toEqual({ input_tokens: 12_000, output_tokens: 2_600, cached_input_tokens: 4_000 });
    expect(estimateCost({ model: 'gpt-5.6-sol', ...u })).toBeGreaterThan(0.01);
  });

  it('prices the text models at the published rate, to the cent', () => {
    // A "greater than zero" assertion let the whole gpt-5.6 family sit at exactly half the
    // published rate for weeks: every analysis leg, on every call, read half its real cost.
    // These pin the rate itself, so the next drift is a failing test rather than a quiet
    // discount. Short-context tier, developers.openai.com/api/docs/pricing.
    const M = { input_tokens: 1e6, output_tokens: 0, cached_input_tokens: 0 };
    const out = { input_tokens: 0, output_tokens: 1e6, cached_input_tokens: 0 };
    expect(estimateCost({ model: 'gpt-5.6-sol', ...M })).toBeCloseTo(5, 2);
    expect(estimateCost({ model: 'gpt-5.6-sol', ...out })).toBeCloseTo(30, 2);
    expect(estimateCost({ model: 'gpt-5.6-terra', ...M })).toBeCloseTo(2, 2);
    expect(estimateCost({ model: 'gpt-5.6-terra', ...out })).toBeCloseTo(12, 2);
    expect(estimateCost({ model: 'gpt-5.6-luna', ...M })).toBeCloseTo(0.2, 2);
    // A cached prefix bills at a tenth — which is what makes the turn engine's repeated
    // briefing affordable in the first place.
    expect(estimateCost({ model: 'gpt-5.6-terra', input_tokens: 1e6, cached_input_tokens: 1e6, output_tokens: 0 })).toBeCloseTo(0.2, 2);
  });

  it('passes through usage that already speaks it', () => {
    expect(normalizeUsage({ input_tokens: 5, output_tokens: 7 }))
      .toEqual({ input_tokens: 5, output_tokens: 7, cached_input_tokens: 0 });
  });

  it('treats a missing or malformed report as no usage rather than NaN', () => {
    expect(normalizeUsage(undefined)).toEqual({ input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 });
    expect(normalizeUsage({ prompt_tokens: 'lots' })).toEqual({ input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 });
  });
});
