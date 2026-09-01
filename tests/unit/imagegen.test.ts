import { describe, expect, it } from 'vitest';
import { buildIdeaMessages, IMG_MODEL, NO_TEXT_SUFFIX } from '../../src/lib/imagegen';
import { seedMem } from '../../src/lib/seed';
import type { Card } from '../../src/types';

const card: Pick<Card, 'front' | 'back' | 'hint' | 'example' | 'type'> = {
  type: 'cloze',
  front: 'Mon ___ est correct mais je veux plus de vacances.',
  back: 'revenu',
  hint: 'Einkommen',
  example: 'Mon revenu est correct.'
};

describe('buildIdeaMessages', () => {
  it('grounds the two-prompt request in the card and the student interests', () => {
    const mem = seedMem('Marco');
    const msgs = buildIdeaMessages(card, mem);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toContain('TWO');
    expect(msgs[0].content).toContain('French');
    expect(msgs[1].content).toContain('revenu');
    expect(msgs[1].content).toContain('Mon ___');
    expect(msgs[1].content).toContain('The student cares about');
  });

  it('copes with a bare card and no personal hooks', () => {
    const mem = seedMem('X');
    mem.interests = [];
    mem.facts = [];
    const msgs = buildIdeaMessages({ type: 'fr2de', front: 'la falaise', back: 'die Klippe' }, mem);
    expect(msgs[1].content).toContain('la falaise');
    expect(msgs[1].content).not.toContain('cares about');
    expect(msgs[1].content).not.toContain('True of the student');
  });

  it('forbids writing in the picture, and the generator forbids it again', () => {
    const sys = buildIdeaMessages(card, seedMem('Marco'))[0].content;
    expect(sys).toMatch(/nothing written/i);
    expect(NO_TEXT_SUFFIX).toMatch(/no text/i);
  });

  /* The old rule offered "flying calendar pages" and a "melting clock" as ways to show a
   * tense, in the same breath as forbidding numbers — and a calendar and a clock face are
   * made of numbers. Every time the model took the suggestion the generator either wrote
   * digits onto the card or produced a smeared dial. */
  it('does not ask for time cues that are made of writing', () => {
    const sys = buildIdeaMessages(card, seedMem('Marco'))[0].content;
    const cues = sys.slice(sys.indexOf('VERB FORM'), sys.indexOf('ABSTRACT IDEA'));
    expect(cues).toMatch(/NO clock, calendar or written date/);
    expect(cues).not.toMatch(/calendar pages|melting clock/i);
  });

  it('keeps the gender anchor on nouns, and off languages that have no genders', () => {
    const fr = buildIdeaMessages(card, seedMem('Marco'))[0].content;
    expect(fr).toContain('QUEEN');
    expect(fr).toMatch(/Nouns only/);

    const en = seedMem('Marco');
    en.profile.target = 'en';
    const sys = buildIdeaMessages(card, en)[0].content;
    expect(sys).not.toContain('QUEEN');
    expect(sys).not.toContain('KING');
  });

  it('asks the two ideas to differ in kind rather than in scenery', () => {
    const sys = buildIdeaMessages(card, seedMem('Marco'))[0].content;
    expect(sys).toContain('DIFFER IN KIND');
    expect(sys).toMatch(/a: the student's own world/);
    expect(sys).toMatch(/b: absurd/);
  });

  it('feeds the tutor\'s notes on the student in, newest first', () => {
    const mem = seedMem('Marco');
    mem.facts = [
      { id: 'f1', text: 'travaille sur la sécurité de l’IA', category: 'arbeit', firstSaid: '2026-01-01', lastSaid: '2026-08-23' },
      { id: 'f2', text: 'habite à Berlin', category: 'orte', firstSaid: '2026-01-01', lastSaid: '2026-08-01' }
    ];
    const usr = buildIdeaMessages(card, mem)[1].content;
    expect(usr).toContain('True of the student');
    expect(usr.indexOf('sécurité')).toBeLessThan(usr.indexOf('Berlin'));
    expect(usr).toMatch(/Never force one in/);
  });

  it('pins the image model the app pays for', () => {
    expect(IMG_MODEL).toBe('gpt-image-1-mini');
  });
});
