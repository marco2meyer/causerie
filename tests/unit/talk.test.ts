import { describe, expect, it } from 'vitest';
import { recentTutorShare, TALK_HIGH, talkVerdict, tutorShare } from '../../src/lib/talk';
import { buildTutorPrompt } from '../../src/lib/prompts';
import { blankMem } from '../../src/lib/storage';
import { pack } from '../../src/lang';
import type { Memory, SessionRecord, TranscriptItem } from '../../src/types';

/* Ten real calls, measured: Odile produced 69% of the words — 3,477 to the student's
 * 1,540 — and nothing in the app could see it. An eight-minute call at that rate buys
 * about two and a half minutes of speaking practice. This is the instrument that makes
 * the problem visible, and the loop that tells her about it. */

const turn = (role: 'user' | 'assistant', n: number): TranscriptItem =>
  ({ role, text: Array.from({ length: n }, (_, i) => 'mot' + i).join(' ') });

const call = (herWords: number, hisWords: number): TranscriptItem[] =>
  [turn('assistant', herWords), turn('user', hisWords)];

describe('who did the talking', () => {
  it('is her share of the words, not of the turns', () => {
    // One long turn each: turn-counting would call this balanced, which is the illusion.
    expect(tutorShare(call(300, 100))).toBeCloseTo(0.75, 2);
    expect(tutorShare(call(100, 300))).toBeCloseTo(0.25, 2);
  });

  it('reproduces the number measured on the real calls', () => {
    expect(tutorShare(call(3477, 1540))).toBeCloseTo(0.69, 2);
  });

  it('says nothing about a call too short to have a rhythm', () => {
    expect(tutorShare(call(30, 20))).toBeNull();
    expect(tutorShare([])).toBeNull();
    expect(tutorShare(undefined)).toBeNull();
  });

  it('grades the share the way a teacher would', () => {
    expect(talkVerdict(0.40)).toBe('good');     // she may take a bit less than half
    expect(talkVerdict(0.50)).toBe('high');
    expect(talkVerdict(0.69)).toBe('hogging');  // what the real calls were doing
  });
});

const sess = (share: number): SessionRecord =>
  ({ id: 's', date: '2026-08-20', topic: 't', source: 'causerie', minutes: 8, tutorShare: share });

describe('the tendency, not the call', () => {
  it('needs more than one call before it calls anything a habit', () => {
    const m = blankMem();
    m.sessions = [sess(0.8)];
    expect(recentTutorShare(m)).toBeNull();
  });

  it('averages the recent calls', () => {
    const m = blankMem();
    m.sessions = [sess(0.3), sess(0.7), sess(0.7), sess(0.7)];
    expect(recentTutorShare(m)).toBeCloseTo(0.6, 2);
  });

  it('falls back to measuring an older session that was never scored', () => {
    const m = blankMem();
    m.sessions = [
      { id: 'a', date: '2026-08-19', topic: 't', source: 'causerie', minutes: 8, transcript: call(300, 100) },
      { id: 'b', date: '2026-08-20', topic: 't', source: 'causerie', minutes: 8, transcript: call(300, 100) }
    ];
    expect(recentTutorShare(m)).toBeCloseTo(0.75, 2);
  });
});

describe('the loop back into the briefing', () => {
  const hogging = (): Memory => {
    const m = blankMem();
    m.introDone = true;
    m.sessions = [sess(0.69), sess(0.7), sess(0.66), sess(0.72)];
    return m;
  };

  it('tells her the actual number when she has been taking the room', () => {
    const brief = buildTutorPrompt(hogging(), { topic: 'le marché', targets: [] });
    expect(brief).toContain(pack('fr').tutor.talkHog(69).split('\n')[0]);
    expect(brief).toMatch(/69 %/);
  });

  it('says nothing at all once the ratio is healthy', () => {
    const m = blankMem();
    m.introDone = true;
    m.sessions = [sess(0.4), sess(0.38), sess(0.42), sess(0.35)];
    const brief = buildTutorPrompt(m, { topic: 'le marché', targets: [] });
    // A standing rule nobody is breaking is noise in a two-thousand-word prompt.
    expect(brief).not.toContain(pack('fr').tutor.talkHog(40).split('\n')[0]);
  });

  it('holds off until the share is genuinely high, not merely over target', () => {
    const m = blankMem();
    m.introDone = true;
    m.sessions = [sess(0.5), sess(0.5), sess(0.5), sess(0.5)];
    expect(recentTutorShare(m)!).toBeLessThanOrEqual(TALK_HIGH);
    expect(buildTutorPrompt(m, { topic: 'x', targets: [] }))
      .not.toContain(pack('fr').tutor.talkHog(50).split('\n')[0]);
  });
});

describe('the briefing itself', () => {
  it('puts the microphone rule before the others, in every language', () => {
    const m = blankMem();
    m.introDone = true;
    for (const code of ['fr', 'es', 'it', 'pt', 'en'] as const) {
      const t = pack(code).tutor.template;
      // The rule that decides who talks has to come before the rules about how.
      const mic = t.search(/micro|microfone|microfono|micrófono/i);
      expect(mic, `${code} has no microphone rule`).toBeGreaterThan(-1);
      expect(mic, `${code} buries the microphone rule`).toBeLessThan(t.length / 2);
      // …and the elicit-before-recast order, which is what stops every turn being an echo.
      expect(t).toMatch(/1\./);
    }
  });
});
