/* The packs are written for Odile — she came first, and every string that names or
 * gestures at the tutor says her name, her pronoun, her endings. Rather than threading a
 * {{tutor}} placeholder through six hundred strings, the packs stay hers and this module
 * rewrites them for whoever actually takes the calls: exact, hand-audited phrase pairs
 * per language (never bare pronouns — «Elle a deux chats» in a cheat sheet must survive),
 * applied before the name itself is swapped. Grammar examples never match because every
 * pair is anchored to tutor-specific wording.
 *
 * Conventions: a masculine tutor gets the m table; a non-binary tutor gets the x table,
 * which prefers the name or the language's neutral pronoun where one exists (iel, they)
 * and otherwise follows the tutor's own stated usage (Nour: «le mot tuteur fait
 * l'affaire»). A feminine tutor needs no table at all — Odile's strings are already hers.
 */

export interface TutorIdentity {
  key: string;
  name: string;
  gender: 'f' | 'm' | 'x';
}

type Pair = [string, string];
interface Swaps {
  /** Applied for every non-Odile tutor, before anything else: French elisions that only
   *  work in front of a vowel («d’Odile» → «de Marcel»). All current names start with a
   *  consonant; a future vowel-initial tutor simply keeps the elision (no pair matches). */
  n?: Pair[];
  m: Pair[];
  x: Pair[];
}

const FR: Swaps = {
  n: [
    ['d’Odile', 'de Odile'], ["d'Odile", 'de Odile'],
    ['qu’Odile', 'que Odile'], ["qu'Odile", 'que Odile']
  ],
  m: [
    [', tutrice de conversation', ', tuteur de conversation'],
    ['une vraie interlocutrice, pas une assistante', 'un vrai interlocuteur, pas un assistant'],
    ['une bonne tutrice humaine', 'un bon tuteur humain'],
    ['sa tutrice', 'son tuteur'],
    ['Chaleureuse', 'Chaleureux'],
    ['un peu désabusée, mais discrètement bienveillante', 'un peu désabusé, mais discrètement bienveillant'],
    ['Elle guette', 'Il guette'],
    ['Elle reprend', 'Il reprend'],
    ['C’est elle qui t’a repris', 'C’est lui qui t’a repris'],
    ['Elle garde l’essentiel', 'Il garde l’essentiel'],
    ['Elle corrige en reformulant', 'Il corrige en reformulant'],
    ['Interromps-la quand tu veux', 'Interromps-le quand tu veux'],
    ['ce qu’elle entendrait', 'ce qu’il entendrait'],
    ['Ce qu’elle répond', 'Ce qu’il répond'],
    ['Qui tu es, pour elle', 'Qui tu es, pour lui'],
    ['et elle ne peut pas être interrompue', 'et il ne peut pas être interrompu']
  ],
  x: [
    [', tutrice de conversation', ', tuteur de conversation'],
    ['une vraie interlocutrice, pas une assistante', 'un vrai interlocuteur, pas un assistant'],
    ['une bonne tutrice humaine', 'un bon tuteur humain'],
    ['sa tutrice', 'son tuteur'],
    ['Chaleureuse', 'Chaleureux'],
    ['un peu désabusée, mais discrètement bienveillante', 'un peu désabusé·e, mais discrètement bienveillant·e'],
    ['Elle guette', 'Iel guette'],
    ['Elle reprend', 'Iel reprend'],
    ['C’est elle qui t’a repris', 'C’est iel qui t’a repris'],
    ['Elle garde l’essentiel', 'Iel garde l’essentiel'],
    ['Elle corrige en reformulant', 'Iel corrige en reformulant'],
    ['Interromps-la quand tu veux', 'Interromps Odile quand tu veux'],
    ['ce qu’elle entendrait', 'ce qu’iel entendrait'],
    ['Ce qu’elle répond', 'Ce qu’iel répond'],
    ['Qui tu es, pour elle', 'Qui tu es, pour iel'],
    ['et elle ne peut pas être interrompue', 'et iel ne peut pas être interrompu·e']
  ]
};

const EN: Swaps = {
  m: [
    ["She's listening for", "He's listening for"],
    ['She recasts it', 'He recasts it'],
    ['She pulled you up on this one.', 'He pulled you up on this one.'],
    ['You asked her for this word.', 'You asked him for this word.'],
    ['what she would be told', 'what he would be told'],
    ['Her replies', 'His replies'],
    ['Her voice', 'His voice'],
    ['in front of her', 'in front of him'],
    ['See her version', 'See his version'],
    ['She keeps the essentials', 'He keeps the essentials'],
    ['when she picks up', 'when he picks up'],
    ['She corrects by rephrasing', 'He corrects by rephrasing'],
    ['Interrupt her anytime', 'Interrupt him anytime'],
    ['shows her rephrasings', 'shows his rephrasings'],
    ['you wait for her answer, and she cannot be interrupted', 'you wait for his answer, and he cannot be interrupted'],
    ['gets her answer back', 'gets his answer back']
  ],
  x: [
    ["She's listening for", "They're listening for"],
    ['She recasts it', 'They recast it'],
    ['She pulled you up on this one.', 'They pulled you up on this one.'],
    ['You asked her for this word.', 'You asked them for this word.'],
    ['what she would be told', 'what they would be told'],
    ['Her replies', 'Their replies'],
    ['Her voice', 'Their voice'],
    ['in front of her', 'in front of them'],
    ['See her version', 'See their version'],
    ['She keeps the essentials', 'They keep the essentials'],
    ['when she picks up', 'when they pick up'],
    ['She corrects by rephrasing', 'They correct by rephrasing'],
    ['Interrupt her anytime', 'Interrupt them anytime'],
    ['shows her rephrasings', 'shows their rephrasings'],
    ['you wait for her answer, and she cannot be interrupted', 'you wait for their answer, and they cannot be interrupted'],
    ['gets her answer back', 'gets their answer back']
  ]
};

const ES: Swaps = {
  m: [
    [', tutora de conversación', ', tutor de conversación'],
    ['una interlocutora de verdad, no una asistente', 'un interlocutor de verdad, no un asistente'],
    ['su tutora', 'su tutor'],
    ['Cálida', 'Cálido'],
    ['Socarrona', 'Socarrón'],
    ['Lacónica, algo desencantada', 'Lacónico, algo desencantado'],
    ['Está atenta a', 'Está atento a'],
    ['Ella lo retoma', 'Él lo retoma'],
    ['Aquí te corrigió ella.', 'Aquí te corrigió él.'],
    ['Quién eres, para ella', 'Quién eres, para él'],
    ['no se la puede interrumpir', 'no se le puede interrumpir'],
    ['Interrúmpela cuando quieras', 'Interrúmpelo cuando quieras']
  ],
  x: [
    [', tutora de conversación', ', tutor de conversación'],
    ['una interlocutora de verdad, no una asistente', 'un interlocutor de verdad, no un asistente'],
    ['su tutora', 'su tutor'],
    ['Cálida', 'Cálido'],
    ['Socarrona', 'Socarrón'],
    ['Lacónica, algo desencantada', 'Lacónico, algo desencantado'],
    ['Está atenta a', 'Está atento a'],
    ['Ella lo retoma', 'Odile lo retoma'],
    ['Aquí te corrigió ella.', 'Aquí te corrigió Odile.'],
    ['Quién eres, para ella', 'Quién eres, para Odile'],
    ['no se la puede interrumpir', 'no se le puede interrumpir'],
    ['Interrúmpela cuando quieras', 'Interrumpe a Odile cuando quieras']
  ]
};

const IT: Swaps = {
  m: [
    ['una vera interlocutrice, non un’assistente', 'un vero interlocutore, non un assistente'],
    ['la sua tutor', 'il suo tutor'],
    ['Calorosa', 'Caloroso'],
    ['Laconica, un po’ disincantata, ma discretamente benevola', 'Laconico, un po’ disincantato, ma discretamente benevolo'],
    ['Sta attenta a', 'Sta attento a'],
    ['Lei riprende', 'Lui riprende'],
    ['Qui ti ha ripreso lei.', 'Qui ti ha ripreso lui.'],
    ['Le hai chiesto questa parola.', 'Gli hai chiesto questa parola.'],
    ['Chi sei, per lei', 'Chi sei, per lui'],
    ['ciò che le verrebbe detto', 'ciò che gli verrebbe detto'],
    ['non puoi interromperla', 'non puoi interromperlo'],
    ['Interrompila quando vuoi', 'Interrompilo quando vuoi']
  ],
  x: [
    ['una vera interlocutrice, non un’assistente', 'un vero interlocutore, non un assistente'],
    ['la sua tutor', 'il suo tutor'],
    ['Calorosa', 'Caloroso'],
    ['Laconica, un po’ disincantata, ma discretamente benevola', 'Laconico, un po’ disincantato, ma discretamente benevolo'],
    ['Sta attenta a', 'Sta attento a'],
    ['Lei riprende', 'Odile riprende'],
    ['Qui ti ha ripreso lei.', 'Qui ti ha ripreso Odile.'],
    ['Le hai chiesto questa parola.', 'Hai chiesto a Odile questa parola.'],
    ['Chi sei, per lei', 'Chi sei, per Odile'],
    ['ciò che le verrebbe detto', 'ciò che verrebbe detto a Odile'],
    ['non puoi interromperla', 'non puoi interrompere Odile'],
    ['Interrompila quando vuoi', 'Interrompi Odile quando vuoi']
  ]
};

const PT: Swaps = {
  /* Portuguese puts an article in front of the name, and the article carries the gender:
   * «A Odile relê» → «O Marcel relê». The pairs are ordered so the contracted forms go
   * first and the bare-article ones cannot re-match their output. */
  m: [
    ['à Odile', 'ao Odile'],
    ['da Odile', 'do Odile'],
    ['A Odile', 'O Odile'],
    [' a Odile', ' o Odile'],
    [', tutora de conversação', ', tutor de conversação'],
    ['uma interlocutora a sério, não uma assistente', 'um interlocutor a sério, não um assistente'],
    ['a tutora dele', 'o tutor dele'],
    ['Calorosa', 'Caloroso'],
    ['Seca e irónica', 'Seco e irónico'],
    ['Lacónica, um pouco desencantada, mas discretamente atenciosa', 'Lacónico, um pouco desencantado, mas discretamente atencioso'],
    ['Ela repara em', 'Ele repara em'],
    ['Ela retoma', 'Ele retoma'],
    ['Aqui foi ela que te corrigiu.', 'Aqui foi ele que te corrigiu.'],
    ['Quem tu és, para ela', 'Quem tu és, para ele'],
    ['As respostas dela', 'As respostas dele'],
    ['A voz dela', 'A voz dele'],
    ['Ver a versão dela', 'Ver a versão dele'],
    ['pela resposta dela e não a podes interromper', 'pela resposta dele e não o podes interromper']
  ],
  x: [
    ['Liga à Odile', 'Liga a Odile'],
    ['Ligar à Odile', 'Ligar a Odile'],
    ['contaste à Odile', 'contaste a Odile'],
    ['da Odile', 'de Odile'],
    [': a Odile espera', ': Odile espera'],
    ['És a Odile', 'És Odile'],
    ['A Odile', 'Odile'],
    [', tutora de conversação', ', tutor de conversação'],
    ['uma interlocutora a sério, não uma assistente', 'um interlocutor a sério, não um assistente'],
    ['a tutora dele', 'o tutor dele'],
    ['Calorosa', 'Caloroso'],
    ['Seca e irónica', 'Seco e irónico'],
    ['Lacónica, um pouco desencantada, mas discretamente atenciosa', 'Lacónico, um pouco desencantado, mas discretamente atencioso'],
    ['Ela repara em', 'Odile repara em'],
    ['Ela retoma', 'Odile retoma'],
    ['Aqui foi ela que te corrigiu.', 'Aqui foi Odile que te corrigiu.'],
    ['Quem tu és, para ela', 'Quem tu és, para Odile'],
    ['As respostas dela', 'As respostas de Odile'],
    ['A voz dela', 'A voz de Odile'],
    ['Ver a versão dela', 'Ver a versão de Odile'],
    ['pela resposta dela e não a podes interromper', 'pela resposta de Odile, que não podes interromper']
  ]
};

const DE: Swaps = {
  /* German genitive comes free: the name swap turns «Odiles Art» into «Marcels Art». */
  m: [
    ['Sie achtet auf', 'Er achtet auf'],
    ['Sie wiederholt es', 'Er wiederholt es'],
    ['Da hat sie dich korrigiert.', 'Da hat er dich korrigiert.'],
    ['Sie behält das Wesentliche', 'Er behält das Wesentliche'],
    ['wenn sie abnimmt', 'wenn er abnimmt'],
    ['was sie heute hören würde', 'was er heute hören würde'],
    ['Ihre Antworten', 'Seine Antworten'],
    ['Ihre Stimme', 'Seine Stimme'],
    ['Ihre Version zeigen', 'Seine Version zeigen'],
    ['Wer du für sie bist', 'Wer du für ihn bist'],
    ['auf ihre Antwort', 'auf seine Antwort'],
    ['Sie korrigiert durch Umformulieren', 'Er korrigiert durch Umformulieren'],
    ['Unterbrich sie jederzeit', 'Unterbrich ihn jederzeit'],
    ['zeigt ihre Umformulierungen', 'zeigt seine Umformulierungen']
  ],
  x: [
    ['Sie achtet auf', 'Odile achtet auf'],
    ['Sie wiederholt es', 'Odile wiederholt es'],
    ['Da hat sie dich korrigiert.', 'Da hat Odile dich korrigiert.'],
    ['Sie behält das Wesentliche', 'Odile behält das Wesentliche'],
    ['wenn sie abnimmt', 'wenn Odile abnimmt'],
    ['was sie heute hören würde', 'was Odile heute hören würde'],
    ['Ihre Antworten', 'Odiles Antworten'],
    ['Ihre Stimme', 'Odiles Stimme'],
    ['Ihre Version zeigen', 'Odiles Version zeigen'],
    ['Wer du für sie bist', 'Wer du für Odile bist'],
    ['auf ihre Antwort', 'auf Odiles Antwort'],
    ['Sie korrigiert durch Umformulieren', 'Odile korrigiert durch Umformulieren'],
    ['Unterbrich sie jederzeit', 'Unterbrich Odile jederzeit'],
    ['zeigt ihre Umformulierungen', 'zeigt Odiles Umformulierungen']
  ]
};

export const TUTOR_SWAPS: Record<string, Swaps> = { fr: FR, en: EN, es: ES, it: IT, pt: PT, de: DE };

/** Rewrite one string for the given tutor: gender pairs, then elision fixes, then the
 *  name. Exported alone so a test can drive it string by string. */
export function swapTutorString(s: string, lang: string, t: TutorIdentity): string {
  if (t.key === 'odile' || !s.includes('Odile') && t.gender === 'f') return s;
  const table = TUTOR_SWAPS[lang];
  let out = s;
  if (table && t.gender !== 'f') {
    for (const [a, b] of table[t.gender]) out = out.split(a).join(b);
  }
  if (table?.n) for (const [a, b] of table.n) out = out.split(a).join(b);
  return out.split('Odile').join(t.name);
}

/** Deep-rewrite a pack (or any value from one) for a tutor: strings are swapped, arrays
 *  and plain objects are rebuilt, functions are wrapped so what they RETURN is rewritten
 *  too (the packs are full of (n) => `Odile …` templates). Everything else passes through. */
export function tutorize<T>(value: T, lang: string, t: TutorIdentity): T {
  if (t.key === 'odile') return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return swapTutorString(v, lang, t);
    if (typeof v === 'function') {
      const fn = v as (...a: unknown[]) => unknown;
      return (...a: unknown[]) => walk(fn(...a));
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && (v as object).constructor === Object) {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
