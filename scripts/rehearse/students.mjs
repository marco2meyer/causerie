/* Scripted students for the rehearsal (scripts/rehearse.mjs).
 *
 * Each one is a real call of Marco's, rewritten as a fixed script: the same subject, the
 * same level, and — this is the point — the same mistakes, planted where the tutor's rules
 * say something must happen. `expect` is what her NEXT turn owes that line: the recast of a
 * target error, the word he asked for, the structure her question is supposed to force.
 * Nothing here adapts to what she says, which is the trade: a script cannot interrupt her
 * or go quiet on her, so barge-in and silence are not what these runs measure.
 *
 * Keep the lines speakable: they are read aloud by a text-to-speech voice with a German
 * accent, at a learner's pace, and what the model hears is that audio, not this text.
 */

/** Words that cannot be French. « du », « ist » and « das » were in this list once and
 *  made every « du livre » a German intrusion: the first rehearsal reported nine that
 *  were not there. A detector that flags the target language is worse than none. */
export const GERMAN = /\b(ich|nicht|wiederhole|wiederholen|rollenspiel|kaufst|kannst|verstehe|frage|bitte|danke|eine[nr]|und|aber|oder|noch|schon|sehr|auch|wenn|heißt|jetzt|kein|mein|dein)\b/i;

export const STUDENTS = [
  {
    id: 'marche',
    topic: 'Au marché avec Eva',
    /* The three the app had picked that morning, labels and all — the German ones are real:
       they come from an older analysis and are exactly what she is handed today. */
    targets: [
      { kind: 'weakness', id: null, label: 'Construction des questions indirectes', cefr: 'B1', status: 'persisting' },
      { kind: 'weakness', id: null, label: 'Omission du verbe « être »', cefr: 'A2', status: 'new' },
      { kind: 'weakness', id: null, label: 'Präpositionen bei Orten und festen Wendungen', cefr: 'A2', status: 'improving' }
    ],
    lines: [
      { text: 'Ça me va, oui.' },
      { text: 'Alors, je voudrais bien acheter un kilo de bananes. Ça fait combien ?' },
      // The day's target, failed: an indirect question built as a direct one. Her answer
      // owes the correct form, first thing, without announcing it.
      { text: 'Je ne comprends pas parce que est-ce qu’il faut payer pour Eva aussi.',
        expect: { recast: /s(’|')il faut|si (il|c(’|')est|ça)|ce qu(e|’)il faut/i, label: 'recast the indirect question' } },
      // Lost. The rule now says: simplify in French first, one whole sentence in German at
      // most, never both languages inside one sentence.
      { text: 'Wiederholen, bitte. Ta question, je ne comprends pas.',
        expect: { noMixedSentence: true, label: 'repair without mixing the two languages in one sentence' } },
      { text: 'D’accord. Alors, pour les fruits, en prix total, c’est dix euros.' },
      // He asks for a word: the word, at most two words of German, and on.
      { text: 'Et je voudrais aussi des… comment on dit peaches en français ?',
        expect: { says: /pêche/i, maxGloss: true, label: 'give the word, gloss capped' } },
      { text: 'Deux kilos, s’il te plaît. Ça fait combien ?' },
      // The arithmetic is his to do. Whether she does it for him is measured, not required.
      { text: 'Alors, je pense qu’il faut que tu calcules le total, parce que tu es la vendeuse.' },
      { text: 'Je voudrais bien payer avec la carte.' },
      { text: 'Merci beaucoup. Au revoir !', goodbye: true }
    ]
  },

  {
    id: 'maison',
    topic: 'Une maison avec huit personnes',
    targets: [
      { kind: 'weakness', id: null, label: 'Subjonctif après « important que »', cefr: 'B1', status: 'persisting' },
      { kind: 'weakness', id: null, label: 'Genre des noms fréquents', cefr: 'A2', status: 'new' },
      { kind: 'weakness', id: null, label: 'Construction des questions indirectes', cefr: 'B1', status: 'improving' }
    ],
    lines: [
      { text: 'Ça me va.' },
      { text: 'Donc, il y a un entrée avec une porte blanche, et après, en haut, il y a la première chambre à coucher.',
        expect: { recast: /une entrée/i, label: 'recast the gender of « entrée »' } },
      // Two words of English in the middle of the French: the priority reformulation.
      { text: 'Une règle importante : on ne nettoie rien par main, on utilise le dishwasher.',
        expect: { says: /lave-vaisselle/i, label: 'give the French word for the English one' } },
      // Four words. The rule says: do not ask something new, make him carry on.
      { text: 'Oui, exactement.', expect: { noNewQuestion: true, label: 'let a four-word answer be continued, not re-asked' } },
      // The day's first target, failed, in the exact shape it failed in on 9 September.
      { text: 'Et c’est très important que la reliure du livre n’est pas affectée.',
        expect: { recast: /ne soit pas/i, label: 'recast the subjunctive after « important que »' } },
      { text: 'Dans le panneau, il faut placer une affirmation, pour dire à neuf heures on arrête.' },
      { text: 'Et pour la salle de bain, après la douche, on nettoie tout.' },
      { text: 'Bon, je dois y aller. Au revoir, à demain !', goodbye: true }
    ]
  },

  {
    id: 'semaine',
    topic: 'Ta semaine, du lundi au vendredi',
    targets: [
      { kind: 'weakness', id: null, label: 'Omission du verbe « être »', cefr: 'A2', status: 'persisting' },
      { kind: 'weakness', id: null, label: 'Idiomatiken bei häufigen Alltagsaussagen', cefr: 'B1', status: 'new' },
      { kind: 'weakness', id: null, label: 'Präpositionen bei Orten und festen Wendungen', cefr: 'A2', status: 'improving' }
    ],
    lines: [
      { text: 'Ça me va, oui, on peut parler de ma semaine.' },
      // Target: the missing verb. Her answer owes « c'est » or « elle est », up front.
      { text: 'Lundi difficile, parce que beaucoup de réunions et la maison pleine.',
        expect: { recast: /\b(est|c(’|')est|était|a été)\b/i, label: 'recast the missing verb' } },
      { text: 'Mardi, je vais à la bureau pour une présentation.',
        expect: { recast: /au bureau/i, label: 'recast the preposition' } },
      // A long rambling turn: she should react to the content, not correct four things.
      { text: 'Mercredi, c’est le jour où je travaille à la maison, et je commence très tôt, vers six heures, parce que les enfants dorment encore et la maison est calme, et après je fais une pause pour le petit déjeuner avec Eva, et puis je continue jusqu’au soir.',
        expect: { atMostOneCorrection: true, label: 'at most one correction in a turn' } },
      { text: 'Oui.', expect: { noNewQuestion: true, label: 'let a one-word answer be continued, not re-asked' } },
      { text: 'Jeudi soir, on a des amis à la maison, et vendredi je suis mort.' },
      { text: 'Voilà, c’est tout. Merci, au revoir !', goodbye: true }
    ]
  }
];
