import { describe, expect, it } from 'vitest';
import { blankMem } from '../../src/lib/storage';
import { suggestTopics, REPEAT_WINDOW } from '../../src/lib/topics';
import {
  cacheKey, MAX_FAMILIAR, shapeProposals, topicContext, topicSystemPrompt,
  type TopicGenProposal
} from '../../src/lib/topicgen';
import { buildTutorPrompt } from '../../src/lib/prompts';
import type { Memory } from '../../src/types';

const call = (topic: string, i: number) => ({
  id: 's' + i, date: '2026-08-' + String((i % 28) + 1).padStart(2, '0'),
  topic, source: 'causerie' as const, minutes: 8
});

const prop = (title: string, kind: 'fresh' | 'familiar'): TopicGenProposal =>
  ({ title, phrase: 'parle de ' + title, tags: ['a', 'b'], hook: 'weil du …', kind });

describe('the proposal mix', () => {
  it('lets at most two of the six sit inside something the learner already likes', () => {
    // The complaint this exists to answer: the app kept circling four stored interests.
    const raw = [
      prop('A', 'familiar'), prop('B', 'familiar'), prop('C', 'familiar'),
      prop('D', 'fresh'), prop('E', 'fresh'), prop('F', 'fresh')
    ];
    const out = shapeProposals(raw, []);
    expect(out.filter(p => p.kind === 'familiar')).toHaveLength(MAX_FAMILIAR);
    expect(out.filter(p => p.kind === 'fresh')).toHaveLength(3);
  });

  it('leads with new ground and keeps a familiar one within reach', () => {
    const raw = [prop('A', 'familiar'), prop('D', 'fresh'), prop('E', 'fresh'), prop('F', 'fresh')];
    expect(shapeProposals(raw, []).map(p => p.kind)).toEqual(['fresh', 'fresh', 'familiar', 'fresh']);
  });

  it('drops anything already talked about instead of trusting the model not to repeat', () => {
    const raw = [prop('Les grands arbres', 'fresh'), prop('L’apiculture', 'fresh')];
    // Accent- and case-insensitive, same as everywhere else in the app.
    expect(shapeProposals(raw, ['les grands ARBRES']).map(p => p.title)).toEqual(['L’apiculture']);
  });

  it('survives a model that returns nothing usable', () => {
    expect(shapeProposals([], [])).toEqual([]);
    expect(shapeProposals([{ title: '', phrase: '', tags: [], hook: '', kind: 'fresh' }], [])).toEqual([]);
  });
});

describe('what the chooser is told', () => {
  const loaded = (): Memory => {
    const m = blankMem();
    m.interests = [{ label: 'Les promenades', weight: 3, lastSeen: '2026-08-01' }];
    m.facts = [{ id: 'f1', text: 'Travaille dans une université', category: 'arbeit', firstSaid: '2026-08-01', lastSaid: '2026-08-01' }];
    m.vocab = [{ fr: 'le quai', de: 'der Bahnsteig', ex: '' }] as Memory['vocab'];
    m.sessions = Array.from({ length: 30 }, (_, i) => call('sujet ' + i, i)) as Memory['sessions'];
    return m;
  };

  it('remembers far more than the last two calls', () => {
    const ctx = topicContext(loaded());
    expect((ctx.recent_topics as string[]).length).toBe(25);
    expect(ctx.recent_topics).toContain('sujet 29');
  });

  it('passes what the learner already has, so the new words can be new', () => {
    const ctx = topicContext(loaded());
    expect(ctx.known_vocab).toContain('le quai');
    expect(ctx.facts).toContain('Travaille dans une université');
    expect(ctx.interests).toContain('Les promenades');
  });

  it('tells the model to use the facts for the angle, not for the subject', () => {
    const sys = topicSystemPrompt('French', 'German', 'A2');
    expect(sys).toContain('HOW to come at a subject, never WHICH subject');
    expect(sys).toMatch(/At most 2 proposals may sit inside a stored interest/);
    expect(sys).toContain('German');   // the hook is written in the learner's own language
  });
});

describe('when the set is regenerated', () => {
  it('changes with the day, the level, the language and the last call', () => {
    const m = blankMem();
    const base = cacheKey(m, '2026-08-19');
    expect(cacheKey(m, '2026-08-20')).not.toBe(base);

    const later = blankMem();
    later.cefr.overall = 6;
    expect(cacheKey(later, '2026-08-19')).not.toBe(base);

    const afterCall = blankMem();
    afterCall.sessions = [call('x', 0)] as Memory['sessions'];
    expect(cacheKey(afterCall, '2026-08-19')).not.toBe(base);

    const other = blankMem();
    other.profile.target = 'es';
    expect(cacheKey(other, '2026-08-19')).not.toBe(base);
  });
});

describe('the catalogue fallback', () => {
  it('no longer offers back a subject from the last dozen calls', () => {
    const m = blankMem();
    m.interests = [
      { label: 'Les promenades', weight: 3, lastSeen: '2026-08-01' },
      { label: 'La cuisine', weight: 2, lastSeen: '2026-08-01' }
    ];
    m.sessions = Array.from({ length: REPEAT_WINDOW }, (_, i) =>
      call(i === 0 ? 'Les promenades' : 'autre ' + i, i)) as Memory['sessions'];
    expect(suggestTopics(m).map(s => s.t)).not.toContain('Les promenades');
  });
});

describe('the briefing gets the vocabulary the subject was chosen to force', () => {
  it('names the fields, and tells the tutor not to fall back on known words', () => {
    const m = blankMem();
    const p = buildTutorPrompt(m, {
      topic: 'L’apiculture urbaine', topicFr: 'parle des ruches sur les toits',
      targets: [], mode: 'daily', minutes: 8, topicTags: ['les insectes', 'la ville']
    });
    expect(p).toContain('les insectes, la ville');
  });

  it('says nothing extra when the subject came with no fields', () => {
    const m = blankMem();
    const p = buildTutorPrompt(m, { topic: 'x', topicFr: 'x', targets: [], mode: 'daily', minutes: 8 });
    expect(p).not.toContain('undefined');
  });
});

describe('the fallback never runs dry', () => {
  it('still proposes something to a C2 learner who has done a dozen calls', () => {
    // The top bands hold as few as three eligible topics in some packs, so a fixed
    // twelve-call window struck all of them out and left the shuffle button inert.
    for (const target of ['fr', 'es', 'it', 'pt', 'en'] as const) {
      const m = blankMem();
      m.profile.target = target;
      m.cefr.overall = 11;                       // C2+
      const all = suggestTopics(m).map(s => s.t);
      m.sessions = all.slice(0, REPEAT_WINDOW).map((t, i) => call(t, i)) as Memory['sessions'];
      expect(suggestTopics(m).length, target).toBeGreaterThan(0);
    }
  });

  it('does not let imported Duolingo rows use up the window', () => {
    const m = blankMem();
    m.interests = [{ label: 'Les promenades', weight: 3, lastSeen: '2026-08-01' }];
    m.sessions = [{ ...call('Les promenades', 0), source: 'duolingo' }] as Memory['sessions'];
    expect(suggestTopics(m).map(s => s.t)).toContain('Les promenades');
  });
});
