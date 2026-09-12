/* The student the rehearsal briefs her about: a fixture, not a person's real memory.
 *
 * It carries what the briefing actually reads — level and skills, a few settled facts,
 * interests, open weaknesses, a period direction, three previous calls — shaped like a
 * real A2/B1 file so the prompt that comes out is the length and texture of a real one.
 * No real student's data goes near this script: a rehearsal is run over and over, its
 * transcripts are written to disk, and none of that is a place for someone's life.
 */

/** `blankMem` comes from the app (bundled at run time); this fills it in. */
export function rehearsalMemory(blankMem) {
  const m = blankMem();
  m.introDone = true;
  m.profile = { ...m.profile, name: 'Marc', native: 'de', target: 'fr', persona: 'deadpan', tutor: 'odile' };
  m.cefr = {
    ...m.cefr,
    overall: 7,                       // A2+ on the app's ladder
    skills: { grammar: 6, vocabulary: 7, fluency: 6, comprehension: 8 },
    confidence: 0.55
  };
  m.facts = [
    { id: 'f1', text: 'Il vit dans une grande maison partagée, huit personnes.', category: 'alltag', firstSaid: '2026-08-20', lastSaid: '2026-09-09' },
    { id: 'f2', text: 'Sa fille s’appelle Eva.', category: 'familie', firstSaid: '2026-08-22', lastSaid: '2026-09-08' },
    { id: 'f3', text: 'Il travaille souvent à la maison, très tôt le matin.', category: 'arbeit', firstSaid: '2026-08-25', lastSaid: '2026-09-07' },
    { id: 'f4', text: 'Il relie des livres à ses heures perdues.', category: 'vorlieben', firstSaid: '2026-09-01', lastSaid: '2026-09-09' }
  ];
  m.interests = [
    { label: 'la reliure', weight: 4, lastSeen: '2026-09-09' },
    { label: 'la musique au travail', weight: 3, lastSeen: '2026-09-04' },
    { label: 'le marché du samedi', weight: 2, lastSeen: '2026-09-06' }
  ];
  m.weaknesses = [
    { id: 'w1', label: 'Construction des questions indirectes', cefr: 'B1', status: 'persisting', lastSeen: '2026-09-09' },
    { id: 'w2', label: 'Subjonctif après « important que »', cefr: 'B1', status: 'persisting', lastSeen: '2026-09-09' },
    { id: 'w3', label: 'Omission du verbe « être »', cefr: 'A2', status: 'new', lastSeen: '2026-09-08' },
    { id: 'w4', label: 'Präpositionen bei Orten und festen Wendungen', cefr: 'A2', status: 'improving', lastSeen: '2026-09-07' }
  ];
  m.checkins = { history: [], direction: 'Parler plus longtemps sans chercher ses mots.' };
  m.sessions = [
    { id: 's1', date: '2026-09-07', at: '2026-09-07T06:14:00.000Z', topic: 'La maison le matin', source: 'causerie', minutes: 10, seconds: 586, analysis: null, tutorShare: 0.45,
      summary: 'Thèmes : la maison, le matin. Il décrit les pièces sans hésiter, mais perd le genre des noms.' },
    { id: 's2', date: '2026-09-08', at: '2026-09-08T08:37:00.000Z', topic: 'La chambre libre ce soir', source: 'causerie', minutes: 10, seconds: 584, analysis: null, tutorShare: 0.41,
      summary: 'Thèmes : la colocation, une chambre libre. Phrases plus longues ; « il faut que » encore à l’indicatif.' },
    { id: 's3', date: '2026-09-09', at: '2026-09-09T06:14:00.000Z', topic: 'Une maison avec huit personnes', source: 'causerie', minutes: 10, seconds: 574, analysis: null, tutorShare: 0.48,
      summary: 'Thèmes : les règles de la maison, les livres. Le subjonctif après « important que » ne vient pas encore.' }
  ];
  m.vocab = [
    { fr: 'la reliure', de: 'der Bucheinband', ex: 'La reliure du livre est abîmée.', date: '2026-09-09' },
    { fr: 'une étagère', de: 'ein Regal', ex: 'Les livres sont sur l’étagère.', date: '2026-09-09' },
    { fr: 'la moisissure', de: 'der Schimmel', ex: 'On ne veut pas de moisissure.', date: '2026-09-09' },
    { fr: 'ronfler', de: 'schnarchen', ex: 'Il ronfle fort.', date: '2026-09-08' }
  ];
  return m;
}

/** A memory whose last calls make her the one doing the talking, so the run can check that
 *  the alert reaches the briefing (lib/talk talkAlert): three balanced calls, then a bad one. */
export function withTalkHistory(mem, shares = [0.41, 0.48, 0.45, 0.63]) {
  const sessions = shares.map((tutorShare, i) => ({
    id: 'h' + i, date: '2026-09-0' + (5 + i), topic: 'appel', source: 'causerie', minutes: 10, seconds: 580,
    analysis: null, tutorShare
  }));
  return { ...mem, sessions };
}
