import type { Card, Evidence, Memory, Strength, Weakness } from '../types';
import { newCard } from './srs';
import { blankMem } from './storage';
import { uid } from './utils';

/** Starter memory imported from Marco's Duolingo screenshots (2026-08-17):
 *  observed level, mistakes flagged by Duolingo's Tipps, praised strengths, interests, prior calls. */
export function seedMem(name: string): Memory {
  const m = blankMem();
  m.profile.name = name || 'Marco';
  const d = '2026-08-17';
  const src = 'Duolingo 17.08.26';

  m.cefr = {
    overall: 2,
    skills: { grammar: 2, vocabulary: 2, fluency: 2, comprehension: 3 },
    confidence: 0.45,
    history: [{ date: d, overall: 2, skills: { grammar: 2, vocabulary: 2, fluency: 2, comprehension: 3 }, source: 'import Duolingo' }]
  };

  const W = (label: string, cefr: Weakness['cefr'], quote: string): Weakness => ({
    id: uid('w'), label, cefr, status: 'new', firstSeen: d, lastSeen: d, timesWorked: 0,
    evidence: [{ quote, src } satisfies Evidence]
  });
  m.weaknesses = [
    W('Négation avec jamais + de : « Je n’ai jamais dessiné d’animaux »', 'A2', 'Non, je n’ai pas déjà dessiné des animaux. → Mieux : Je n’ai jamais dessiné d’animaux.'),
    W('Pronoms objets le / la / les : « je les aime »', 'A2', 'Oui, je l’aime beaucoup. (les arbres) → Mieux : je les aime beaucoup.'),
    W('Verbes pronominaux : « me promener », pas « de promener »', 'A2', 'Je préfère de promener autour de ma maison. → Mieux : me promener.'),
    W('savoir vs connaître (noms, personnes, lieux : connaître)', 'A2', 'je ne sais pas les noms concrets → Mieux : je ne connais pas les noms.'),
    W('j’aime + infinitif : « J’aime voir les plantes »', 'A2', 'J’aime, il y a des des plantes. → Mieux : J’aime voir les plantes.'),
    W('Prendre congé : « À plus tard » / « À bientôt »', 'A1', 'Un plus. → Mieux : À plus tard ou À bientôt.')
  ];

  const S = (label: string, quote: string): Strength => ({
    id: uid('s'), label, lastSeen: d, evidence: [{ quote, src }]
  });
  m.strengths = [
    S('Exprime ses préférences avec « Je préfère »', 'Je préfère les grands arbres. / Je préfère dessiner avec un crayon.'),
    S('Construction « C’est juste pour… »', 'C’est juste pour essayer.'),
    S('Propose des alternatives avec « ou »', 'Ou peut-être un chat.')
  ];

  m.interests = [
    { label: 'Les promenades dans la réserve naturelle voisine', weight: 3, lastSeen: d },
    { label: 'Les grands arbres anciens', weight: 2, lastSeen: d },
    { label: 'Le dessin au crayon (débutant)', weight: 2, lastSeen: d },
    { label: 'La cuisine indienne', weight: 2, lastSeen: d },
    { label: 'Dessiner des animaux : chat, oiseau', weight: 1, lastSeen: d }
  ];

  m.vocab = [
    { fr: 'la réserve naturelle', de: 'das Naturschutzgebiet', ex: 'Il y a une réserve naturelle autour de ma maison.', date: d },
    { fr: 'se promener', de: 'spazieren gehen', ex: 'J’aime me promener autour de ma maison.', date: d },
    { fr: 'le crayon', de: 'der Bleistift', ex: 'Je préfère dessiner avec un crayon.', date: d },
    { fr: 'dessiner', de: 'zeichnen', ex: 'Tu as déjà dessiné des animaux ?', date: d },
    { fr: 'les ombres', de: 'die Schatten', ex: 'Le crayon permet de faire des ombres.', date: d },
    { fr: 'chouette', de: 'klasse, toll', ex: 'C’est chouette.', date: d }
  ];

  m.sessions = [
    { id: uid('imp'), date: '2025-10-03', topic: 'L’ennui au centre commercial', source: 'duolingo', minutes: null, summary: 'Appel Duolingo (importé), sans transcription.' },
    { id: uid('imp'), date: d, topic: 'Faire connaissance', source: 'duolingo', minutes: null, summary: 'Appel Duolingo (importé). Premières présentations.' },
    { id: uid('imp'), date: d, topic: 'La cuisine indienne', source: 'duolingo', minutes: null, summary: 'Appel Duolingo (importé). La cuisine indienne.' },
    {
      id: uid('imp'), date: d, topic: 'Dessiner des arbres et des chats', source: 'duolingo', minutes: null,
      summary: 'Appel Duolingo (importé). Promenades dans la réserve naturelle, grands arbres, dessin au crayon. Points forts : « Je préfère », « C’est juste pour… ». Fautes : jamais + de, pronoms objets, me promener, savoir/connaître, formules d’adieu.'
    }
  ];

  m.facts = [
    { id: uid('f'), text: 'Habite à côté d’une réserve naturelle', category: 'orte', firstSaid: d, lastSaid: d },
    { id: uid('f'), text: 'S’y promène régulièrement', category: 'alltag', firstSaid: d, lastSaid: d }
  ];

  /* Starter deck: his actual Duolingo mistakes as cloze cards + first vocab pairs,
     so the first evening review works on day one. */
  const cloze = (front: string, back: string, hint: string, example: string, tag: string): Card =>
    newCard({ type: 'cloze', front, back, hint, example, audioText: example, tag, sourceKind: 'seed' });
  const vocabPair = (fr: string, de: string, ex: string): Card[] => [
    newCard({ type: 'fr2de', front: fr, back: de, example: ex, audioText: fr + '. ' + ex, tag: 'vocabulaire', sourceKind: 'seed' }),
    newCard({ type: 'de2fr', front: de, back: fr, example: ex, audioText: fr + '. ' + ex, tag: 'vocabulaire', sourceKind: 'seed' })
  ];
  m.deck.cards = [
    cloze('Je n’ai ___ dessiné d’animaux.', 'jamais', 'nie', 'Je n’ai jamais dessiné d’animaux.', 'négation'),
    cloze('Les arbres ? Oui, je ___ aime beaucoup.', 'les', 'sie (Plural)', 'Les arbres ? Oui, je les aime beaucoup.', 'pronoms objets'),
    cloze('Je préfère ___ promener autour de ma maison.', 'me', 'Reflexiv', 'Je préfère me promener autour de ma maison.', 'verbes pronominaux'),
    cloze('Je ne ___ pas les noms des plantes.', 'connais', 'kennen', 'Je ne connais pas les noms des plantes.', 'savoir/connaître'),
    cloze('J’aime ___ les plantes.', 'voir', 'sehen', 'J’aime voir les plantes.', 'aimer + infinitif'),
    newCard({ type: 'de2fr', front: 'Bis später! (Abschied)', back: 'À plus tard !', example: 'À plus tard !', audioText: 'À plus tard !', tag: 'formules', sourceKind: 'seed' }),
    ...vocabPair('la réserve naturelle', 'das Naturschutzgebiet', 'Il y a une réserve naturelle autour de ma maison.'),
    ...vocabPair('se promener', 'spazieren gehen', 'J’aime me promener autour de ma maison.'),
    ...vocabPair('le crayon', 'der Bleistift', 'Je préfère dessiner avec un crayon.')
  ];

  /* Competency matrix cells the Duolingo evidence already supports: islands, not a line. */
  m.comp = {
    'g-a1-etre-avoir': { status: 'ok', lastSeen: d, evidence: 'C’est chouette. Il y a des plantes.' },
    'g-a1-present-er': { status: 'ok', lastSeen: d, evidence: 'J’aime les grands arbres. Je préfère…' },
    'f-a1-saluer': { status: 'ko', lastSeen: d, evidence: '« Un plus. » au lieu de « À plus tard. »' },
    'f-a1-gouts-simples': { status: 'ok', lastSeen: d, evidence: 'Je préfère les grands arbres.' },
    'g-a2-cod-coi': { status: 'ko', lastSeen: d, evidence: 'je l’aime beaucoup (les arbres) → je les aime' },
    'g-a2-pronominaux': { status: 'ko', lastSeen: d, evidence: 'Je préfère de promener → me promener' },
    'g-a2-partitif': { status: 'ko', lastSeen: d, evidence: 'pas déjà dessiné des animaux → jamais dessiné d’animaux' },
    'g-a2-aimer-inf': { status: 'partial', lastSeen: d, evidence: 'J’aime, il y a des plantes → J’aime voir les plantes' },
    'f-a2-preferences': { status: 'ok', lastSeen: d, evidence: 'Je préfère dessiner avec un crayon.' }
  };

  /* The Duolingo import already establishes level, gaps and interests, so the
     getting-to-know-you phase is considered done. Fresh profiles start with it. */
  m.introDone = true;

  m.streak = { count: 1, last: d };
  return m;
}
