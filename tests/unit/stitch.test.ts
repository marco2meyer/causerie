import { describe, expect, it } from 'vitest';
import { stitchTranscript } from '../../src/lib/stitch';
import type { TranscriptItem } from '../../src/types';

const u = (text: string): TranscriptItem => ({ role: 'user', text });
const a = (text: string): TranscriptItem => ({ role: 'assistant', text });

/* The fixture is the real shape of the 19 Aug call: the VAD committed one spoken sentence
 * as four user items, with the tutor answering the whole thing once afterwards. */
const CALL: TranscriptItem[] = [
  a('Bonjour Marco. On peut parler des fêtes avec beaucoup de monde ?'),
  u('Quand il y a beaucoup de gens et l’ambiance est forte'),
  u('Et la chose qui gêne'),
  u('Si mes amis'),
  u('Rencontre'),
  a('D’accord,'),
  u('Les autres amis. Donc il y a des interactions qui sont nouveaux')
];

describe('stitchTranscript', () => {
  it('merges a run of user fragments back into one turn', () => {
    const out = stitchTranscript(CALL);
    expect(out.map(i => i.role)).toEqual(['assistant', 'user', 'assistant', 'user']);
    expect(out[1].text).toBe(
      'Quand il y a beaucoup de gens et l’ambiance est forte Et la chose qui gêne Si mes amis Rencontre'
    );
  });

  it('leaves a properly alternating transcript untouched', () => {
    const clean = [a('Ça va ?'), u('Oui, ça va bien.'), a('Parfait.')];
    expect(stitchTranscript(clean)).toEqual(clean);
  });

  it('does not mutate the input items', () => {
    const input = [u('Je'), u('suis fatigué')];
    stitchTranscript(input);
    expect(input.map(i => i.text)).toEqual(['Je', 'suis fatigué']);
  });

  it('never rewrites the learner\'s words, not even the casing at a seam', () => {
    expect(stitchTranscript([u('C’est bon.'), u('Merci beaucoup.')])[0].text)
      .toBe('C’est bon. Merci beaucoup.');
    expect(stitchTranscript([u('et puis'), u('Marco est venu')])[0].text)
      .toBe('et puis Marco est venu');
  });

  it('drops empty items rather than leaving blank turns', () => {
    expect(stitchTranscript([u('  '), a('Salut'), u('')])).toEqual([a('Salut')]);
  });

  it('merges assistant fragments too', () => {
    expect(stitchTranscript([a('Tu aimes l’'), a('ambiance ?')])[0].text).toBe('Tu aimes l’ ambiance ?');
  });
});

describe('stitchTranscript turn boundaries', () => {
  it('keeps two student turns apart when the tutor turn between them has no text', () => {
    // Barge-in can cut a tutor response before its first transcript delta arrives: the item
    // exists but is empty. Those are still two separate student turns.
    const out = stitchTranscript([u('Je suis fatigué.'), a(''), u('Et toi ?')]);
    expect(out.map(i => i.text)).toEqual(['Je suis fatigué.', 'Et toi ?']);
  });

  it('still merges a genuine run with nothing at all in between', () => {
    expect(stitchTranscript([u('Je suis'), u('fatigué')])).toHaveLength(1);
  });
});
