import { describe, expect, it } from 'vitest';
import { portrait, portraitText, settled } from '../../src/lib/portrait';
import { buildTutorPrompt } from '../../src/lib/prompts';
import { blankMem } from '../../src/lib/storage';
import { pack } from '../../src/lang';
import type { Fact, FactCategory, Memory } from '../../src/types';

/* The briefing used to hand the tutor the last eight facts in flat chronological order.
 * Nothing in that list said which of them mattered, so "il enseigne la philosophie" and
 * "il a mangé une mauvaise tarte mardi" arrived as equals — and she asked after the tarte.
 * A portrait sorts the two, using a signal that is already in the data. */

const fact = (id: string, text: string, category: FactCategory, first: string, last = first): Fact =>
  ({ id, text, category, firstSaid: first, lastSaid: last });

/** A believable memory: a few things that are true every week, a few that were asides. */
function marco(): Memory {
  const m = blankMem();
  m.profile.name = 'Marco';
  m.facts = [
    fact('f1', 'Il enseigne la philosophie à l’université.', 'arbeit', '2026-05-02', '2026-08-14'),
    fact('f2', 'Il a deux filles.', 'familie', '2026-05-09', '2026-08-02'),
    fact('f3', 'Il habite à Berlin.', 'orte', '2026-05-02', '2026-07-30'),
    fact('f4', 'Il court le matin.', 'alltag', '2026-06-01', '2026-08-10'),
    fact('f5', 'Il a mangé une mauvaise tarte mardi.', 'sonstiges', '2026-08-18'),
    fact('f6', 'Il a raté son train jeudi.', 'sonstiges', '2026-08-19'),
    fact('f7', 'Son voisin repeint sa cuisine.', 'sonstiges', '2026-08-20'),
    fact('f8', 'Il a vu un film islandais.', 'vorlieben', '2026-08-21')
  ];
  return m;
}

describe('what counts as a basic', () => {
  it('is a fact that has come up on more than one day', () => {
    expect(settled(fact('a', 'x', 'arbeit', '2026-05-02', '2026-08-14'))).toBe(true);
    expect(settled(fact('b', 'x', 'arbeit', '2026-08-18'))).toBe(false);
    // Twice in one day is one conversation, not a pattern.
    expect(settled(fact('c', 'x', 'arbeit', '2026-08-18T09:00', '2026-08-18T09:40'))).toBe(false);
  });
});

describe('the portrait', () => {
  it('keeps what is true every week and leaves the tarte out of it', () => {
    const p = portrait(marco(), 100);
    const basics = p.basics.flatMap(g => g.facts.map(f => f.id));
    expect(basics).toEqual(['f1', 'f2', 'f3', 'f4']);
    expect(basics).not.toContain('f5');
  });

  it('reads as a person: what he does, who he is to others, where he is', () => {
    const p = portrait(marco(), 100);
    expect(p.basics.map(g => g.cat)).toEqual(['arbeit', 'familie', 'orte', 'alltag']);
  });

  it('offers only a few incidentals, and different ones from call to call', () => {
    const m = marco();
    const days = [10, 11, 12, 13, 14].map(d => portrait(m, d).passing.map(f => f.id).join(','));
    expect(portrait(m, 10).passing.length).toBeLessThanOrEqual(3);
    expect(new Set(days).size, 'the same three rode along on every call').toBeGreaterThan(1);
  });

  it('agrees with itself twice in the same day', () => {
    const m = marco();
    expect(portrait(m, 42).passing.map(f => f.id)).toEqual(portrait(m, 42).passing.map(f => f.id));
  });

  it('never crowds the portrait out with one talkative category', () => {
    const m = blankMem();
    m.facts = Array.from({ length: 9 }, (_, i) =>
      fact('w' + i, 'travail ' + i, 'arbeit', '2026-05-0' + (i + 1), '2026-08-0' + (i + 1)));
    const p = portrait(m, 1);
    expect(p.basics.flatMap(g => g.facts).length).toBeLessThanOrEqual(2);
  });

  it('still describes someone in the first week, before anything has been confirmed', () => {
    // Three calls in, nothing has come up twice yet — and an empty portrait would have her
    // open every call as a stranger.
    const m = blankMem();
    m.facts = [
      fact('a', 'Il est médecin.', 'arbeit', '2026-08-19'),
      fact('b', 'Il habite à Lyon.', 'orte', '2026-08-20'),
      fact('c', 'Il aime la voile.', 'vorlieben', '2026-08-21')
    ];
    expect(portrait(m, 1).basics.flatMap(g => g.facts).length).toBeGreaterThan(0);
  });

  it('says nothing rather than inventing when there is nothing', () => {
    const m = blankMem();
    const p = portrait(m, 1);
    expect(p.basics).toEqual([]);
    expect(p.passing).toEqual([]);
    expect(portraitText(p, pack('fr').tutor.facts)).toBe(pack('fr').tutor.facts.none);
  });
});

describe('the briefing that comes out of it', () => {
  it('labels the basics and marks the rest as incidental', () => {
    const F = pack('fr').tutor.facts;
    const text = portraitText(portrait(marco(), 100), F);
    expect(text).toContain(F.basics);
    expect(text).toContain(F.passing);
    expect(text).toContain('Travail : Il enseigne la philosophie à l’université');
    // The heading tells her to use at most one of the incidentals per call.
    expect(F.passing).toMatch(/UN|ONE|UNO/);
  });

  it('reaches the tutor briefing itself, grouped rather than listed', () => {
    const m = marco();
    const brief = buildTutorPrompt(m, { topic: 'le marché', targets: [] });
    expect(brief).toContain(pack('fr').tutor.facts.basics);
    expect(brief).toContain('Il enseigne la philosophie');
  });
});
