import { describe, expect, it } from 'vitest';
import { goalCandidates, goalCore, goalCount, goalForms, goalPlaced, pickWordGoals, recentGoalWords } from '../../src/lib/wordgoal';
import type { Card, Memory, SessionRecord } from '../../src/types';

const card = (p: Partial<Card>): Card => ({
  id: 'c' + Math.random().toString(36).slice(2, 7), type: 'de2fr', front: 'x', back: 'y',
  createdAt: '2026-01-01', state: 'review', ease: 2.5, interval: 5, reps: 3, lapses: 0,
  due: '2026-01-01', sourceKind: 'vocab', ...p
} as Card);

const mem = (cards: Card[], vocab: Memory['vocab'] = [], sessions: SessionRecord[] = []) =>
  ({ deck: { cards, log: [] }, vocab, sessions }) as unknown as Memory;

describe('goalCount', () => {
  it('gives a ten-minute call two words and a short one just the one', () => {
    expect(goalCount(10)).toBe(2);
    expect(goalCount(8)).toBe(2);
    expect(goalCount(5)).toBe(1);
  });
});

describe('goalCandidates', () => {
  it('ranks a word they only ever read above one they merely have not mastered', () => {
    const g = goalCandidates(mem([
      card({ type: 'fr2de', front: 'la réserve naturelle', back: 'das Naturschutzgebiet' }),
      card({ type: 'de2fr', front: 'der Bleistift', back: 'le crayon', state: 'new' })
    ]));
    expect(g.map(x => x.word)).toEqual(['la réserve naturelle', 'le crayon']);
    expect(g[0].why).toBe('passive');
  });

  it('does not call a word passive when the deck already makes them produce it', () => {
    const g = goalCandidates(mem([
      card({ type: 'fr2de', front: 'se promener', back: 'spazieren gehen' }),
      card({ type: 'de2fr', front: 'spazieren gehen', back: 'se promener', interval: 40 })
    ]));
    expect(g).toHaveLength(1);
    expect(g[0].why).toBe('unused');
  });

  it('puts a word they keep failing to produce near the top', () => {
    const g = goalCandidates(mem([
      card({ type: 'de2fr', front: 'anfechten', back: 'contester', lapses: 3 }),
      card({ type: 'de2fr', front: 'der Bleistift', back: 'le crayon', state: 'new' })
    ]));
    expect(g[0].word).toBe('contester');
    expect(g[0].why).toBe('lapsed');
  });

  it('ranks a word already mature in production last', () => {
    const g = goalCandidates(mem([
      card({ type: 'de2fr', front: 'der Bleistift', back: 'le crayon', interval: 60 }),
      card({ type: 'de2fr', front: 'anfechten', back: 'contester', interval: 4 })
    ]));
    expect(g[0].word).toBe('contester');
  });

  it('takes conversation vocabulary that never became a card', () => {
    const g = goalCandidates(mem([], [{ fr: 'le carrefour', de: 'die Kreuzung', date: '2026-08-01' }]));
    expect(g).toEqual([{ word: 'le carrefour', gloss: 'die Kreuzung', why: 'fresh' }]);
  });

  it('skips bare function words and whole sentences', () => {
    const g = goalCandidates(mem([
      card({ type: 'fr2de', front: 'les', back: 'sie' }),
      card({ type: 'de2fr', front: 'x', back: 'Je préfère me promener autour de ma maison', state: 'new' })
    ]));
    expect(g).toHaveLength(0);
  });
});

describe('pickWordGoals', () => {
  const deck = [
    card({ type: 'de2fr', front: 'anfechten', back: 'contester', lapses: 3 }),
    card({ type: 'de2fr', front: 'der Bleistift', back: 'le crayon', state: 'new' }),
    card({ type: 'de2fr', front: 'die Kreuzung', back: 'le carrefour', interval: 4 })
  ];

  it('takes the top of the list', () => {
    expect(pickWordGoals(mem(deck), 2).map(g => g.word)).toEqual(['contester', 'le crayon']);
  });

  it('sits out a word the recent calls already pushed', () => {
    const sessions = [{ wordGoals: [{ word: 'contester', used: true }] }] as unknown as SessionRecord[];
    expect(recentGoalWords({ sessions })).toEqual(new Set(['contester']));
    expect(pickWordGoals(mem(deck, [], sessions), 2).map(g => g.word)).toEqual(['le crayon', 'le carrefour']);
  });

  it('reuses a word on cooldown rather than returning nothing on a small deck', () => {
    const sessions = [{ wordGoals: [{ word: 'contester', used: true }, { word: 'le crayon', used: false }] }] as unknown as SessionRecord[];
    const one = mem([deck[0]], [], sessions);
    expect(pickWordGoals(one, 1).map(g => g.word)).toEqual(['contester']);
  });

  it('asks for nothing when the call carries no goals', () => {
    expect(pickWordGoals(mem(deck), 0)).toEqual([]);
  });
});

describe('goalPlaced', () => {
  it('accepts the word inflected, as spoken', () => {
    expect(goalPlaced('hier j’ai contesté la facture', { word: 'contester' })).toBe(true);
    // This used to demand the deck's own article back. Three real calls in a row recorded
    // a miss on that rule — "les ongles" against "mes ongles sont très longs" — and the
    // learner is the one told they did not do it. The article is the dictionary's, the
    // noun is theirs.
    expect(goalPlaced('je prends un crayon', { word: 'le crayon' })).toBe(true);
    expect(goalPlaced('je prends le crayon rouge', { word: 'le crayon' })).toBe(true);
  });
  it('counts a short verb the learner conjugated', () => {
    expect(goalPlaced('je vois les plantes', { word: 'voir' })).toBe(true);
  });
  it('does not accept a merely similar word', () => {
    expect(goalPlaced('je regarde la voiture', { word: 'voir' })).toBe(false);
    expect(goalPlaced('je parle de tout autre chose', { word: 'contester' })).toBe(false);
  });
});

/* From the call of 22 Aug, "Un voisinage à Berlin". The goal was "convenir à"; the learner
 * said "on peut convenir là des convenances à nous" — the verb placed, in a real sentence —
 * and the app recorded a miss, because a dictionary writes a verb next to the preposition it
 * governs and nobody speaks that way. */
describe('a goal is a word, not a dictionary entry', () => {
  const placed = (said: string, word: string) => goalPlaced(said, { word });

  it('ticks the verb the learner actually used', () => {
    expect(placed('Oui, c’est un très grand salon, et on peut convenir là des convenances à nous.', 'convenir à')).toBe(true);
  });

  it('ticks a noun the learner put a different article in front of', () => {
    expect(placed('j’ai remarqué que mes ongles sont très longs', 'les ongles')).toBe(true);
    expect(placed('on se rencontre souvent dans la cuisine', 'la cuisine')).toBe(true);
  });

  it('ticks either form when the card lists both genders', () => {
    // "pertinent, pertinente" is one adjective written twice, and demanding both adjacent
    // made the goal unreachable in principle.
    expect(placed('c’est juste un détail, mais c’est un détail pertinent', 'pertinent, pertinente')).toBe(true);
    expect(placed('une remarque pertinente', 'pertinent, pertinente')).toBe(true);
    expect(goalForms('pertinent, pertinente')).toEqual(['pertinent', 'pertinente']);
  });

  it('ticks a reflexive verb however the pronoun moved', () => {
    // "se promener" is in the deck; nobody says "se promener" in a sentence about themselves.
    expect(placed('je me promène autour de ma maison', 'se promener')).toBe(true);
    expect(placed('on se promène souvent le dimanche', 'se promener')).toBe(true);
    expect(placed('nous nous promenons au parc', 'se promener')).toBe(true);
  });

  it('still ticks the citation form when they do say it', () => {
    expect(placed('il faut convenir à ce prix', 'convenir à')).toBe(true);
    expect(placed('j’aime me promener', 'se promener')).toBe(true);
  });

  it('keeps a fixed expression fixed', () => {
    // "à cet égard" is an expression, not a verb plus its preposition: the words belong
    // together, and the leading "à" is the only scaffolding worth dropping.
    expect(placed('donc à cet égard, c’est un bâtiment très grand', 'à cet égard')).toBe(true);
    // The bare noun is NOT the expression: "avoir des égards pour quelqu'un" is a different
    // thing entirely, so only the leading preposition comes off and "cet égard" holds.
    expect(placed('j’ai beaucoup d’égards pour lui', 'à cet égard')).toBe(false);
    expect(placed('je vais à Berlin et cet homme est grand', 'à cet égard')).toBe(false);
  });

  it('does not tick on the scaffolding alone', () => {
    // Every French sentence has an "à" in it somewhere; a goal that ticks on that is worse
    // than one that never ticks.
    expect(placed('je vais à Berlin de temps en temps', 'convenir à')).toBe(false);
    expect(placed('je me lave et je me lève', 'se promener')).toBe(false);
  });

  it('strips only the ends, and never everything', () => {
    expect(goalCore('convenir à')).toEqual(['convenir']);
    expect(goalCore('se promener')).toEqual(['promener']);
    expect(goalCore('avoir besoin de')).toEqual(['avoir', 'besoin']);
    expect(goalCore('à')).toEqual([]);
    expect(goalCore('de')).toEqual([]);
    expect(goalCore('égard')).toEqual(['egard']);   // words() folds accents, as it does everywhere
  });
});

/* A goal is a word the learner is asked to USE, and a word in use is conjugated, pluralised,
 * and separated from the preposition it governs by whatever else the sentence needed. The
 * matcher was strict on all three counts, so the tick came only when the entry was recited
 * back rather than spoken. */
describe('a word in use, not a word in a dictionary', () => {
  const placed = (said: string, word: string) => goalPlaced(said, { word });

  it('ticks a verb however it is conjugated', () => {
    for (const said of [
      'je travaille sur l’introduction',
      'nous travaillons ensemble le matin',
      'j’ai beaucoup travaillé hier soir',
      'je travaillerais volontiers avec eux',
      'ils travailleraient mieux le matin'
    ]) expect(placed(said, 'travailler'), said).toBe(true);
  });

  it('ticks a noun in the plural, however short', () => {
    expect(placed('mes ongles sont très longs', 'l’ongle')).toBe(true);
    expect(placed('ce sont vraiment des sons', 'le son')).toBe(true);
    expect(placed('j’ai deux vies', 'la vie')).toBe(true);
  });

  it('lets the sentence come between a verb and its preposition', () => {
    expect(placed('je me concentre beaucoup sur la réunion', 'se concentrer sur')).toBe(true);
    expect(placed('il faut convenir vraiment à ce prix', 'convenir à')).toBe(true);
  });

  /* The widening is bounded on the WHOLE shorter word, which is what separates an
   * inflection from a coincidence — and the old guards still stand behind it. */
  it('does not tick on a word that merely starts the same way', () => {
    expect(placed('je vais prendre la voiture', 'voir')).toBe(false);
    expect(placed('je suis allé au Portugal', 'le port')).toBe(false);
    expect(placed('la porte est ouverte', 'portugais')).toBe(false);
    expect(placed('c’est un parlementaire connu', 'parler')).toBe(false);
  });

  it('still refuses three words scattered through a sentence', () => {
    expect(placed('je vais à Berlin et cet homme est grand', 'à cet égard')).toBe(false);
  });
});
