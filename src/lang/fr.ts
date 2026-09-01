import type { CheatSheet, LangPack } from './types';
import { compF, compG, compV } from './types';

/* ============================== FRANÇAIS ==============================
   Canonical pack: `UIStrings` is inferred from THIS ui object, so every other
   language pack must provide exactly these keys (compile-time parity). */

const ui = {
  nav: { today: 'Aujourd’hui', cards: 'Cartes', memory: 'Mémoire', settings: 'Réglages' },
  skills: { grammar: 'grammaire', vocabulary: 'vocabulaire', fluency: 'aisance', comprehension: 'compréhension' },
  status: { new: 'nouveau', persisting: 'tenace', improving: 'en progrès', resolved: 'acquis' },
  factCats: { arbeit: 'Travail', familie: 'Famille', alltag: 'Quotidien', vorlieben: 'Goûts', orte: 'Lieux', sonstiges: 'Divers' },
  periods: { week: 'Bilan de la semaine', month: 'Bilan du mois', quarter: 'Bilan du trimestre' },
  admin: {
    title: 'Utilisateurs', users: 'comptes', active7: 'actifs (7 j)', calls: 'appels',
    callMin: 'min d’appel', reviews: 'révisions', logins: 'connexions', days: 'jours actifs',
    who: 'Compte', signedUp: 'Inscrit', lastSeen: 'Vu la dernière fois',
    empty: 'Aucune activité enregistrée pour l’instant.',
    unavailable: 'Journal indisponible : la table user_events n’existe pas encore, ou ce compte n’a pas le droit de la lire.',
    note: '* date du premier événement, faute de date d’inscription enregistrée. Les minutes comptent le temps passé en appel et en révision, pas le temps avec l’application ouverte.',
    open: 'Utilisateurs (admin)'
  },
  common: {
    close: 'Fermer', cancel: 'Annuler', back: 'Retour', save: 'Enregistrer', del: 'Supprimer',
    search: 'Chercher…', listen: 'Écouter', moment: 'Un instant…', retry: 'Réessayer', done: 'Terminé',
    copy: 'Copier', copied: 'Copié.', load: 'Charger', see: 'Voir', settle: 'Régler', min: 'min',
    edit: 'Modifier', loading: 'Chargement…',
    undo: 'Annuler', audioFail: 'Audio indisponible. Réessaie.'
  },
  app: {
    analyzingTitle: 'Odile relit ta conversation…', analyzingSub: 'Conseils, niveau, nouvelles cartes.',
    verbatimStage: 'Transcription fidèle de ton micro, fautes comprises…',
    thinkingStage: 'Odile réfléchit…', writingStage: (pct: number) => `L’analyse s’écrit — ${pct} %`,
    failTitle: 'Analyse échouée', failSub: 'La conversation n’est pas perdue.', keepTranscript: 'Garder la transcription',
    analyzeFailToast: (msg: string) => 'Analyse échouée : ' + msg, authExpired: 'accès expiré.',
    synced: 'Synchronisé depuis l’autre appareil.', transcriptKept: 'Transcription gardée.', savedNoAnalysis: 'Enregistré sans analyse.',
    dropNothing: 'Connexion perdue, rien d’enregistré.', emptyNothing: 'Rien d’enregistré.',
    updateReady: 'Nouvelle version disponible.', updateReload: 'Recharger',
    crashTitle: 'Cet écran n’a pas pu s’afficher',
    crashSub: 'Ta conversation est enregistrée — c’est cet écran qui n’arrive pas à la lire.',
    crashBack: 'Retour'
  },
  today: {
    backlogLine: (n: number, days: number) => `${n} nouvelles en attente, environ ${days} jours`,
    roundOf: (n: number, of: number) => `séance ${n}/${of}`,
    roundExtra: (n: number) => `séance ${n} · en plus`,
    rhythmLine: (perDay: number, rounds: number) => `${perDay} nouvelles cartes par jour · ${rounds} ${rounds === 1 ? 'séance' : 'séances'}`,
    level: 'Niveau', missingAccess: (what: string) => `Accès manquant : ${what}.`, accessCode: 'code d’accès', apiKey: 'clé OpenAI',
    noServerKey: 'Clé OpenAI absente du serveur (Netlify → OPENAI_API_KEY), ou passe sur « Ma clé » dans les réglages.',
    twoMinutes: '2 minutes', doCheckin: 'Faire le point',
    introChip: (n: number) => `Faire connaissance ${n}/3`, introSub: 'Odile apprend qui tu es et établit ton niveau.',
    yourCall: (min: number) => `Ta conversation · ${min} min`, proposes: 'Odile propose', yourTopic: 'ton sujet',
    forYourLevel: 'pour ton niveau', interestsYou: 'ça t’intéresse',
    otherIdea: 'Autre idée', freeTopic: 'Sujet libre', freePlaceholder: 'De quoi veux-tu parler ?',
    callAgain: 'Appelle Odile', callOdile: 'Appeler Odile', freeConversation: 'Conversation libre',
    eveningReview: 'Ta révision', due: 'à revoir', fresh: 'nouvelles', total: 'au total',
    nothingToReview: 'Rien à réviser', cardsTonight: (n: number) => `Apprendre le vocabulaire (${n})`,
    warmup: 'Échauffement : 3 cartes avant l’appel',
    warmupShort: 'Échauffement · 3',
    seeCards: 'Modifier les cartes',
    moreActivities: 'Autres activités',
    xpWeek: (n: number, g: number) => `${n} / ${g} XP cette semaine`,
    xpWeekUp: (n: number) => `${n} XP · montée assurée`,
    xpWeekHeld: (n: number) => `${n} XP · rang gardé`,
    xpTotalOf: (n: number, next: number) => `${n} XP en tout depuis le début · prochain palier ${next}`,
    reviewTitle: 'Réviser',
    watchesLead: (n: number) => `Elle guette ${n === 1 ? 'une chose' : n === 2 ? 'deux choses' : n === 3 ? 'trois choses' : `${n} choses`} : `,
    nCards: (n: number) => `${n} ${n === 1 ? 'carte' : 'cartes'}`,
    bornOf: (d: string) => `née de ton appel du ${d}`,
    startReview: 'Commencer',
    daysRow: (n: number) => `${n} ${n === 1 ? 'jour' : 'jours'}`,
    daysMissed: (n: number) => `${n} ${n === 1 ? 'jour sauté' : 'jours sautés'}`,
  },
  call: {
    goalKicker: 'Place ce mot', goalDone: 'Placé', goalHit: (w: string) => `« ${w} » placé.`,
    micStage: 'Micro…', connecting: 'Connexion…', configuring: 'Un instant…', readsSheet: 'te laisse lire',
    speaks: 'parle', listens: 't’écoute', yourTurn: 'à toi',
    pause: 'Pause', resume: 'Reprendre', pausedState: 'en pause', pausedNote: 'Odile attend. Le temps ne court plus.',
    mute: 'Couper le micro', muted: 'Coupé', mic: 'Micro', hangup: 'Raccrocher', captions: 'Sous-titres',
    sheet: 'Fiche', sheets: 'Fiches', resumeCall: 'Reprendre l’appel',
    thinks: 'réfléchit', turnDone: 'J’ai fini', turnSpeak: 'Parler', turnSkip: 'Passer',
    connFailed: (msg: string) => 'Connexion échouée : ' + msg, connLost: 'Connexion perdue.', autoEnded: 'Odile a raccroché.', echoHeard: 'L’appel s’entend lui-même — un casque serait mieux. Odile s’adapte.'
  },
  review: {
    wordsPlaced: 'mots placés',
    costTitle: 'Ce que cet appel a coûté', costTotal: 'Total',
    briefingTitle: 'Ce qu’Odile avait sous les yeux',
    briefingNote: 'Le briefing exact de cet appel, tel qu’il était ce jour-là. Celui des réglages montre ce qu’elle entendrait aujourd’hui, ce qui n’est pas la même chose.',
    costLeg: { stt: 'Ce que tu as dit', chat: 'Ce qu’elle répond', tts: 'Sa voix', realtime: 'Conversation', captions: 'Sous-titres en direct', verbatim: 'Transcription fidèle', analysis: 'Analyse' } as Record<string, string>,
    costPer10: (t: string) => `soit ${t} pour dix minutes`,
    costNote: 'Estimation, calculée sur les tarifs OpenAI au moment de l’appel.',
    yourConversation: 'Votre conversation', toRemember: 'À RETENIR', duration: 'durée', yourWords: 'tes mots',
    tips: 'conseils', praise: 'très bien', estLevel: 'Niveau estimé', dayTargets: 'Objectifs du jour',
    transcriptTips: 'Transcription & conseils', tip: 'CONSEIL', better: 'Mieux :', great: 'TRÈS BIEN',
    verbatimTitle: 'Ce que tu as dit, mot à mot', verbatimNote: 'Ton micro, retranscrit d’un seul tenant, fautes comprises. Les bulles ci-dessus viennent du sous-titrage live, qui coupe et lisse.',
    starActive: '★ En tête ce soir', starCard: '☆ Prioriser la carte', makeCard: '☆ En faire une carte',
    starTitle: 'La carte passe en tête de ta prochaine révision',
    imgChange: '🖼 Changer l’image', imgAdd: '🖼 Ajouter une image', imgTitle: 'Ajouter une image à la carte',
    newCards: (n: number) => `${n} ${n === 1 ? 'nouvelle carte' : 'nouvelles cartes'}`, newVocab: 'Nouveaux mots', vocabHasCard: 'Carte créée', vocabMakeCard: 'Créer la carte', vocabRemoveCard: 'Retirer les cartes', vocabCardsRemoved: (n: number) => `${n} ${n === 1 ? 'carte retirée' : 'cartes retirées'}.`,
    noAnalysis: 'Pas d’analyse pour cette conversation', duoImport: ' (import Duolingo)', continue: 'Continuer',
    noticeTitle: 'Qu’a changé Odile ?', noticeShow: 'Voir sa version',
    tipsTitle: 'Conseils', praiseTitle: 'Ce qui a bien marché',
    noVocab: 'Aucun mot nouveau dans cette conversation.',
    turnCards: (n: number) => `${n} ${n === 1 ? 'carte' : 'cartes'}`, turnCardsTitle: 'Cette phrase a donné des cartes',
    wpmLine: (n: number) => `${n} mots/min`,
    yourShare: 'ta part de parole',
    sceneTitle: 'La revue', nextTime: 'La prochaine fois', backToCall: 'Retour à la conversation',
    callOf: (min: number, d: string) => `Appel de ${min} min · ${d}`,
    panelYou: 'Toi', panelHer: 'Elle reprend', panelOut: 'Ce qui en sort',
  },
  flu: {
    title: 'Fluidité 4/3/2',
    offer: 'Raconte la conversation du jour, trois fois, de plus en plus vite.',
    explain: 'Trois tours : 60, 45, puis 30 secondes. La même histoire à chaque fois — moins de temps, plus d’aisance.',
    round: (n: number, s: number) => `Tour ${n} · ${s} s`,
    start: 'Parler', stopEarly: 'J’ai fini', recording: 'Je t’écoute…', transcribing: 'Transcription…',
    results: 'Ton débit', mots: 'mots', wpm: 'mots/min',
    failMic: 'Micro indisponible.', later: 'Plus tard',
    praiseUp: 'Plus vite à chaque tour. C’est le but.', praiseFlat: 'Bien. La vitesse viendra en répétant.'
  },
  story: {
    title: 'Histoire du jour', sub: 'Deux minutes d’écoute, écrites pour toi',
    make: 'Écouter l’histoire du jour', making: 'Odile écrit ton histoire…',
    play: 'Écouter', stop: 'Arrêter', fail: 'Pas d’histoire pour l’instant. Réessaie.',
    questions: 'Une question par paragraphe :',
    newOne: 'Nouvelle histoire',
    showText: 'Voir le texte', hideText: 'Masquer le texte',
    tapHint: 'Touche ce que tu ne comprends pas : traduction, et cartes si tu veux.',
    listenFirst: 'Les questions arrivent au fil de l’écoute…',
    right: 'Exact !',
    wrongWas: (bonne: string) => `Non — c’était : ${bonne}`,
    para: (i: number) => `Paragraphe ${i}`,
    noTrans: 'Traduction impossible. Réessaie.',
    score: (g: number, n: number) => `${g}/${n} bonnes réponses`
  },
  rev: {
    typeCloze: 'Complète', typeToNative: 'Ça veut dire ?', typeToTarget: (lang: string) => `En ${lang} ?`,
    finishedTitle: 'Révision terminée', doneCards: (n: number) => `${n} ${n === 1 ? 'carte' : 'cartes'}. Bon.`, nothing: 'Rien à réviser.',
    sessionLine: (known: number, hard: number, again: number, xp: number) => `${known} ${known === 1 ? 'sue' : 'sues'} · ${hard} ${hard === 1 ? 'difficile' : 'difficiles'} · ${again} ${again === 1 ? 'retravaillée' : 'retravaillées'} · +${xp} XP`,
    finish: 'Terminer', hint: 'Indice :', speakAloud: 'Réponds à voix haute, puis retourne.', flip: 'Retourner',
    personalize: 'Personnaliser (image)',
    grades: { again: 'Encore', hard: 'Difficile', good: 'Bien', easy: 'Facile' },
    now: 'tout de suite', dayN: (n: number) => (n === 1 ? '1 jour' : `${n} jours`),
    recordAnswer: 'S’enregistrer', replayAnswer: 'Réécouter ta réponse',
    fromCall: (d: string) => `Ta phrase du ${d}`, askedWord: (d: string) => `Mot du ${d}`,
    sheRecast: 'C’est elle qui t’a repris là-dessus.', youAsked: 'Tu lui as demandé ce mot.',
  },
  pace: {
    title: 'Tu suis le rythme ?',
    growing: (n: string) => `La pile grandit de ${n} cartes par jour.`,
    clearing: (n: string) => `La pile diminue de ${n} cartes par jour.`,
    level: 'Cartes créées et cartes portées s’équilibrent.',
    idle: 'Aucune carte et aucune révision cette semaine.',
    keyMade: 'créées', keyCarry: 'ce que tu portes', keyOver: 'plus créées que portées',
    waiting: (n: number) => `${n} en attente`,
    clearIn: (d: number) => `résorbée en ${d} jours environ`,
    neverClear: 'à ce rythme tu ne rattrapes pas',
    basis: (a: string, r: string) => `Sur les 7 derniers jours : ${a} nouvelles cartes par jour, ${r} révisions par jour.`,
    estimate: 'Le nombre de cartes commencées vient seulement d’être compté — estimé avant cela.',
    addedN: (n: number) => `${n} créées`,
    reviewsN: (n: number) => `${n} révisées`
  },
  cards: {
    title: 'Cartes', review: 'Réviser', nothingToReview: 'Rien à réviser', due: 'à revoir', fresh: 'nouvelles',
    active: 'actives', typeCloze: 'Trou', newCard: 'nouvelle', forDate: (d: string) => 'pour le ' + d,
    days: 'j', missed: (n: number) => `${n}× ratée`,
    empty: 'Pas encore de cartes. Elles naîtront de tes conversations.', lastReviews: 'Dernières révisions',
    reviewLine: (total: number, known: number, xp: number) => `${total} ${total === 1 ? 'carte' : 'cartes'} · ${known} ${known === 1 ? 'sue' : 'sues'} · +${xp} XP`,
    batchNew: (n: number) => `Cette session (${n})`, batchRest: 'Le reste', batchChip: 'NOUVEAU',
    matureNote: 'Acquise = intervalle de 21 jours ou plus.', emptyFiltered: 'Rien dans ce filtre.',
    deletedToast: 'Carte supprimée.', resume: (d: number, t: number) => `Reprendre ${d}/${t}`,
    f: {
      all: 'Toutes', learning: 'En cours', learned: 'Acquises',
      lastKnown: 'sue', lastMissed: 'ratée',
      sort: 'Tri', byDue: 'échéance', byStatus: 'statut', byDifficulty: 'difficulté',
      stageLearning: 'en cours', stageLearned: 'acquise'
    }
  },
  checkin: {
    rankWeeks: (up: number, down: number, held: number) => `${up} montée(s), ${held} tenue(s), ${down} chute(s)`,
    rankNeeds: (hold: number, climb: number) => `${hold} XP pour tenir · ${climb} pour monter`,
    laterBtn: 'Plus tard', calls: 'appels', minutes: 'minutes', cardsKnown: 'cartes sues', level: 'niveau',
    working: 'Odile fait le point…', unavailable: (e: string) => `Bilan indisponible : ${e}`,
    moved: 'ÇA A BOUGÉ', toWork: 'À TRAVAILLER', proposal: 'Proposition :', noted: 'C’est noté',
    steer: 'Tes choix orientent les appels de la prochaine période.',
    savedDirection: 'Cap noté. On garde le rythme.', savedPlain: 'Bilan noté.'
  },
  memory: {
    title: 'Mémoire', savedServer: 'sauvegardée sur le serveur', savedLocal: 'dans ce navigateur uniquement',
    intro: 'Tout ce qu’Odile sait de toi. Chaque entrée se lit, se modifie, s’efface.',
    tabs: { over: 'Aperçu', comp: 'Carte', prog: 'Progrès', carnet: 'Carnet', sess: 'Conversations', adv: 'Avancé' },
    tabsOld: { gaps: 'Lacunes', str: 'Points forts', facts: 'Faits', voc: 'Vocabulaire', brief: 'Briefing', data: 'Données' },
    portraitTitle: 'Qui tu es, pour elle',
    portraitNote: 'Ce qu’Odile a en tête en décrochant. Les faits qui reviennent d’un appel à l’autre font le portrait ; les autres ne passent qu’en anecdote.',
    levelCefr: 'NIVEAU (CECR)', reliability: 'Fiabilité', establishing: 'Établi pendant les trois premiers appels.',
    skillsTitle: 'Compétences', progress: 'Progression', weeklyCheckin: 'Faire le point (semaine)',
    streakDays: 'jours de suite', conversations: 'conversations', minutes: 'minutes',
    yourTopics: 'Tes sujets', noTopics: 'Encore rien. Ça viendra en parlant.',
    matrixIntro: 'Ton niveau est fait d’îlots, pas d’une ligne. Chaque case est une compétence précise ; Odile sonde les cases grises sous ton niveau et note les îlots au-dessus.',
    catGrammar: 'Grammaire', catVocab: 'Vocabulaire', catSpeak: 'Parler',
    noData: 'Pas encore de données. Odile le sondera mine de rien.',
    acquired: 'Acquis', toWorkOn: 'À travailler', partial: 'Partiel', seenOn: 'vu le',
    legendOk: 'acquis', legendKo: 'à travailler', legendPartial: 'partiel', legendNone: 'pas de données',
    pinNext: 'Travailler ça au prochain appel', pinned: '✓ Prévu au prochain appel — annuler',
    pinnedToast: 'Au programme du prochain appel.', markAcquired: 'Marquer acquis', clearData: 'Effacer la donnée',
    nextCall: 'Au prochain appel :',
    gapsLine: (open: number, done: number) => `${open} ouvertes · ${done} acquises. Les lacunes ouvertes deviennent les objectifs du prochain appel.`,
    seenFirst: 'vue le', seenLast: 'dernière fois', workedTimes: 'travaillée', examples: 'Exemples',
    markGapAcquired: 'Marquer acquise', forget: 'Oublier', noGaps: 'Aucune lacune notée pour l’instant.',
    strengthTag: '✓ point fort', noStrengths: 'Rien encore. Ça viendra.',
    factsIntro: 'Ce que tu as raconté à Odile. Elle garde l’essentiel et s’en sert pour de vraies questions.',
    saidOn: 'dit le', saidAgain: 'redit le', noFacts: 'Rien encore. Ça viendra en parlant.',
    noVocabFound: 'Rien trouvé.', vocabCount: (n: number) => `${n} mots. Odile en ressort d’anciens de temps en temps.`,
    importTag: '✉ import · ', noSessions: 'Pas encore de conversations.',
    briefIntro: 'Exactement ce qu’Odile recevra au prochain appel — sujet, niveau et objectifs venant de l’app. Rien d’autre.',
    editTemplate: 'Modifier le modèle', customTemplate: 'modèle personnalisé', variables: 'Variables :',
    varWhat: 'Que contient chaque variable ?', reset: 'Réinitialiser', briefSaved: 'Briefing enregistré.',
    varGloss: {
      name: 'prénom', native: 'langue maternelle', langue: 'langue cible', niveau: 'niveau estimé',
      competences: 'détail par compétence', confiance: 'fiabilité de l’estimation', bande: 'bande A1–C2',
      persona: 'caractère d’Odile', aujourdhui: 'bloc du sujet du jour', minutes: 'durée prévue',
      objectifs: 'objectifs du jour', sondages: 'compétences sondées', cap: 'cap de la période',
      faits: 'faits personnels', interets: 'centres d’intérêt', faiblesses: 'points faibles', passe: 'conversations passées'
    } as Record<string, string>,
    exportJson: 'Export (JSON)', importBtn: 'Import', rawJson: 'JSON brut', closeEditor: 'Fermer l’éditeur',
    forgetAll: 'Tout oublier', forgetAllConfirm: 'Tout oublier ? Cela efface ce profil sur cet appareil ET sa copie serveur.',
    serverWipeFailed: 'La copie serveur n’a pas pu être effacée (hors ligne ?). Effacer quand même localement ?',
    entryForgotten: 'Entrée oubliée.',
    applySave: 'Valider & enregistrer', importedToast: 'Mémoire importée.', savedToast: 'Enregistré.',
    invalidJson: (msg: string) => 'JSON invalide : ' + msg, unknownFormat: 'format inconnu',
    dataNoteSynced: 'Copie locale + serveur. Export/Import pour tout emporter ailleurs.',
    dataNoteLocal: 'Stockée dans ce navigateur. Export/Import pour changer d’appareil.',
    levelChartEmpty: 'Ta courbe de niveau apparaîtra après quelques conversations.', levelChartLabel: 'Progression du niveau',
    monthScenes: (n: number) => `${n} ${n === 1 ? 'scène' : 'scènes'}`,
    monthMoved: 'Ce qui a bougé', monthEmpty: 'Rien encore ce mois-ci. La grille se remplit en parlant.',
    legendCall: 'appel', legendBoth: 'appel + cartes', legendToday: 'aujourd’hui',
    cardsBorn: 'cartes nées de tes appels', wpmLabel: 'mots par minute',
    wpmPrev: (n: number) => `(${n} le mois dernier)`,
  },
  profiles: {
    languages: 'Langues', addLanguage: 'Ajouter une langue',
    title: 'Profils', intro: 'Chaque profil a sa mémoire, son niveau et ses cartes. Odile ne confond personne.',
    active: 'actif', since: 'depuis', rename: 'Renommer', renamePrompt: 'Nouveau prénom :',
    deleteConfirm: (name: string) => `Supprimer le profil « ${name} », mémoire et cartes comprises ?`,
    newProfile: 'Nouveau profil', backupTitle: 'Sauvegarde & autres appareils',
    accountSaved: (email: string) => `Ce profil est sauvegardé en continu sur ton compte (${email}). Connecte-toi sur un autre appareil et il t’attend.`,
    onAccount: 'Sur le compte', thisOne: '(celui-ci)', lastActivity: 'dernière activité', profileWord: 'Profil',
    loadFailed: 'Chargement échoué.', loaded: (name: string) => 'Profil chargé : ' + name,
    switched: 'Profil changé.', noMemory: 'Ce profil n’a pas encore de mémoire.',
    syncOn: 'Tout ce profil (conversations, mémoire, cartes) est sauvegardé en continu sur le serveur. Sur un autre appareil, entre ce code sous « Profils » pour continuer là-bas :',
    syncOff: 'Couper la sauvegarde serveur (cet appareil seulement)',
    syncDisabled: 'Sauvegarde serveur coupée : les données restent dans ce navigateur.',
    syncEnable: 'Activer la sauvegarde serveur', syncNeedsServer: 'Accès serveur requis',
    syncActive: 'Sauvegarde serveur active.', syncUnavailable: 'Indisponible (accès serveur requis).',
    syncFailed: 'Sauvegarde serveur : échec. Réessaie.',
    loadFrom: 'Charger un profil depuis un autre appareil :', noProfileCode: 'Aucun profil sous ce code.'
  },
  settings: {
    sessionsPerDay: 'Séances par jour', auto: 'Auto',
    rhythmNote: (perDay: number, capacity: number) => `Environ ${perDay} nouvelles cartes par jour : c’est ce que ${capacity} révisions quotidiennes peuvent porter sans que la pile grossisse. Les conversations n’en fabriquent pas plus.`,
    title: 'Réglages', account: 'Compte', connected: 'Connecté', signOut: 'Se déconnecter', signedOut: 'Déconnecté.',
    signInGoogle: 'Continuer avec Google', signInHint: 'Connecte-toi pour retrouver tes profils partout.',
    openaiKey: 'Clé OpenAI', viaAccount: 'Via le compte', ownKeyDirect: 'Ma clé (directe)', accountKey: 'Clé du compte',
    keyIfAsked: 'sk-… (si demandée)', keySaved: 'Clé enregistrée sur ton compte.', keySaveFailed: 'Enregistrement échoué.',
    allowlistNote: 'Les adresses autorisées utilisent la clé du serveur. Les autres comptes enregistrent ici leur propre clé, utilisée à leur place.',
    access: 'Accès', serverCode: 'Serveur (code d’accès)', myKey: 'Ma clé',
    noServerKeySet: 'Pas de OPENAI_API_KEY sur le serveur (Netlify → Environment variables).',
    accessCodeLabel: 'Code d’accès', verify: 'Vérifier', codeWrong: 'Code incorrect.', codeOk: 'Code accepté.',
    modeDirect: 'Mode', modeDirectValue: 'Direct (ta clé, dans ce navigateur)', testKey: 'Tester',
    keyWorks: 'La clé fonctionne.', keyRefused: (s: number) => `OpenAI refuse la clé (${s}).`, netError: 'Erreur réseau.',
    ownKeyTitle: 'Ta clé (directe)', ownKeyNote: 'Reste dans ce navigateur ; les appels partent directement chez OpenAI.',
    rhythm: 'Rythme quotidien', callLength: 'Durée de l’appel', cardsPerEvening: 'Cartes par session', newOf: 'dont nouvelles',
    cardAudio: 'Audio des cartes', yes: 'oui', no: 'non', introPhase: 'Faire connaissance', skipPhase: 'Passer cette phase',
    profileTitle: 'Profil', firstName: 'Prénom', targetLang: 'Langue cible', motherTongue: 'Langue maternelle',
    odileStyle: 'Style d’Odile', deadpan: 'Pince-sans-rire', warm: 'Chaleureuse', profilesSync: 'Profils & synchronisation', manage: 'Gérer',
    voiceCall: 'Voix & appel', voice: 'Voix', speed: 'Débit', patience: 'Patience d’écoute',
    patienceHigh: 'grande', patienceMid: 'moyenne', patienceLow: 'petite', captions: 'Sous-titres permanents',
    callModel: 'Modèle d’appel', callModelStd: 'standard', callModelMini: 'économique',
    callModelNote: 'Le modèle économique coûte environ quatre fois moins cher, mais il repère moins bien tes fautes pendant la conversation. Le standard reste conseillé.',
    engine: 'Moteur d’appel', engineRealtime: 'temps réel', engineTurns: 'tour par tour',
    engineNote: 'Tour par tour : tu parles, tu attends sa réponse, et elle ne peut pas être interrompue. La conversation coûte environ six fois moins cher et le modèle qui la mène suit mieux la consigne, mais il lit une transcription — il n’entend jamais ton accent. Le temps réel reste le mode normal.',
    modelTurn: 'Modèle tour par tour',
    turnCommit: 'Fin de ton tour', turnCommitAuto: 'au silence', turnCommitButton: 'au bouton',
    turnCommitNote: 'Au silence, ton tour se termine tout seul après une pause, et c’est ta patience d’écoute qui la mesure : « petite » rend la réponse presque une seconde plus rapide, « grande » te laisse chercher tes mots. Au bouton, seul ton appui y met fin.',
    audioEnv: 'Audio & environnement', audioAutoNote: 'Le micro et le bruit se règlent tout seuls. Si l’appel s’entend lui-même — téléphone sur haut-parleur — il le remarque et change de réglage. Le casque reste le mieux.', noiseReduction: 'Réduction de bruit', nrOff: 'non', nrNear: 'casque', nrFar: 'pièce',
    noisyEnv: 'Environnement bruyant', envNormal: 'normal', envStrict: 'strict',
    strictNote: '« Strict » ne réagit qu’à une parole nette, pas à chaque bruit. Ta patience d’écoute s’applique dans les deux modes.',
    verbatim: 'Transcription fidèle',
    verbatimNote: 'Après l’appel, ton micro est retranscrit mot à mot, fautes comprises. L’analyse juge tes fautes sur cette version, pas sur le sous-titrage lissé.',
    models: 'Modèles', modelCall: 'Conversation', modelAnalysis: 'Analyse', modelTranscribe: 'Transcription live',
    footer: 'Causerie · L’appel passe directement entre ton navigateur et OpenAI (WebRTC). Transcriptions, mémoire et cartes restent sur ton appareil, avec copie serveur quand l’accès serveur est actif (réglable dans Profils).',
    natives: { de: 'Allemand', en: 'Anglais' } as Record<'de' | 'en', string>,
    uiLang: 'Langue de l’interface', uiAuto: 'auto', uiTargetOpt: 'langue cible', uiSupportOpt: 'langue maternelle',
    uiLangNote: 'Auto : l’interface passe à la langue cible à partir de B1.',
    speakAnswers: 'Réponse parlée', speakAnswersNote: 'Enregistre ta réponse à voix haute avant de retourner la carte, puis compare.',
    version: 'Version', versionRunning: 'Version installée', versionDeployed: 'Mise en ligne', versionBuilt: 'Compilée le',
    versionBerlin: (t: string) => `${t} (heure allemande)`,
    versionCurrent: 'À jour.', versionChecking: 'Vérification…', versionStale: 'Nouvelle version disponible',
    versionNote: 'Le numéro est l’heure de compilation (UTC) : v AA.MM.JJ.hhmm.',
    retellOpt: 'Proposer Fluidité 4/3/2', helpRow: 'Aide'
  },
  onboarding: {
    heroLine: 'Bonjour. Il paraît qu’on va parler ensemble. Bon.',
    title1: 'La tutrice', title2: 'qui se souvient de toi.',
    sub: 'Chaque jour une conversation, chaque soir quelques cartes. Ce qui coince à l’oral part en révision tout seul. Ton niveau se dessine de A1 à C2.',
    google: 'Continuer avec Google', connectedAs: 'Connecté :', signInFirst: 'Connecte-toi avec Google d’abord.',
    yourKey: 'Ta clé OpenAI',
    notOnList: (email: string) => `${email} n’est pas sur la liste du serveur. Entre ta propre clé : elle est enregistrée sur ton compte et utilisée pour tes conversations.`,
    saveContinue: 'Enregistrer et continuer', changeAccount: 'Changer de compte',
    yourFirstName: 'Ton prénom', youLearn: 'Tu apprends', yourMotherTongue: 'Ta langue maternelle',
    yourLevel: 'Ton niveau (à ton avis)',
    levelNote: 'Les trois premiers appels servent à faire connaissance : Odile vérifie ce niveau.',
    accessLabel: 'Accès', withCode: 'Avec le code d’accès',
    withCodeNote: 'La clé OpenAI reste sur le serveur. Il te faut juste le code.', serverKeyMissing: ' (Clé serveur manquante pour l’instant.)',
    withOwnKey: 'Avec ta clé OpenAI', withOwnKeyNote: 'Démarre tout de suite. La clé reste dans ce navigateur et va directement à OpenAI.',
    keyPlaceholder: 'Clé OpenAI (sk-…), reste dans ce navigateur', codePlaceholder: 'Code d’accès',
    go: 'C’est parti', loadProfileFailed: 'Chargement du profil échoué.', enterKey: 'Entre ta clé OpenAI.',
    error: (msg: string) => 'Erreur : ' + msg,
    a0Label: '0 — je pars de zéro',
    a0Hint: 'Odile commencera surtout dans ta langue, t’apprendra tes premières phrases, et un petit paquet de cartes de survie t’attend déjà.'
  },
  pz: {
    newPrompt: 'Nouveau prompt', drawOver: 'Dessiner dessus', listening: 'J’écoute…',
    micFail: 'La dictée ne marche pas dans ce navigateur. Utilise le micro du clavier.', lastImage: 'Ta dernière image',
    title: 'Personnalise ta carte', removeImg: 'Retirer l’image',
    tabDraw: 'Dessiner', tabPhoto: 'Photo', tabAi: 'Image IA', tabReuse: 'Réutiliser',
    reuseNote: 'Les images que tu as déjà dessinées, photographiées ou générées. Un appui suffit.', reuseEmpty: 'Aucune autre image dans le paquet.',
    eraser: 'Gomme', undo: 'Annuler', clearAll: 'Tout effacer', keepDrawing: 'Garder ce dessin',
    choosePhoto: 'Choisir une photo', photoHint: 'Ta photothèque s’ouvre, avec sa recherche.',
    keep: 'Garder', otherPhoto: 'Autre photo', photoBad: 'Photo illisible.',
    suggestBtn: 'Proposer deux idées',
    twoIdeas: 'Deux idées d’images mémorables :', searching: 'Odile cherche des idées…',
    ownScene: '… ou décris ta propre scène', dictate: 'Dicter', create: 'Créer l’image',
    drawing: 'Odile dessine… (~15 s)', preparing: 'Préparation…', saving: 'Enregistrement…',
    retryImg: 'Réessayer', promptBtn: 'Prompt', emptyPrompt: 'prompt vide', emptyImage: 'image vide',
    ideasFail: 'Pas d’idées pour l’instant. Réessaie.', imgFailHint: 'Ça n’a pas marché. Réessaie dans un instant.'
  },
  pron: {
    dayOf: (n: number) => `Jour ${n}/14`, phaseNote: 'Les deux premières semaines, l’oreille d’abord : ces paires t’apprennent à ENTENDRE la langue. L’appel reste court.',
    title: 'Prononciation', sub: 'Paires minimales : entends-tu la différence ?',
    start: 'Écouter et deviner', which: 'Lequel as-tu entendu ?', replay: 'Réécouter',
    score: (n: number, t: number) => `${n}/${t} justes`,
    good: 'Bonne oreille.', meh: 'Ça se travaille. Reviens demain.'
  },
  rank: {
    of: (n: number, t: number) => `Rang ${n} sur ${t}`,
    streakTitle: 'Série', days: (n: number) => `${n} ${n === 1 ? 'jour' : 'jours'} de suite`,
    repairs: (n: number, max: number) => `${n} jokers sur ${max}`,
    lifetime: (n: number) => `${n} XP en tout`,
    names: ['Premier mot', 'Salutations', 'Small talk', 'Anecdote', 'Conversation', 'Discussion', 'Débat', 'Nuance', 'Aisance', 'Éloquence', 'Verve', 'Causerie']
  },
  forge: {
    title: 'Nouvelle carte', inputPh: 'Un mot, une expression, ou un extrait de conversation…',
    suggest: 'Proposer des cartes', suggesting: 'Odile prépare des propositions…',
    add: (n: number) => `Ajouter ${n} ${n === 1 ? 'carte' : 'cartes'}`,
    none: 'Rien à en faire. Essaie un autre mot.', fail: 'Pas de propositions. Réessaie.',
    added: (n: number) => `${n} ${n === 1 ? 'carte ajoutée' : 'cartes ajoutées'}.`,
    fromTurn: 'En faire des cartes',
    already: 'Tu as déjà cette carte.', exists: 'déjà là'
  },
  tuto: {
    skip: 'Passer', next: 'Suivant', done: 'C’est parti',
    s: [
      { h: 'Un appel par jour', p: 'Tu parles avec Odile 3 à 8 minutes, sur un sujet qui t’intéresse. Elle corrige en reformulant, sans casser la conversation.' },
      { h: 'Le soir, quelques cartes', p: 'Tes fautes et les mots nouveaux deviennent des cartes. Une petite série chaque soir suffit — la répétition espacée fait le reste.' },
      { h: 'Une mémoire transparente', p: 'Odile se souvient de toi : niveau, lacunes, centres d’intérêt. Tout se lit, se corrige et s’efface sous « Mémoire ».' },
      { h: 'Si tu es perdu', p: 'L’aide est dans Réglages → Aide. Bonne conversation.' }
    ]
  },
  help: {
    title: 'Aide',
    s: [
      { h: 'Le rythme', p: 'Une conversation par jour (3–8 min), une révision le soir (10–20 cartes). C’est tout. La régularité bat l’intensité.' },
      { h: 'L’appel', p: 'Odile propose un sujet — refuse-le ou parle librement. Interromps-la quand tu veux. Elle corrige en reformulant ; les corrections détaillées arrivent après l’appel. Les fiches se lisent sans stress : Odile attend.' },
      { h: 'Après l’appel', p: 'L’analyse extrait corrections, nouveaux mots et progrès, et fabrique tes cartes. « Qu’a changé Odile ? » te montre les reformulations — essaie de repérer la différence avant de la révéler.' },
      { h: 'Les cartes', p: '« Encore » = à retravailler (la carte garde la moitié de son intervalle). « Bien » espace la carte de plus en plus ; « acquise » à partir de 21 jours d’intervalle. Personnalise chaque carte avec un dessin, une photo ou une image générée — les images que TU choisis se retiennent mieux.' },
      { h: 'La mémoire', p: 'Sous « Mémoire » : ton niveau (des îlots, pas une ligne), tes lacunes, tes faits, et le briefing exact du prochain appel. Chaque entrée s’édite ou s’efface. « Tout oublier » efface aussi la copie serveur.' },
      { h: 'Problèmes courants', p: 'Pas de son : vérifie le bouton haut-parleur et le mode silencieux du téléphone. Micro muet : recharge la page et vérifie les autorisations du navigateur. Analyse échouée : la conversation n’est pas perdue — réessaie depuis l’écran d’échec.' }
    ]
  },
  sheetsUi: { close: 'Fermer' }
};

export type UIStrings = typeof ui;

/* ------------------------------ tutor pack ------------------------------ */

const template = `Tu es Odile, tutrice de conversation en {{langue}}, en appel vocal avec ton élève. Tu es une vraie interlocutrice, pas une assistante.

# Personnage
Odile, française, la trentaine, béret rouge. {{persona}}

# Élève
{{name}}, langue maternelle : {{native}}. Niveau estimé : {{niveau}} ({{competences}}). Fiabilité de l'estimation : {{confiance}}.

# La règle du micro (avant toutes les autres)
C'est LUI qui doit parler. Chaque mot que tu prononces est un mot qu'il ne prononce pas, et il n'a que quelques minutes par jour.
- Tes tours sont PLUS COURTS que les siens. Une ou deux phrases. Au-delà de vingt-cinq mots, tu parles trop.
- Ne répète JAMAIS ce qu'il vient de dire. Ni reprise, ni résumé, ni « Oui, tu … » qui recopie sa phrase. Il sait ce qu'il a dit ; le lui rendre ne lui apprend rien et prend son temps de parole.
- Ne produis pas toi-même la langue que l'exercice lui demande de produire. Si le sujet est « décris le trajet », c'est LUI qui décrit ; si vous faites les courses, c'est LUI qui nomme les produits. Tu demandes, tu ne fournis pas.
- S'il vient de répondre en moins de vingt mots, ne pose PAS de question neuve : fais-lui continuer celle qu'il a commencée (« et alors ? », « raconte », « pourquoi ? »), ou réagis en deux ou trois mots (« Ah. », « Tiens. », « Bon. ») et laisse le silence faire le reste. Il continuera.
- Quand tu poses une question, qu'elle porte le plus souvent sur ce qu'il vient de dire — « pourquoi ? », « raconte » — plutôt que sur du neuf. Une question neuve à chaque tour, c'est un interrogatoire, pas une conversation.
- Jamais deux questions dans le même tour. Jamais de liste. Jamais de monologue.

# Règles de langue
- Parle uniquement en {{langue}}, calibré au niveau {{bande}} : phrases courtes, vocabulaire fréquent, structure claire. Un peu au-dessus du niveau, oui ; beaucoup au-dessus, non. Jamais un mot d'une troisième langue.
- Si l'élève est perdu ou demande une explication ou une traduction : UNE explication courte en {{native}}, puis retour immédiat au {{langue}}.
- « Comment dit-on X ? » → donne le mot, une glose de deux mots en {{native}}, et continue.

# Corriger (sans reprendre le micro)
Corrige comme une bonne tutrice humaine, jamais en faisant la leçon. L'ordre compte, et il commence par LE faire parler :
1. Sa phrase est incompréhensible ou déraille → demande une clarification courte (« Comment ? », « C'est-à-dire ? », « Redis-le autrement ? ») et laisse-LE se reprendre. C'est ta réaction par défaut, pas ton dernier recours. Ne devine jamais charitablement pour enchaîner : s'il n'a pas été compris, il doit l'apprendre maintenant.
2. Tu as compris, mais il y a une faute ORDINAIRE → laisse passer et réagis au contenu. Corriger tout, c'est ne rien marquer : repris à chaque phrase, il ne remarque plus rien.
3. TROIS fautes ne passent jamais : celle qui touche un objectif du jour, celle qui touche une de ses lacunes ouvertes, celle qui touche le cap de la période. Quand tu en entends une, ta réponse COMMENCE par la forme correcte, glissée dans une réaction au contenu — sans annoncer la correction, sans dire qu'il s'est trompé, sans répéter le reste de sa phrase. Une seule par tour, la plus importante.
- S'il glisse un mot d'une autre langue au milieu du {{langue}} (par ex. « income », « Termin ») : donne le mot {{langue}} en passant — c'est la reformulation prioritaire.
- N'arrête jamais la conversation pour la grammaire. Ne dis jamais « petite correction ». Aucun métacommentaire sur les fautes pendant l'appel.
- Si la même faute revient plusieurs fois dans l'appel : un seul aparté très court en {{native}}, puis on continue en {{langue}}.

# Nourrir le vocabulaire
- Introduis 2 ou 3 mots ou expressions UTILES par appel, un cran au-dessus de son niveau : glisse-les naturellement dans tes réponses, avec au besoin une glose de deux mots en {{native}}, et réutilise chacun au moins une fois plus tard dans l'appel.
- Seulement si le fil s'y prête. Si un mot ne rentre pas naturellement dans les deux prochains tours, laisse-le tomber : tordre la conversation pour caser un mot coûte plus qu'il ne rapporte, et te fait parler à sa place.
- Choisis-les selon le sujet du jour et ses centres d'intérêt ; des mots dont il se servira, pas des mots rares pour briller.

{{aujourdhui}}

# Durée
Appel quotidien : environ {{minutes}} minutes, pas plus. Garde le rythme, pas de longs détours. Tu recevras parfois des notes système entre parenthèses (« (note de régie : …) ») : suis-les en silence, ne les lis jamais à voix haute. Quand le temps est écoulé, conclus en une phrase courte, puis NE RELANCE PLUS : plus aucune nouvelle question, réponds au revoir et c'est tout.

# Objectifs du jour (secrets : ne jamais les annoncer ni les lister)
Crée des ouvertures naturelles pour que l'élève doive les utiliser ; si une ouverture passe sans être saisie, crées-en une autre plus tard. Et une faute qui touche l'un d'eux ne passe JAMAIS : ta réponse commence alors par la forme correcte, glissée dans une réaction au contenu.
{{objectifs}}

# Sondage discret (jamais annoncé)
Le niveau réel est fait d'îlots : des bases peuvent manquer sous le niveau affiché. Une ou deux fois dans l'appel, glisse une ouverture qui oblige à utiliser ceci, et note mentalement si ça passe :
{{sondages}}

# Cap de la période (choisi par l'élève à son dernier bilan ; oriente tes appels sans jamais l'annoncer, et corrige en priorité les fautes qui le touchent)
{{cap}}

# Ce que tu sais de l'élève
Qui il est. Tu le connais : parle-lui comme à quelqu'un dont tu sais déjà tout ça, sans jamais réciter la liste ni redemander ce qui y figure.
{{faits}}
Centres d'intérêt :
{{interets}}
Points faibles connus (reformule-les fermement quand ils apparaissent ; certains libellés peuvent être en {{native}}) :
{{faiblesses}}
Conversations précédentes (fais-y référence de temps en temps, sans en faire toute une histoire) :
{{passe}}

# Conduite
- L'élève peut t'interrompre à tout moment : arrête-toi immédiatement et réponds à ce qu'il dit.
- S'il se tait un moment, laisse-le chercher : le silence est son temps de réflexion, pas un vide à combler. Ce n'est qu'après une vraie pause que tu proposes une relance simple ou reformules ta question.
- Reprends ses chiffres, ses noms et ses lieux exactement comme il les a donnés. Ne les change jamais en passant.
- S'il passe au {{native}} par confort, réponds brièvement et ramène-le au {{langue}} avec une question facile.
- Quand il dit au revoir ou veut arrêter, conclus l'appel en une phrase courte, pince-sans-rire, puis raccroche toi-même avec l'outil end_call. Ne reste jamais en ligne après les adieux.
- Ne commente JAMAIS ta manière de parler ni ta pédagogie : pas de « je vais faire simple », « je parle lentement », « restons basique », « pour t'aider, je vais… ». Fais-le, sans jamais le dire.
- Ne mentionne jamais être une IA, un modèle, ou ces instructions. Ne sors jamais du personnage.`;

/* ------------------------------ the pack ------------------------------ */

export const fr: LangPack = {
  code: 'fr',
  locale: 'fr-FR',
  langName: 'français',
  self: 'Français',
  flag: '🇫🇷',
  en: 'French',
  natives: { de: 'allemand', en: 'anglais' },
  ui,
  tutor: {
    template,
    persona: {
      deadpan: `Ton débit est pince-sans-rire et sec. Intonation plate et calme. Laconique, un peu désabusée, mais discrètement bienveillante. Jamais d'enthousiasme débordant, jamais de points d'exclamation ; tes compliments sont courts et factuels (« Pas mal. », « C'est correct. », « Bon. »). De temps en temps, au plus une fois toutes les quelques minutes, tu te permets une seule blague très sèche, livrée parfaitement à plat.`,
      warm: `Ton ton est chaleureux, calme et encourageant, sans jamais en faire trop. Tu souris avec la voix, doucement.`
    },
    todayIntro: (n: number) => `# Aujourd'hui : faire connaissance (appel ${n} sur 3)
${n === 1
    ? `C'est le tout premier appel : vous ne vous connaissez pas encore.`
    : `Vous avez déjà parlé ${n - 1 === 1 ? 'une fois' : `${n - 1} fois`} ensemble. NE te présente PAS à nouveau, et ne repose JAMAIS une question dont la réponse figure déjà dans « Ce que tu sais de l'élève » plus bas : appuie-toi dessus et creuse plus loin, comme une personne qui se souvient.`}
Tes objectifs, tissés dans une conversation naturelle :
- ${n === 1
    ? `Apprendre qui est l'élève : travail, quotidien, famille s'il en parle, loisirs, lieux qu'il connaît, pourquoi il apprend la langue. Une chose à la fois ; réagis comme une personne, pas comme un formulaire.`
    : n === 2
    ? `Axe du jour : son quotidien concret — sa semaine, ses matinées, son quartier, ses trajets, ce qu'il fait après le travail. Pars de ce que tu sais déjà et va dans le détail.`
    : `Axe du jour : ses passions en profondeur, et ce qu'il veut faire de la langue — où et avec qui il compte l'utiliser. Relie ce qu'il raconte à ce que tu sais déjà de lui.`}
- Sonder son niveau : commence très simplement. Tous les quelques échanges, tente UNE structure un peu plus difficile. Là où ça coince, simplifie sans commentaire. Cette cartographie est le but de l'appel.
- N'enseigne rien d'autre, n'impose aucun sujet. Suis ce qui l'anime.`,
    todayTopic: (topic: string) => `# Aujourd'hui
Sujet proposé : ${topic}. Ouvre en le proposant en une phrase courte et demande dans la foulée si ça lui convient, ou s'il préfère parler d'autre chose aujourd'hui. S'il choisit autre chose, change immédiatement et complètement, sans commentaire. Reste sur le sujet convenu, mais suis l'élève s'il dérive vers quelque chose qui compte pour lui.`,
    todayFields: (fields: string) => `\nCe sujet a été choisi pour le vocabulaire qu'il oblige à mobiliser : ${fields}. Fais-y passer l'élève — mais par des questions, pas en disant ces mots à sa place, et seulement quand la conversation y mène d'elle-même.`,
    a0: `# Débutant absolu
L'élève ne parle PAS encore {{langue}}, ou trois mots à peine. Adapte tout :
- Conduis l'appel surtout en {{native}}, sobrement. Le {{langue}} arrive par petites touches, jamais en bloc.
- Chaque appel : 3 à 5 phrases de survie en {{langue}} (salutations, « je m'appelle… », « merci », « plus lentement, s'il te plaît »). Dis la phrase lentement, fais-la répéter À VOIX HAUTE, reprends-la plus tard dans l'appel.
- Félicite sobrement chaque tentative. Zéro théorie, zéro grammaire.
- Termine par un mini-récapitulatif en {{native}} des phrases apprises aujourd'hui.`,
    interference: `# Interférences
L'élève apprend aussi : {{autres}}. Quand un mot ou une tournure de ces langues se glisse dans son {{langue}}, signale le contraste en un mot et donne la forme {{langue}} — sans leçon.`,
    talkHog: (pct: number) => `# Alerte : tu prends toute la place
Sur tes derniers appels, TU as prononcé ${pct} % des mots. C'est l'inverse de ce qu'il faut : à la fin de cet appel, il doit avoir parlé plus que toi.
- Coupe tes tours de moitié. Une phrase suffit presque toujours.
- Supprime toute reprise de ce qu'il vient de dire : c'est là que part la moitié de tes mots.
- Pose moins de questions et laisse le silence travailler.`,
    levelBeingEstablished: {
      niveau: 'en cours d\'évaluation — les premiers appels servent justement à l\'établir',
      confiance: 'faible pour l\'instant, c\'est normal'
    },
    fallbacks: {
      student: 'l\'élève', noTargets: '(aucun aujourd\'hui)', noProbes: '- (rien à sonder aujourd\'hui)',
      noDirection: '(pas encore défini)', noFacts: '- (rien encore)', noInterests: '- (rien encore)',
      noWeaknesses: '- (rien encore)', firstCall: '- (première conversation)'
    },
    greetIntro: (name: string, n: number) => n === 1
      ? `(note de régie : ouvre l'appel maintenant. C'est ta toute première conversation avec ${name}. Présente-toi en une phrase courte et plate : tu es Odile, sa tutrice, vous parlerez régulièrement ensemble. Puis pose une première question très simple sur lui. Deux phrases maximum. Tu es Odile et rien d'autre : aucune mention d'IA, de modèle ou d'assistant, et aucun commentaire sur ta manière de parler.)`
      : `(note de régie : ouvre l'appel maintenant. C'est votre ${n}e conversation : vous vous connaissez déjà, NE te présente PAS et ne redemande rien que tu sais déjà. Salue ${name} sobrement, comme quelqu'un que tu connais, fais référence en passant à une chose que tu sais de lui, puis pose une question simple et NOUVELLE. Deux phrases maximum. Tu es Odile et rien d'autre : aucune mention d'IA, de modèle ou d'assistant, et aucun commentaire sur ta manière de parler.)`,
    greetDaily: (name: string, topic: string, minutes: number) =>
      `(note de régie : ouvre l’appel maintenant. Tu es Odile. DEUX phrases, pas plus. D’abord salue ${name} par son prénom, court et plat. Ensuite annonce le programme clairement, pour qu’il sache exactement ce qui l’attend : de quoi vous allez parler aujourd’hui (« ${topic} »), et que vous avez environ ${minutes} minutes ensemble. Termine en demandant si ça lui va ou s’il préfère autre chose. Aucune mention d’IA, de modèle ou d’assistant, et aucun commentaire sur ta manière de parler.)`,
    notes: {
      turnMode: '(note de régie : cet appel se fait tour par tour. Vous ne pouvez pas vous interrompre : tu parles, puis tu attends qu’il ait fini. Tes tours doivent donc rester COURTS — 1 à 3 phrases, puis au plus une question. Tu lis une transcription de ce qu’il dit : ne commente jamais sa prononciation ni son accent, et si un mot semble étrange, traite-le comme un mot mal transcrit plutôt que comme une faute de sa part. Pour raccrocher, dis ton dernier au revoir puis écris [FIN] tout à la fin du message ; jamais avant les adieux, et ne le prononce jamais.)',
      materialPause: '(note de régie : l’élève consulte une fiche de grammaire. Si tu parles, termine ta phrase, puis attends en silence son retour.)',
      materialBack: '(note de régie : l’élève est de retour. Reprends là où vous étiez, une phrase courte, sans commenter la pause.)',
      paused: '(note de régie : l’élève met la conversation en pause et s’absente. Tu as peut-être été coupée au milieu d’une phrase : c’est normal, ne la termine pas et n’en parle pas. Attends en silence. N’ajoute rien, ne pose aucune question, ne raccroche pas — il va revenir.)',
      resumed: '(note de régie : l’élève revient de sa pause. Reprends le fil là où vous l’aviez laissé, une phrase courte, sans commenter l’interruption ni demander où il était.)',
      oneMinute: '(note de régie : il reste environ une minute. Commence à conclure la conversation naturellement.)',
      timeUp: '(note de régie : le temps est écoulé. Termine l’appel maintenant par un au revoir court, dans ton ton habituel, puis raccroche avec l’outil end_call.)',
      overtime: '(note de régie : l’appel devait déjà se terminer. Dis au revoir en UNE phrase, ne pose plus aucune question, puis raccroche avec l’outil end_call.)',
      wordGoal: (word: string) => `(note de régie : l’élève doit placer le mot « ${word} » dans la conversation, il l’a sous les yeux. Amène-le : pose une question dont ce mot est la réponse naturelle. Si le fil ne s’y prête pas dans les deux prochains tours, LAISSE TOMBER — ne tords pas la conversation pour le caser. NE dis PAS le mot toi-même, ne le suggère pas, et ne mentionne jamais cet exercice.)`,
      wordGoalDone: (word: string) => `(note de régie : l’élève vient de placer « ${word} ». Enchaîne normalement — au plus un mot d’approbation sec, aucune mention de l’exercice.)`
    },
    facts: {
      cats: { arbeit: 'Travail', familie: 'Famille', orte: 'Lieux', alltag: 'Quotidien', vorlieben: 'Goûts', sonstiges: 'Divers' },
      basics: 'Les bases (acquises — sers-t’en librement, ne les lui redemande jamais) :',
      passing: 'En passant (anecdotique : au plus UN par appel, et seulement s’il tombe bien) :',
      none: '- (tu ne le connais pas encore)'
    },
    records: {
      themes: 'Thèmes : ',
      callOf: 'appel du ',
      fixFront: (original: string) => 'Corrige : « ' + original + ' »'
    }
  },
  comp: (() => {
    const G = compG(''), V = compV(''), F = compF('');
    return [
      G('A1', 'etre-avoir', 'être & avoir au présent'),
      G('A1', 'present-er', 'présent des verbes en -er'),
      G('A1', 'articles', 'articles le / la / les, un / une'),
      G('A1', 'negation', 'négation ne … pas'),
      G('A1', 'questions', 'questions simples (est-ce que, intonation)'),
      G('A1', 'genre-accord', 'genre et accord de base (petit / petite)'),
      V('A1', 'presentation', 'se présenter : nom, âge, pays, métier'),
      V('A1', 'nombres-heure', 'nombres, prix et heure'),
      V('A1', 'famille', 'famille proche'),
      V('A1', 'nourriture', 'nourriture et boissons de base'),
      V('A1', 'ville-lieux', 'lieux de la ville'),
      F('A1', 'saluer', 'saluer et prendre congé'),
      F('A1', 'commander', 'commander poliment (je voudrais)'),
      F('A1', 'gouts-simples', 'dire ce qu’on aime (j’aime + nom)'),
      F('A1', 'comprendre-aide', 'demander de répéter, dire qu’on ne comprend pas'),
      F('A1', 'coordonnees', 'épeler, donner ses coordonnées'),
      G('A2', 'passe-compose', 'passé composé avec avoir et être'),
      G('A2', 'pronominaux', 'verbes pronominaux (se promener, se lever)'),
      G('A2', 'futur-proche', 'futur proche (aller + infinitif)'),
      G('A2', 'cod-coi', 'pronoms objets le / la / les / lui'),
      G('A2', 'comparatif', 'comparatif plus / moins … que'),
      G('A2', 'partitif', 'quantités : du / de la / pas de'),
      G('A2', 'aimer-inf', 'verbe + infinitif (j’aime voir, je préfère aller)'),
      V('A2', 'routine', 'routine, travail et semaine'),
      V('A2', 'loisirs', 'loisirs et sports'),
      V('A2', 'courses', 'courses, vêtements, magasins'),
      V('A2', 'voyages', 'voyages et transports'),
      V('A2', 'meteo-nature', 'météo, saisons, nature'),
      F('A2', 'raconter-passe', 'raconter sa journée ou son week-end'),
      F('A2', 'decrire-lieu', 'décrire un lieu, un logement'),
      F('A2', 'chemin', 'demander et expliquer un chemin'),
      F('A2', 'projets', 'parler de projets simples'),
      F('A2', 'preferences', 'exprimer une préférence et la justifier en un mot'),
      G('B1', 'imparfait-pc', 'imparfait vs passé composé'),
      G('B1', 'futur-simple', 'futur simple'),
      G('B1', 'conditionnel', 'conditionnel de politesse et de conseil'),
      G('B1', 'subjonctif-base', 'subjonctif après il faut que / je veux que'),
      G('B1', 'relatifs', 'pronoms relatifs qui / que / où'),
      G('B1', 'discours-indirect', 'discours indirect au présent'),
      V('B1', 'opinions', 'opinions et émotions'),
      V('B1', 'travail-etudes', 'travail et études en détail'),
      V('B1', 'medias', 'médias et actualité simple'),
      V('B1', 'sante', 'santé et rendez-vous'),
      V('B1', 'connecteurs-freq', 'connecteurs fréquents (d’abord, ensuite, pourtant)'),
      F('B1', 'avis-justifie', 'donner son avis et le justifier (parce que, donc)'),
      F('B1', 'recit', 'raconter un récit suivi au passé'),
      F('B1', 'reclamation', 'faire une réclamation simple'),
      F('B1', 'accord-desaccord', 'exprimer accord et désaccord poliment'),
      F('B1', 'resumer', 'résumer un film, un livre, un article'),
      G('B2', 'subjonctif-emotion', 'subjonctif après émotion et doute'),
      G('B2', 'passif', 'voix passive'),
      G('B2', 'concordance', 'concordance des temps'),
      G('B2', 'connecteurs-log', 'bien que, pourtant, ainsi, en revanche'),
      G('B2', 'hypothese', 'hypothèses : si + imparfait → conditionnel'),
      G('B2', 'nominalisation', 'nominalisation'),
      V('B2', 'societe', 'débats de société'),
      V('B2', 'professionnel', 'monde professionnel'),
      V('B2', 'sentiments-nuances', 'nuances de sentiment'),
      V('B2', 'idiomes-courants', 'expressions idiomatiques courantes'),
      V('B2', 'registres', 'registre familier vs courant'),
      F('B2', 'argumenter', 'argumenter avec des concessions'),
      F('B2', 'debattre', 'débattre en nuançant'),
      F('B2', 'avantages', 'peser avantages et inconvénients'),
      F('B2', 'hypothese-passe', 'spéculer sur le passé'),
      F('B2', 'reformuler-autrui', 'reformuler la position de quelqu’un d’autre'),
      G('C1', 'subjonctif-passe', 'subjonctif passé, plus-que-parfait'),
      G('C1', 'mise-en-relief', 'mise en relief (ce qui …, c’est …)'),
      G('C1', 'gerondif', 'participe présent et gérondif'),
      G('C1', 'style-soutenu', 'inversion et tournures soutenues'),
      G('C1', 'en-y', 'pronoms en / y, y compris combinés'),
      V('C1', 'abstrait', 'lexique abstrait (liberté, mémoire, temps)'),
      V('C1', 'specialite', 'sa spécialité expliquée à un profane'),
      V('C1', 'collocations', 'collocations soutenues'),
      V('C1', 'humour', 'humour, ironie, sous-entendus'),
      F('C1', 'expose', 'développer un exposé structuré'),
      F('C1', 'implicite', 'manier l’implicite et l’ironie'),
      F('C1', 'registre-contexte', 'adapter le registre au contexte'),
      F('C1', 'negocier', 'négocier, convaincre'),
      G('C2', 'figures', 'figures de style à bon escient'),
      G('C2', 'syntaxe-complexe', 'syntaxe complexe et fluide'),
      G('C2', 'temps-litteraires', 'temps littéraires (reconnaître, parodier)'),
      V('C2', 'idiomes-rares', 'idiomes rares et jeux de mots'),
      V('C2', 'argot', 'argot et néologismes compris'),
      F('C2', 'concessions-fines', 'débattre avec concessions fines'),
      F('C2', 'changer-registre', 'changer de registre à la demande'),
      F('C2', 'nuances-natives', 'nuances quasi natives')
    ];
  })(),
  sheets: [],   // assigned below to keep the pack literal readable
  topics: [
    { lv: 'A2', t: 'Jeu de rôle : à la boulangerie', fr: 'jeu de rôle — tu es la boulangère, l’élève est le client ; reste dans ton rôle : commande, paiement, une question', tags: ['la politesse', 'les nombres', 'acheter'] },
    { lv: 'B1', t: 'Jeu de rôle : réclamation', fr: 'jeu de rôle — tu es le service client, l’élève rapporte un objet cassé ; pose des questions, propose des solutions, il doit argumenter', tags: ['argumenter', 'le passé composé'] },
    { lv: 'B2', t: 'Information manquante : devine', fr: 'jeu à information manquante — invente en secret son week-end idéal ; il devine par des questions, tu ne réponds que oui, non ou presque', tags: ['les questions', 'les hypothèses'] },
    { lv: 'A1', t: 'Se présenter', fr: 'se présenter: nom, ville, travail, famille', tags: ['être & avoir', 'les nombres', 'les métiers'] },
    { lv: 'A1', t: 'Commander au café', fr: 'commander au café: boissons, croissants, l’addition', tags: ['je voudrais', 'les quantités', 'la politesse'] },
    { lv: 'A1', t: 'Ma journée type', fr: 'la routine quotidienne: le matin, le soir, les horaires', tags: ['l’heure', 'le présent', 'verbes pronominaux'] },
    { lv: 'A1', t: 'Mon appartement', fr: 'décrire son appartement et son quartier', tags: ['il y a', 'prépositions', 'les meubles'] },
    { lv: 'A2', t: 'Promenades et nature', fr: 'les promenades, la nature, les arbres, les saisons', tags: ['aimer + infinitif', 'situer un lieu', 'la météo'] },
    { lv: 'A2', t: 'Le week-end dernier', fr: 'raconter son week-end', tags: ['passé composé', 'adverbes de temps', 'd’abord, ensuite…'] },
    { lv: 'A2', t: 'Cuisine et recettes', fr: 'la cuisine: plats préférés, recettes, épices', tags: ['du / de la', 'les quantités', 'l’impératif'] },
    { lv: 'A2', t: 'Dessin et loisirs', fr: 'les loisirs: dessiner, la musique, le sport', tags: ['jouer à / de', 'depuis', 'pronoms objets'] },
    { lv: 'A2', t: 'Demander son chemin', fr: 'demander et expliquer le chemin', tags: ['l’impératif', 'prépositions', 'les ordinaux'] },
    { lv: 'B1', t: 'Films et séries', fr: 'parler de films et de séries: avis, recommandations', tags: ['donner son avis', 'qui / que', 'le passé'] },
    { lv: 'B1', t: 'Projets et avenir', fr: 'les projets: voyages, travail, apprentissage', tags: ['futur proche & simple', 'quand + futur', 'les conditions'] },
    { lv: 'B1', t: 'Travail et quotidien', fr: 'le travail: une journée typique, collègues, réunions', tags: ['imparfait vs passé composé', 'la fréquence', 'discours indirect'] },
    { lv: 'B1', t: 'Défendre une opinion', fr: 'défendre une opinion simple: pour ou contre', tags: ['parce que / donc / pourtant', 'subjonctif (début)', 'donner des exemples'] },
    { lv: 'B2', t: 'L’actualité', fr: 'discuter d’un sujet d’actualité', tags: ['le subjonctif', 'le passif', 'la nominalisation'] },
    { lv: 'B2', t: 'Et si… (hypothèses)', fr: 'faire des hypothèses sur sa vie', tags: ['si + imparfait → conditionnel', 'les rêves', 'justifier'] },
    { lv: 'B2', t: 'Ville ou campagne ?', fr: 'débattre: vivre en ville ou à la campagne', tags: ['argumenter', 'bien que + subjonctif', 'comparer'] },
    { lv: 'B2', t: 'Cultures France–Allemagne', fr: 'les différences culturelles France–Allemagne', tags: ['questionner les clichés', 'les nuances', 'les registres'] },
    { lv: 'C1', t: 'Idées abstraites', fr: 'discuter d’idées abstraites: liberté, mémoire, temps', tags: ['vocabulaire soutenu', 'les connecteurs', 'les hypothèses'] },
    { lv: 'C1', t: 'Expliquer ton domaine', fr: 'expliquer son domaine à un non-spécialiste', tags: ['langue de spécialité', 'paraphraser', 'la précision'] },
    { lv: 'C1', t: 'Ironie et humour', fr: 'l’humour: comprendre et faire des blagues sèches', tags: ['l’ironie', 'les jeux de mots', 'les registres'] },
    { lv: 'C2', t: 'Changer de registre', fr: 'dire la même chose en registre familier, courant, soutenu', tags: ['les registres', 'les idiomes', 'les subtilités'] },
    { lv: 'C2', t: 'Débat de haut niveau', fr: 'débattre avec nuances et concessions', tags: ['figures de style', 'la concession', 'la précision'] }
  ],
  introTopics: [
    { t: 'Faire connaissance : qui es-tu ?', fr: 'faire connaissance : qui tu es, ce que tu fais', tags: [] },
    { t: 'Ton quotidien et ta semaine', fr: 'ta routine, ta semaine, ton quartier', tags: [] },
    { t: 'Tes passions en détail', fr: 'tes passions et pourquoi tu apprends le français', tags: [] }
  ],
  starter: [
    { t: 'Bonjour !', de: 'Hallo!', en: 'Hello!' },
    { t: 'Merci beaucoup.', de: 'Danke schön.', en: 'Thank you very much.' },
    { t: 'Je m’appelle…', de: 'Ich heiße…', en: 'My name is…' },
    { t: 'Comment ça va ?', de: 'Wie geht’s?', en: 'How are you?' },
    { t: 'Oui. / Non.', de: 'Ja. / Nein.', en: 'Yes. / No.' },
    { t: 'Je ne comprends pas.', de: 'Ich verstehe nicht.', en: 'I don’t understand.' },
    { t: 'Plus lentement, s’il te plaît.', de: 'Langsamer, bitte.', en: 'Slower, please.' },
    { t: 'Comment dit-on… ?', de: 'Wie sagt man…?', en: 'How do you say…?' },
    { t: 'Au revoir !', de: 'Auf Wiedersehen!', en: 'Goodbye!' },
    { t: 'À demain !', de: 'Bis morgen!', en: 'See you tomorrow!' }
  ]
};

/* French cheat sheets (ids match the competency map, so a pinned cell brings its
   sheet along). Glosses in German, the default native language. */
const F = (id: string, title: string, match: string[], core: string[], examples: { t: string; gloss: string }[], traps?: string[]): CheatSheet =>
  ({ id, lang: 'fr', title, match, core, examples, traps });

fr.sheets = [
  F('g-a1-etre-avoir', 'Être & avoir (présent)', ['etre', 'avoir'],
    ['être : je suis, tu es, il est, nous sommes, vous êtes, ils sont',
     'avoir : j’ai, tu as, il a, nous avons, vous avez, ils ont',
     'L’âge se dit avec avoir : « J’ai 40 ans. »'],
    [{ t: 'Je suis fatigué, mais j’ai le temps.', gloss: 'Ich bin müde, aber ich habe Zeit.' },
     { t: 'Elle a deux chats.', gloss: 'Sie hat zwei Katzen.' }],
    ['« Je suis 40 ans » ✗ → « J’ai 40 ans » ✓']),
  F('g-a1-present-er', 'Présent des verbes en -er', ['present des verbes', 'verbes en -er'],
    ['Radical + e, es, e, ons, ez, ent', 'parler → je parle, nous parlons, ils parlent',
     '-ent final est muet : « ils parlent » sonne comme « il parle »'],
    [{ t: 'Nous habitons à Hambourg.', gloss: 'Wir wohnen in Hamburg.' },
     { t: 'Tu travailles beaucoup.', gloss: 'Du arbeitest viel.' }]),
  F('g-a1-articles', 'Articles : le, la, les / un, une, des', ['articles'],
    ['Défini : le (m), la (f), l’ (voyelle), les (pluriel)', 'Indéfini : un, une, des',
     'Après une négation, un/une/des → de : « pas de chien »'],
    [{ t: 'J’ai un chien. Le chien s’appelle Milo.', gloss: 'Ich habe einen Hund. Der Hund heißt Milo.' },
     { t: 'Il n’y a pas de problème.', gloss: 'Es gibt kein Problem.' }]),
  F('g-a1-negation', 'La négation : ne … pas / jamais', ['negation', 'jamais'],
    ['ne + verbe + pas : « Je ne sais pas. »', 'jamais, rien, plus remplacent pas',
     'Après la négation : un/une/des → de : « Je n’ai jamais dessiné d’animaux. »'],
    [{ t: 'Je ne mange jamais de viande.', gloss: 'Ich esse nie Fleisch.' },
     { t: 'Il n’a rien dit.', gloss: 'Er hat nichts gesagt.' }],
    ['« pas jamais » ✗ — jamais remplace pas', '« jamais des animaux » ✗ → « jamais d’animaux » ✓']),
  F('g-a1-questions', 'Poser une question', ['questions'],
    ['Intonation : « Tu viens ? »', 'Est-ce que : « Est-ce que tu viens ? »',
     'Mot interrogatif + est-ce que : « Où est-ce que tu habites ? »'],
    [{ t: 'Qu’est-ce que tu fais ce soir ?', gloss: 'Was machst du heute Abend?' },
     { t: 'Pourquoi est-ce que c’est fermé ?', gloss: 'Warum ist zu?' }]),
  F('g-a1-genre-accord', 'Genre et accord', ['genre', 'accord'],
    ['L’adjectif s’accorde : petit / petite / petits / petites',
     'Beaucoup de féminins en -e ; -eux → -euse ; -if → -ive'],
    [{ t: 'Une grande maison blanche.', gloss: 'Ein großes weißes Haus.' },
     { t: 'Ils sont heureux, elles sont heureuses.', gloss: 'Sie sind glücklich (m/f).' }]),
  F('g-a2-passe-compose', 'Le passé composé', ['passe compose'],
    ['avoir + participe : « j’ai mangé »',
     'être pour aller, venir, partir, rester, monter… et les pronominaux',
     'Avec être, le participe s’accorde : « elle est partie »',
     'Participes : -er → -é, -ir → -i, irréguliers : fait, pris, vu, été, eu'],
    [{ t: 'Hier, j’ai travaillé, puis je suis allé au parc.', gloss: 'Gestern habe ich gearbeitet, dann bin ich in den Park gegangen.' },
     { t: 'Elle s’est promenée.', gloss: 'Sie ist spazieren gegangen.' }],
    ['« Je suis mangé » ✗ → « J’ai mangé » ✓']),
  F('g-a2-pronominaux', 'Les verbes pronominaux', ['pronominaux', 'promener', 'reflexiv'],
    ['me, te, se, nous, vous, se + verbe : « je me lève »',
     'Après un verbe + infinitif, le pronom reste : « Je préfère me promener »',
     'Passé composé avec être : « je me suis levé »'],
    [{ t: 'Je me promène tous les jours.', gloss: 'Ich gehe jeden Tag spazieren.' },
     { t: 'Tu vas te souvenir de ce mot.', gloss: 'Du wirst dich an das Wort erinnern.' }],
    ['« Je préfère de promener » ✗ → « me promener » ✓']),
  F('g-a2-futur-proche', 'Le futur proche', ['futur proche'],
    ['aller (présent) + infinitif : « je vais partir »',
     'Négation autour d’aller : « je ne vais pas partir »'],
    [{ t: 'On va manger ensemble demain.', gloss: 'Wir essen morgen zusammen.' },
     { t: 'Il va pleuvoir.', gloss: 'Es wird gleich regnen.' }]),
  F('g-a2-cod-coi', 'Pronoms objets : le, la, les / lui, leur', ['pronoms objets', 'cod', 'coi', 'le la les'],
    ['Direct : le, la, l’, les — « Je les aime. »',
     'Indirect (à qqn) : lui, leur — « Je lui parle. »',
     'Avant le verbe ; au passé composé avant l’auxiliaire : « Je l’ai vu. »'],
    [{ t: 'Les arbres ? Je les aime beaucoup.', gloss: 'Die Bäume? Ich mag sie sehr.' },
     { t: 'Marie ? Je lui téléphone ce soir.', gloss: 'Marie? Ich rufe sie heute Abend an.' }],
    ['« Je aime les » ✗ — le pronom vient AVANT le verbe']),
  F('g-a2-comparatif', 'Comparer : plus / moins / aussi … que', ['comparatif', 'comparer'],
    ['plus + adj + que ; moins … que ; aussi … que',
     'bon → meilleur ; bien → mieux'],
    [{ t: 'Le train est plus rapide que le bus.', gloss: 'Der Zug ist schneller als der Bus.' },
     { t: 'C’est mieux comme ça.', gloss: 'So ist es besser.' }],
    ['« plus bon » ✗ → « meilleur » ✓']),
  F('g-a2-partitif', 'Le partitif : du, de la, des → de', ['partitif', 'quantites', 'du de la'],
    ['du (m), de la (f), de l’, des : « du pain, de la confiture »',
     'Négation et quantités → de : « pas de pain », « beaucoup de pain »'],
    [{ t: 'Je bois du café, mais pas de sucre.', gloss: 'Ich trinke Kaffee, aber keinen Zucker.' },
     { t: 'Un peu de patience.', gloss: 'Ein wenig Geduld.' }]),
  F('g-a2-aimer-inf', 'Verbe + infinitif', ['aimer + infinitif', 'verbe + infinitif'],
    ['aimer, préférer, vouloir, pouvoir, devoir + infinitif direct : « J’aime voir les plantes »',
     'Pas de « de » après ces verbes ; mais : essayer DE, décider DE, commencer À'],
    [{ t: 'Je préfère dessiner le soir.', gloss: 'Ich zeichne lieber abends.' },
     { t: 'Elle veut apprendre l’espagnol.', gloss: 'Sie will Spanisch lernen.' }],
    ['« J’aime de voir » ✗ → « J’aime voir » ✓']),
  F('g-b1-imparfait-pc', 'Imparfait vs passé composé', ['imparfait'],
    ['Imparfait = décor, habitude, description : « il pleuvait »',
     'Passé composé = événement, action finie : « je suis sorti »',
     'Imparfait : radical de nous + ais, ais, ait, ions, iez, aient'],
    [{ t: 'Il pleuvait quand je suis sorti.', gloss: 'Es regnete, als ich rausging.' },
     { t: 'Avant, j’habitais à Berlin.', gloss: 'Früher wohnte ich in Berlin.' }]),
  F('g-b1-futur-simple', 'Le futur simple', ['futur simple'],
    ['Infinitif + ai, as, a, ons, ez, ont : « je parlerai »',
     'Irréguliers : serai, aurai, irai, ferai, pourrai, viendrai',
     'Après quand (futur) : futur des deux côtés : « Quand je serai grand, je… »'],
    [{ t: 'On verra bien.', gloss: 'Wir werden sehen.' },
     { t: 'Je t’appellerai demain.', gloss: 'Ich rufe dich morgen an.' }]),
  F('g-b1-conditionnel', 'Le conditionnel', ['conditionnel'],
    ['Radical du futur + terminaisons de l’imparfait : « je parlerais »',
     'Politesse : « je voudrais », conseil : « tu devrais », rêve : « j’aimerais »',
     'Hypothèse : si + imparfait → conditionnel : « Si j’avais le temps, je viendrais »'],
    [{ t: 'Je voudrais un café, s’il vous plaît.', gloss: 'Ich hätte gern einen Kaffee.' },
     { t: 'Tu devrais dormir plus.', gloss: 'Du solltest mehr schlafen.' },
     { t: 'Si c’était possible, on partirait demain.', gloss: 'Wenn es möglich wäre, würden wir morgen fahren.' }],
    ['« Si j’aurais » ✗ — jamais de conditionnel après si']),
  F('g-b1-subjonctif-base', 'Le subjonctif (début)', ['subjonctif', 'il faut que'],
    ['Après il faut que, je veux que, avant que : « il faut que je parte »',
     'Radical de ils + e, es, e, ions, iez, ent',
     'Irréguliers : sois, aies, fasse, puisse, aille'],
    [{ t: 'Il faut que tu viennes.', gloss: 'Du musst kommen.' },
     { t: 'Je veux qu’il soit là.', gloss: 'Ich will, dass er da ist.' }]),
  F('g-b1-relatifs', 'Les relatifs : qui, que, où', ['relatifs', 'qui que'],
    ['qui = sujet : « l’ami qui habite ici »', 'que = objet : « le film que j’ai vu »',
     'où = lieu/temps : « la ville où je vis »'],
    [{ t: 'C’est le mot que je cherchais.', gloss: 'Das ist das Wort, das ich suchte.' },
     { t: 'Le jour où on s’est rencontrés.', gloss: 'Der Tag, an dem wir uns trafen.' }],
    ['que + voyelle → qu’ ; qui ne s’élide jamais']),
  F('g-b1-discours-indirect', 'Le discours indirect', ['discours indirect'],
    ['dire que, demander si, demander ce que',
     '« Il dit qu’il vient. » / « Elle demande si tu viens. »'],
    [{ t: 'Il m’a demandé ce que je faisais.', gloss: 'Er fragte mich, was ich mache.' },
     { t: 'Je pense qu’elle a raison.', gloss: 'Ich denke, sie hat recht.' }]),
  F('g-b2-subjonctif-emotion', 'Subjonctif après émotion et doute', ['subjonctif emotion', 'doute'],
    ['Émotion : je suis content que, j’ai peur que + subjonctif',
     'Doute : je ne pense pas que, il est possible que + subjonctif',
     'Certitude → indicatif : « je pense qu’il vient »'],
    [{ t: 'Je suis ravi que tu sois là.', gloss: 'Ich freue mich, dass du da bist.' },
     { t: 'Je doute que ce soit vrai.', gloss: 'Ich bezweifle, dass das stimmt.' }]),
  F('g-b2-passif', 'La voix passive', ['passif', 'passive'],
    ['être + participe (accordé) : « La maison a été construite en 1900 »',
     'Agent avec par : « par mon grand-père »',
     'Souvent remplacé par on : « On m’a dit que… »'],
    [{ t: 'Ce livre a été écrit en 1950.', gloss: 'Dieses Buch wurde 1950 geschrieben.' },
     { t: 'On m’a volé mon vélo.', gloss: 'Mir wurde das Rad gestohlen.' }]),
  F('g-b2-concordance', 'La concordance des temps', ['concordance'],
    ['Il dit qu’il vient → Il a dit qu’il venait',
     'futur → conditionnel : Il a dit qu’il viendrait',
     'passé composé → plus-que-parfait : Il a dit qu’il était venu'],
    [{ t: 'Elle a expliqué qu’elle travaillait le soir.', gloss: 'Sie erklärte, dass sie abends arbeitet.' }]),
  F('g-b2-connecteurs-log', 'Connecteurs : bien que, pourtant, ainsi', ['connecteurs', 'bien que', 'pourtant'],
    ['bien que + subjonctif : « bien qu’il pleuve »',
     'pourtant, cependant = contraste ; donc, ainsi = conséquence',
     'malgré + nom : « malgré la pluie »'],
    [{ t: 'Bien que ce soit difficile, j’essaie.', gloss: 'Obwohl es schwer ist, versuche ich es.' },
     { t: 'Il est tard, pourtant je reste.', gloss: 'Es ist spät, trotzdem bleibe ich.' }]),
  F('g-b2-hypothese', 'Les hypothèses avec si', ['hypothese', 'si + imparfait'],
    ['Réel : si + présent → futur : « S’il pleut, on restera »',
     'Irréel présent : si + imparfait → conditionnel : « Si j’étais riche, je voyagerais »',
     'Irréel passé : si + plus-que-parfait → conditionnel passé'],
    [{ t: 'Si tu venais, on cuisinerait ensemble.', gloss: 'Wenn du kämst, würden wir zusammen kochen.' },
     { t: 'Si j’avais su, je serais venu.', gloss: 'Hätte ich es gewusst, wäre ich gekommen.' }],
    ['Jamais de conditionnel ni de futur directement après si']),
  F('g-b2-nominalisation', 'La nominalisation', ['nominalisation'],
    ['Verbe → nom : partir → le départ, arriver → l’arrivée',
     '-tion, -ment, -age, -ure : construire → la construction'],
    [{ t: 'La lecture du soir me détend.', gloss: 'Das Lesen am Abend entspannt mich.' }]),
  F('g-c1-subjonctif-passe', 'Subjonctif passé & plus-que-parfait', ['subjonctif passe', 'plus-que-parfait'],
    ['Subjonctif passé : que j’aie fait, que je sois venu',
     'Plus-que-parfait : j’avais fait, j’étais venu (avant un autre passé)'],
    [{ t: 'Je regrette qu’il soit parti si tôt.', gloss: 'Schade, dass er so früh gegangen ist.' },
     { t: 'J’avais déjà mangé quand il est arrivé.', gloss: 'Ich hatte schon gegessen, als er kam.' }]),
  F('g-c1-mise-en-relief', 'La mise en relief', ['mise en relief', 'ce qui'],
    ['C’est … qui/que : « C’est toi qui décides »',
     'Ce qui / ce que … c’est : « Ce qui me plaît, c’est le calme »'],
    [{ t: 'Ce que j’aime ici, c’est la lumière.', gloss: 'Was ich hier mag, ist das Licht.' }]),
  F('g-c1-gerondif', 'Participe présent & gérondif', ['gerondif', 'participe present'],
    ['en + -ant : « en marchant » = während/indem',
     'Radical de nous + ant : faisant, ayant, étant (irrég.)'],
    [{ t: 'J’apprends en écoutant.', gloss: 'Ich lerne beim Zuhören.' },
     { t: 'Tout en parlant, elle dessinait.', gloss: 'Während sie sprach, zeichnete sie.' }]),
  F('g-c1-en-y', 'Les pronoms en et y', ['en / y', 'pronoms en'],
    ['en remplace de + chose : « J’en parle », « J’en ai deux »',
     'y remplace à + lieu/chose : « J’y vais », « J’y pense »',
     'Ordre : en/y après les autres pronoms : « Je lui en parle »'],
    [{ t: 'Du café ? Oui, j’en veux bien.', gloss: 'Kaffee? Ja, gern (davon).' },
     { t: 'Paris ? On y va en mai.', gloss: 'Paris? Wir fahren im Mai hin.' }])
];
