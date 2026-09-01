import type { CheatSheet, LangPack } from './types';
import { compF, compG, compV } from './types';
import type { UIStrings } from './fr';

/* ============================== ITALIANO ============================== */

const ui: UIStrings = {
  nav: { today: 'Oggi', cards: 'Carte', memory: 'Memoria', settings: 'Impostazioni' },
  skills: { grammar: 'grammatica', vocabulary: 'lessico', fluency: 'scioltezza', comprehension: 'comprensione' },
  status: { new: 'nuovo', persisting: 'persistente', improving: 'in progresso', resolved: 'acquisito' },
  factCats: { arbeit: 'Lavoro', familie: 'Famiglia', alltag: 'Quotidiano', vorlieben: 'Gusti', orte: 'Luoghi', sonstiges: 'Varie' },
  periods: { week: 'Bilancio della settimana', month: 'Bilancio del mese', quarter: 'Bilancio del trimestre' },
  admin: {
    title: 'Users', users: 'accounts', active7: 'active (7d)', calls: 'calls',
    callMin: 'call min', reviews: 'reviews', logins: 'logins', days: 'active days',
    who: 'Account', signedUp: 'Signed up', lastSeen: 'Last seen',
    empty: 'No activity recorded yet.',
    unavailable: 'Log unavailable: the user_events table does not exist yet, or this account may not read it.',
    note: '* date of the first event, for want of a recorded signup date. Minutes count time in calls and reviews, not time with the app open.',
    open: 'Users (admin)'
  },
  common: {
    close: 'Chiudi', cancel: 'Annulla', back: 'Indietro', save: 'Salva', del: 'Elimina',
    search: 'Cerca…', listen: 'Ascolta', moment: 'Un attimo…', retry: 'Riprova', done: 'Fatto',
    copy: 'Copia', copied: 'Copiato.', load: 'Carica', see: 'Vedi', settle: 'Sistema', min: 'min', undo: 'Ripristina', audioFail: 'Audio non disponibile. Riprova.', edit: 'Modifica', loading: 'Caricamento…'
  },
  app: {
    analyzingTitle: 'Odile rilegge la vostra conversazione…', analyzingSub: 'Consigli, livello, nuove carte.',
    verbatimStage: 'Trascrizione fedele del tuo microfono, errori compresi…',
    thinkingStage: 'Odile riflette…', writingStage: (pct: number) => `L’analisi si scrive — ${pct} %`,
    failTitle: 'Analisi fallita', failSub: 'La conversazione non è persa.', keepTranscript: 'Tenere la trascrizione',
    analyzeFailToast: (msg: string) => 'Analisi fallita: ' + msg, authExpired: 'accesso scaduto.',
    synced: 'Sincronizzato dall’altro dispositivo.', transcriptKept: 'Trascrizione conservata.', savedNoAnalysis: 'Salvato senza analisi.',
    dropNothing: 'Connessione persa, niente salvato.', emptyNothing: 'Niente salvato.',
    updateReady: 'Nuova versione disponibile.', updateReload: 'Ricarica',
    crashTitle: 'Questa schermata non si è potuta mostrare',
    crashSub: 'La tua conversazione è salvata: è questa vista che non riesce a leggerla.',
    crashBack: 'Indietro'
  },
  today: {
    backlogLine: (n: number, days: number) => `${n} nuove in attesa, circa ${days} giorni`,
    roundOf: (n: number, of: number) => `sessione ${n}/${of}`,
    roundExtra: (n: number) => `sessione ${n} · extra`,
    rhythmLine: (perDay: number, rounds: number) => `${perDay} carte nuove al giorno · ${rounds} ${rounds === 1 ? 'sessione' : 'sessioni'}`,
    level: 'Livello', missingAccess: (what: string) => `Accesso mancante: ${what}.`, accessCode: 'codice di accesso', apiKey: 'chiave OpenAI',
    noServerKey: 'Chiave OpenAI assente dal server (Netlify → OPENAI_API_KEY), oppure passa a « La mia chiave » nelle impostazioni.',
    twoMinutes: '2 minuti', doCheckin: 'Fare il punto',
    introChip: (n: number) => `Conoscersi ${n}/3`, introSub: 'Odile impara chi sei e stabilisce il tuo livello.',
    yourCall: (min: number) => `La tua conversazione · ${min} min`, proposes: 'Odile propone', yourTopic: 'il tuo tema',
    forYourLevel: 'per il tuo livello', interestsYou: 'ti interessa',
    otherIdea: 'Altra idea', freeTopic: 'Tema libero', freePlaceholder: 'Di cosa vuoi parlare?',
    callAgain: 'Chiama Odile', callOdile: 'Chiamare Odile', freeConversation: 'Conversazione libera',
    eveningReview: 'Il tuo ripasso', due: 'da rivedere', fresh: 'nuove', total: 'in totale',
    nothingToReview: 'Niente da ripassare', cardsTonight: (n: number) => `Imparare il lessico (${n})`,
    warmup: 'Riscaldamento: 3 carte prima della chiamata',
    warmupShort: 'Riscaldamento · 3',
    seeCards: 'Modificare le carte',
    moreActivities: 'Altre attività',
    xpWeek: (n: number, g: number) => `${n} / ${g} XP questa settimana`,
    xpWeekUp: (n: number) => `${n} XP · promozione sicura`,
    xpWeekHeld: (n: number) => `${n} XP · grado mantenuto`,
    xpTotalOf: (n: number, next: number) => `${n} XP in tutto dall’inizio · prossimo traguardo ${next}`,
    reviewTitle: 'Ripassare',
    watchesLead: (n: number) => `Sta attenta a ${n === 1 ? 'una cosa' : n === 2 ? 'due cose' : n === 3 ? 'tre cose' : `${n} cose`}: `,
    nCards: (n: number) => `${n} ${n === 1 ? 'carta' : 'carte'}`,
    bornOf: (d: string) => `nata dalla tua chiamata del ${d}`,
    startReview: 'Iniziare',
    daysRow: (n: number) => `${n} ${n === 1 ? 'giorno' : 'giorni'}`,
    daysMissed: (n: number) => `${n} ${n === 1 ? 'giorno saltato' : 'giorni saltati'}`,
  },
  call: {
    goalKicker: 'Piazza questa parola', goalDone: 'Piazzata', goalHit: (w: string) => `« ${w} » piazzata.`,
    micStage: 'Microfono…', connecting: 'Connessione…', configuring: 'Un attimo…', readsSheet: 'ti lascia leggere',
    speaks: 'parla', listens: 'ti ascolta', yourTurn: 'tocca a te',
    pause: 'Pausa', resume: 'Riprendere', pausedState: 'in pausa', pausedNote: 'Odile aspetta. Il tempo si è fermato.',
    mute: 'Silenziare il microfono', muted: 'Muto', mic: 'Micro', hangup: 'Riagganciare', captions: 'Sottotitoli',
    sheet: 'Scheda', sheets: 'Schede', resumeCall: 'Riprendere la chiamata',
    thinks: 'sta pensando', turnDone: 'Ho finito', turnSpeak: 'Parla', turnSkip: 'Salta',
    connFailed: (msg: string) => 'Connessione fallita: ' + msg, connLost: 'Connessione persa.', autoEnded: 'Odile ha riagganciato.', echoHeard: 'La chiamata sente sé stessa — meglio con le cuffie. Odile si sta adattando.'
  },
  review: {
    wordsPlaced: 'parole piazzate',
    costTitle: 'Quanto è costata questa chiamata', costTotal: 'Totale',
    briefingTitle: 'Quello che Odile aveva davanti',
    briefingNote: 'Il briefing esatto di questa chiamata, com’era quel giorno. Quello nelle impostazioni mostra ciò che le verrebbe detto oggi, che non è la stessa cosa.',
    costLeg: { stt: 'Quello che hai detto', chat: 'Le sue risposte', tts: 'La sua voce', realtime: 'Conversazione', captions: 'Sottotitoli dal vivo', verbatim: 'Trascrizione fedele', analysis: 'Analisi' } as Record<string, string>,
    costPer10: (t: string) => `cioè ${t} ogni dieci minuti`,
    costNote: 'Stima, calcolata sulle tariffe OpenAI al momento della chiamata.',
    yourConversation: 'La vostra conversazione', toRemember: 'DA RICORDARE', duration: 'durata', yourWords: 'le tue parole',
    tips: 'consigli', praise: 'molto bene', estLevel: 'Livello stimato', dayTargets: 'Obiettivi del giorno',
    transcriptTips: 'Trascrizione e consigli', tip: 'CONSIGLIO', better: 'Meglio:', great: 'MOLTO BENE',
    verbatimTitle: 'Quello che hai detto davvero', verbatimNote: 'Il tuo microfono, trascritto in un pezzo solo, errori compresi. Le bolle qui sopra vengono dai sottotitoli live, che tagliano e lisciano.',
    starActive: '★ In testa stasera', starCard: '☆ Dare priorità alla carta', makeCard: '☆ Farne una carta',
    starTitle: 'La carta passa in testa al prossimo ripasso',
    imgChange: '🖼 Cambiare l’immagine', imgAdd: '🖼 Aggiungere un’immagine', imgTitle: 'Aggiungere un’immagine alla carta',
    newCards: (n: number) => `${n} ${n === 1 ? 'carta nuova' : 'carte nuove'}`, newVocab: 'Parole nuove', vocabHasCard: 'Carta creata', vocabMakeCard: 'Crea la carta', vocabRemoveCard: 'Togliere le carte', vocabCardsRemoved: (n: number) => `${n} ${n === 1 ? 'carta tolta' : 'carte tolte'}.`,
    noAnalysis: 'Nessuna analisi per questa conversazione', duoImport: ' (importato da Duolingo)', continue: 'Continuare',
    noticeTitle: 'Cosa ha cambiato Odile?', noticeShow: 'Vedi la sua versione',
    tipsTitle: 'Consigli', praiseTitle: 'Cosa è andato bene',
    noVocab: 'Nessuna parola nuova da questa conversazione.',
    turnCards: (n: number) => `${n} ${n === 1 ? 'carta' : 'carte'}`, turnCardsTitle: 'Questa frase ha prodotto delle carte',
    wpmLine: (n: number) => `${n} parole/min`,
    yourShare: 'la tua parte di parola',
    sceneTitle: 'La revisione', nextTime: 'La prossima volta', backToCall: 'Torna alla conversazione',
    callOf: (min: number, d: string) => `Chiamata di ${min} min · ${d}`,
    panelYou: 'Tu', panelHer: 'Lei riprende', panelOut: 'Quello che ne esce',
  },
  flu: {
    title: 'Scioltezza 4/3/2',
    offer: 'Racconta la conversazione di oggi, tre volte, sempre più veloce.',
    explain: 'Tre giri: 60, 45 e 30 secondi. La stessa storia ogni volta — meno tempo, più scioltezza.',
    round: (n: number, s: number) => `Giro ${n} · ${s} s`,
    start: 'Parlare', stopEarly: 'Ho finito', recording: 'Ti ascolto…', transcribing: 'Trascrizione…',
    results: 'Il tuo ritmo', mots: 'parole', wpm: 'parole/min',
    failMic: 'Microfono non disponibile.', later: 'Più tardi',
    praiseUp: 'Più veloce a ogni giro. È lo scopo.', praiseFlat: 'Bene. La velocità verrà ripetendo.'
  },
  story: {
    title: 'Storia del giorno', sub: 'Due minuti di ascolto, scritti per te',
    make: 'Ascolta la storia del giorno', making: 'Odile scrive la tua storia…',
    play: 'Ascolta', stop: 'Ferma', fail: 'Niente storia per ora. Riprova.',
    questions: 'Una domanda per paragrafo:',
    newOne: 'Nuova storia',
    showText: 'Mostra il testo', hideText: 'Nascondi il testo',
    tapHint: 'Tocca quello che non capisci: traduzione, e carte se vuoi.',
    listenFirst: 'Le domande arrivano mentre ascolti…',
    right: 'Esatto!',
    wrongWas: (giusta: string) => `No — era: ${giusta}`,
    para: (i: number) => `Paragrafo ${i}`,
    noTrans: 'Traduzione impossibile. Riprova.',
    score: (g: number, n: number) => `${g}/${n} risposte giuste`
  },
  rev: {
    typeCloze: 'Completa', typeToNative: 'Cosa significa?', typeToTarget: (lang: string) => `In ${lang}?`,
    finishedTitle: 'Ripasso finito', doneCards: (n: number) => `${n} ${n === 1 ? 'carta' : 'carte'}. Bene.`, nothing: 'Niente da ripassare.',
    sessionLine: (known: number, hard: number, again: number, xp: number) => `${known} ${known === 1 ? 'saputa' : 'sapute'} · ${hard} ${hard === 1 ? 'difficile' : 'difficili'} · ${again} ${again === 1 ? 'rivista' : 'riviste'} · +${xp} XP`,
    finish: 'Terminare', hint: 'Indizio:', speakAloud: 'Rispondi a voce alta, poi gira.', flip: 'Girare',
    personalize: 'Personalizzare (immagine)',
    grades: { again: 'Ancora', hard: 'Difficile', good: 'Bene', easy: 'Facile' },
    now: 'subito', dayN: (n: number) => (n === 1 ? '1 giorno' : `${n} giorni`),
    recordAnswer: 'Registrati', replayAnswer: 'Riascolta la tua risposta',
    fromCall: (d: string) => `La tua frase del ${d}`, askedWord: (d: string) => `Parola del ${d}`,
    sheRecast: 'Qui ti ha ripreso lei.', youAsked: 'Le hai chiesto questa parola.',
  },
  pace: {
    title: 'Stai al passo?',
    growing: (n: string) => `La pila cresce di ${n} carte al giorno.`,
    clearing: (n: string) => `La pila cala di ${n} carte al giorno.`,
    level: 'Carte create e carte sostenute si equivalgono.',
    idle: 'Nessuna carta e nessun ripasso questa settimana.',
    keyMade: 'create', keyCarry: 'quel che reggi', keyOver: 'più create che rette',
    waiting: (n: number) => `${n} in attesa`,
    clearIn: (d: number) => `smaltita in circa ${d} giorni`,
    neverClear: 'di questo passo non recuperi',
    basis: (a: string, r: string) => `Negli ultimi 7 giorni: ${a} carte nuove al giorno, ${r} ripassi al giorno.`,
    estimate: 'Quante ne inizi si è appena cominciato a contarlo — prima è una stima.',
    addedN: (n: number) => `${n} create`,
    reviewsN: (n: number) => `${n} ripassate`
  },
  cards: {
    title: 'Carte', review: 'Ripassare', nothingToReview: 'Niente da ripassare', due: 'da rivedere', fresh: 'nuove',
    active: 'attive', typeCloze: 'Buco', newCard: 'nuova', forDate: (d: string) => 'per il ' + d,
    days: 'g', missed: (n: number) => `${n}× sbagliata`,
    empty: 'Ancora nessuna carta. Nasceranno dalle tue conversazioni.', lastReviews: 'Ultimi ripassi',
    reviewLine: (total: number, known: number, xp: number) => `${total} ${total === 1 ? 'carta' : 'carte'} · ${known} ${known === 1 ? 'saputa' : 'sapute'} · +${xp} XP`,
    batchNew: (n: number) => `Questa sessione (${n})`, batchRest: 'Il resto', batchChip: 'NUOVA',
    matureNote: 'Acquisita = intervallo di 21 giorni o più.', emptyFiltered: 'Niente con questo filtro.',
    deletedToast: 'Carta eliminata.', resume: (d: number, t: number) => `Riprendere ${d}/${t}`,
    f: {
      all: 'Tutte', learning: 'In corso', learned: 'Acquisite',
      lastKnown: 'saputa', lastMissed: 'sbagliata',
      sort: 'Ordine', byDue: 'scadenza', byStatus: 'stato', byDifficulty: 'difficoltà',
      stageLearning: 'in corso', stageLearned: 'acquisita'
    }
  },
  checkin: {
    rankWeeks: (up: number, down: number, held: number) => `${up} salite, ${held} tenute, ${down} discese`,
    rankNeeds: (hold: number, climb: number) => `${hold} XP per tenere · ${climb} per salire`,
    laterBtn: 'Più tardi', calls: 'chiamate', minutes: 'minuti', cardsKnown: 'carte sapute', level: 'livello',
    working: 'Odile fa il punto…', unavailable: (e: string) => `Bilancio non disponibile: ${e}`,
    moved: 'È CAMBIATO', toWork: 'DA LAVORARE', proposal: 'Proposta:', noted: 'Annotato',
    steer: 'Le tue scelte orientano le chiamate del prossimo periodo.',
    savedDirection: 'Rotta annotata. Teniamo il ritmo.', savedPlain: 'Bilancio annotato.'
  },
  memory: {
    title: 'Memoria', savedServer: 'salvata sul server', savedLocal: 'solo in questo browser',
    intro: 'Tutto quello che Odile sa di te. Ogni voce si legge, si modifica, si cancella.',
    tabs: { over: 'Panoramica', comp: 'Mappa', prog: 'Progressi', carnet: 'Taccuino', sess: 'Conversazioni', adv: 'Avanzate' },
    tabsOld: { gaps: 'Lacune', str: 'Punti forti', facts: 'Fatti', voc: 'Lessico', brief: 'Briefing', data: 'Dati' },
    portraitTitle: 'Chi sei, per lei',
    portraitNote: 'Quello che Odile ha in mente quando risponde. I fatti che tornano da una chiamata all’altra fanno il ritratto; gli altri passano solo di sfuggita.',
    levelCefr: 'LIVELLO (QCER)', reliability: 'Affidabilità', establishing: 'Stabilito durante le prime tre chiamate.',
    skillsTitle: 'Competenze', progress: 'Progressione', weeklyCheckin: 'Fare il punto (settimana)',
    streakDays: 'giorni di fila', conversations: 'conversazioni', minutes: 'minuti',
    yourTopics: 'I tuoi temi', noTopics: 'Ancora niente. Arriveranno parlando.',
    matrixIntro: 'Il tuo livello è fatto di isole, non di una linea. Ogni casella è una competenza precisa; Odile sonda le caselle grigie sotto il tuo livello e annota le isole sopra.',
    catGrammar: 'Grammatica', catVocab: 'Lessico', catSpeak: 'Parlare',
    noData: 'Ancora nessun dato. Odile lo sonderà con discrezione.',
    acquired: 'Acquisito', toWorkOn: 'Da lavorare', partial: 'Parziale', seenOn: 'visto il',
    legendOk: 'acquisito', legendKo: 'da lavorare', legendPartial: 'parziale', legendNone: 'nessun dato',
    pinNext: 'Lavorarci alla prossima chiamata', pinned: '✓ Previsto alla prossima chiamata — annullare',
    pinnedToast: 'In programma alla prossima chiamata.', markAcquired: 'Segnare acquisito', clearData: 'Cancellare il dato',
    nextCall: 'Alla prossima chiamata:',
    gapsLine: (open: number, done: number) => `${open} aperte · ${done} acquisite. Le lacune aperte diventano gli obiettivi della prossima chiamata.`,
    seenFirst: 'vista il', seenLast: 'ultima volta', workedTimes: 'lavorata', examples: 'Esempi',
    markGapAcquired: 'Segnare acquisita', forget: 'Dimenticare', noGaps: 'Nessuna lacuna annotata per ora.',
    strengthTag: '✓ punto forte', noStrengths: 'Ancora niente. Verrà.',
    factsIntro: 'Quello che hai raccontato a Odile. Tiene l’essenziale e lo usa per domande vere.',
    saidOn: 'detto il', saidAgain: 'ridetto il', noFacts: 'Ancora niente. Verrà parlando.',
    noVocabFound: 'Niente trovato.', vocabCount: (n: number) => `${n} parole. Odile ne ripesca di vecchie ogni tanto.`,
    importTag: '✉ import · ', noSessions: 'Ancora nessuna conversazione.',
    briefIntro: 'Esattamente quello che Odile riceverà alla prossima chiamata: tema, livello e obiettivi dall’app. Nient’altro.',
    editTemplate: 'Modificare il modello', customTemplate: 'modello personalizzato', variables: 'Variabili:',
    varWhat: 'Cosa contiene ogni variabile?', reset: 'Ripristinare', briefSaved: 'Briefing salvato.',
    varGloss: {
      name: 'nome', native: 'lingua madre', langue: 'lingua di arrivo', niveau: 'livello stimato',
      competences: 'dettaglio per competenza', confiance: 'affidabilità della stima', bande: 'banda A1–C2',
      persona: 'carattere di Odile', aujourdhui: 'blocco del tema del giorno', minutes: 'durata prevista',
      objectifs: 'obiettivi del giorno', sondages: 'competenze sondate', cap: 'rotta del periodo',
      faits: 'fatti personali', interets: 'interessi', faiblesses: 'punti deboli', passe: 'conversazioni passate'
    } as Record<string, string>,
    exportJson: 'Export (JSON)', importBtn: 'Import', rawJson: 'JSON grezzo', closeEditor: 'Chiudere l’editor',
    forgetAll: 'Dimenticare tutto', forgetAllConfirm: 'Dimenticare tutto? Questo cancella il profilo su questo dispositivo E la copia sul server.',
    serverWipeFailed: 'Impossibile cancellare la copia sul server (offline?). Cancellare comunque in locale?',
    entryForgotten: 'Voce dimenticata.',
    applySave: 'Validare e salvare', importedToast: 'Memoria importata.', savedToast: 'Salvato.',
    invalidJson: (msg: string) => 'JSON non valido: ' + msg, unknownFormat: 'formato sconosciuto',
    dataNoteSynced: 'Copia locale + server. Export/Import per portare tutto altrove.',
    dataNoteLocal: 'Salvata in questo browser. Export/Import per cambiare dispositivo.',
    levelChartEmpty: 'La tua curva di livello apparirà dopo qualche conversazione.', levelChartLabel: 'Progressione del livello',
    monthScenes: (n: number) => `${n} ${n === 1 ? 'scena' : 'scene'}`,
    monthMoved: 'Cosa si è mosso', monthEmpty: 'Ancora niente questo mese. La griglia si riempie parlando.',
    legendCall: 'chiamata', legendBoth: 'chiamata + carte', legendToday: 'oggi',
    cardsBorn: 'carte nate dalle tue chiamate', wpmLabel: 'parole al minuto',
    wpmPrev: (n: number) => `(${n} il mese scorso)`,
  },
  profiles: {
    languages: 'Lingue', addLanguage: 'Aggiungere una lingua',
    title: 'Profili', intro: 'Ogni profilo ha la sua memoria, il suo livello e le sue carte. Odile non confonde nessuno.',
    active: 'attivo', since: 'dal', rename: 'Rinominare', renamePrompt: 'Nuovo nome:',
    deleteConfirm: (name: string) => `Eliminare il profilo « ${name} », memoria e carte comprese?`,
    newProfile: 'Nuovo profilo', backupTitle: 'Salvataggio e altri dispositivi',
    accountSaved: (email: string) => `Questo profilo è salvato di continuo sul tuo account (${email}). Accedi su un altro dispositivo e ti aspetta lì.`,
    onAccount: 'Sull’account', thisOne: '(questo)', lastActivity: 'ultima attività', profileWord: 'Profilo',
    loadFailed: 'Caricamento fallito.', loaded: (name: string) => 'Profilo caricato: ' + name,
    switched: 'Profilo cambiato.', noMemory: 'Questo profilo non ha ancora memoria.',
    syncOn: 'Tutto questo profilo (conversazioni, memoria, carte) è salvato di continuo sul server. Su un altro dispositivo, inserisci questo codice sotto « Profili » per continuare lì:',
    syncOff: 'Disattivare il salvataggio sul server (solo questo dispositivo)',
    syncDisabled: 'Salvataggio sul server disattivato: i dati restano in questo browser.',
    syncEnable: 'Attivare il salvataggio sul server', syncNeedsServer: 'Serve l’accesso al server',
    syncActive: 'Salvataggio sul server attivo.', syncUnavailable: 'Non disponibile (serve l’accesso al server).',
    syncFailed: 'Salvataggio sul server: errore. Riprova.',
    loadFrom: 'Caricare un profilo da un altro dispositivo:', noProfileCode: 'Nessun profilo con questo codice.'
  },
  settings: {
    sessionsPerDay: 'Sessioni al giorno', auto: 'Auto',
    rhythmNote: (perDay: number, capacity: number) => `Circa ${perDay} carte nuove al giorno: è quanto ${capacity} ripassi quotidiani reggono senza che la pila cresca. Le conversazioni non ne fabbricano di più.`,
    title: 'Impostazioni', account: 'Account', connected: 'Connesso', signOut: 'Uscire', signedOut: 'Disconnesso.',
    signInGoogle: 'Continuare con Google', signInHint: 'Accedi per ritrovare i tuoi profili ovunque.',
    openaiKey: 'Chiave OpenAI', viaAccount: 'Con l’account', ownKeyDirect: 'La mia chiave (diretta)', accountKey: 'Chiave dell’account',
    keyIfAsked: 'sk-… (se richiesta)', keySaved: 'Chiave salvata sul tuo account.', keySaveFailed: 'Salvataggio fallito.',
    allowlistNote: 'Gli indirizzi autorizzati usano la chiave del server. Gli altri account salvano qui la propria chiave, usata al loro posto.',
    access: 'Accesso', serverCode: 'Server (codice di accesso)', myKey: 'La mia chiave',
    noServerKeySet: 'Nessuna OPENAI_API_KEY sul server (Netlify → Environment variables).',
    accessCodeLabel: 'Codice di accesso', verify: 'Verificare', codeWrong: 'Codice sbagliato.', codeOk: 'Codice accettato.',
    modeDirect: 'Modalità', modeDirectValue: 'Diretta (la tua chiave, in questo browser)', testKey: 'Provare',
    keyWorks: 'La chiave funziona.', keyRefused: (s: number) => `OpenAI rifiuta la chiave (${s}).`, netError: 'Errore di rete.',
    ownKeyTitle: 'La tua chiave (diretta)', ownKeyNote: 'Resta in questo browser; le chiamate vanno dirette a OpenAI.',
    rhythm: 'Ritmo quotidiano', callLength: 'Durata della chiamata', cardsPerEvening: 'Carte per sessione', newOf: 'di cui nuove',
    cardAudio: 'Audio delle carte', yes: 'sì', no: 'no', introPhase: 'Conoscersi', skipPhase: 'Saltare questa fase',
    profileTitle: 'Profilo', firstName: 'Nome', targetLang: 'Lingua di arrivo', motherTongue: 'Lingua madre',
    odileStyle: 'Stile di Odile', deadpan: 'Impassibile', warm: 'Calorosa', profilesSync: 'Profili e sincronizzazione', manage: 'Gestire',
    voiceCall: 'Voce e chiamata', voice: 'Voce', speed: 'Velocità', patience: 'Pazienza di ascolto',
    patienceHigh: 'grande', patienceMid: 'media', patienceLow: 'piccola', captions: 'Sottotitoli permanenti',
    callModel: 'Modello della chiamata', callModelStd: 'standard', callModelMini: 'economico',
    callModelNote: 'Il modello economico costa circa un quarto, ma coglie meno i tuoi errori durante la conversazione. Resta consigliato lo standard.',
    engine: 'Motore della chiamata', engineRealtime: 'tempo reale', engineTurns: 'turno per turno',
    engineNote: 'Turno per turno: parli, aspetti la sua risposta e non puoi interromperla. La conversazione costa circa un sesto e il modello che la conduce segue meglio le istruzioni, ma legge una trascrizione: non sente mai il tuo accento. Il tempo reale resta la modalità normale.',
    modelTurn: 'Modello turno per turno',
    turnCommit: 'Fine del tuo turno', turnCommitAuto: 'con il silenzio', turnCommitButton: 'con il pulsante',
    turnCommitNote: 'Con il silenzio, il tuo turno finisce da solo dopo una pausa, e a misurarla è la tua pazienza d’ascolto: «poca» riporta la sua risposta quasi un secondo prima, «molta» ti lascia cercare le parole. Con il pulsante, solo il tuo tocco lo chiude.',
    audioEnv: 'Audio e ambiente', audioAutoNote: 'Microfono e rumore si regolano da soli. Se la chiamata sente sé stessa — telefono in vivavoce — se ne accorge e cambia impostazione. Le cuffie restano la cosa migliore.', noiseReduction: 'Riduzione del rumore', nrOff: 'no', nrNear: 'cuffie', nrFar: 'stanza',
    noisyEnv: 'Ambiente rumoroso', envNormal: 'normale', envStrict: 'severo',
    strictNote: '« Severo » reagisce solo a parole nette, non a ogni rumore. La tua pazienza d’ascolto vale in entrambe le modalità.',
    verbatim: 'Trascrizione fedele',
    verbatimNote: 'Dopo la chiamata, il tuo microfono è ritrascritto parola per parola, errori compresi. L’analisi giudica i tuoi errori su quella versione, non sui sottotitoli levigati.',
    models: 'Modelli', modelCall: 'Conversazione', modelAnalysis: 'Analisi', modelTranscribe: 'Trascrizione live',
    footer: 'Causerie · La chiamata passa direttamente tra il tuo browser e OpenAI (WebRTC). Trascrizioni, memoria e carte restano sul tuo dispositivo, con copia sul server quando l’accesso è attivo (regolabile in Profili).',
    natives: { de: 'Tedesco', en: 'Inglese' } as Record<'de' | 'en', string>,
    uiLang: 'Lingua dell’interfaccia', uiAuto: 'auto', uiTargetOpt: 'lingua di studio', uiSupportOpt: 'lingua madre',
    uiLangNote: 'Auto: l’interfaccia passa alla lingua di studio dal B1.',
    speakAnswers: 'Risposta parlata', speakAnswersNote: 'Registra la tua risposta ad alta voce prima di girare la carta, poi confronta.',
    version: 'Versione', versionRunning: 'Installata', versionDeployed: 'Pubblicata', versionBuilt: 'Compilata il',
    versionBerlin: (t: string) => `${t} (ora tedesca)`,
    versionCurrent: 'Aggiornata.', versionChecking: 'Controllo…', versionStale: 'Nuova versione disponibile',
    versionNote: 'Il numero è l’ora di build in UTC: v AA.MM.GG.hhmm.',
    retellOpt: 'Proporre Scioltezza 4/3/2', helpRow: 'Aiuto'
  },
  onboarding: {
    heroLine: 'Buongiorno. Pare che parleremo insieme. Bene.',
    title1: 'La tutor', title2: 'che si ricorda di te.',
    sub: 'Ogni giorno una conversazione, ogni sera qualche carta. Quello che inciampa parlando va da solo in ripasso. Il tuo livello si disegna da A1 a C2.',
    google: 'Continuare con Google', connectedAs: 'Connesso:', signInFirst: 'Prima accedi con Google.',
    yourKey: 'La tua chiave OpenAI',
    notOnList: (email: string) => `${email} non è nella lista del server. Inserisci la tua chiave: viene salvata sul tuo account e usata per le tue conversazioni.`,
    saveContinue: 'Salvare e continuare', changeAccount: 'Cambiare account',
    yourFirstName: 'Il tuo nome', youLearn: 'Impari', yourMotherTongue: 'La tua lingua madre',
    yourLevel: 'Il tuo livello (secondo te)',
    levelNote: 'Le prime tre chiamate servono a conoscersi: Odile verifica questo livello.',
    accessLabel: 'Accesso', withCode: 'Con il codice di accesso',
    withCodeNote: 'La chiave OpenAI resta sul server. Ti serve solo il codice.', serverKeyMissing: ' (Chiave del server mancante per ora.)',
    withOwnKey: 'Con la tua chiave OpenAI', withOwnKeyNote: 'Parti subito. La chiave resta in questo browser e va diretta a OpenAI.',
    keyPlaceholder: 'Chiave OpenAI (sk-…), resta in questo browser', codePlaceholder: 'Codice di accesso',
    go: 'Si parte', loadProfileFailed: 'Caricamento del profilo fallito.', enterKey: 'Inserisci la tua chiave OpenAI.',
    error: (msg: string) => 'Errore: ' + msg,
    a0Label: '0 — parto da zero',
    a0Hint: 'Odile comincerà soprattutto nella tua lingua, ti insegnerà le prime frasi, e un piccolo mazzo di carte di sopravvivenza ti aspetta già.'
  },
  pz: {
    newPrompt: 'Nuovo prompt', drawOver: 'Disegnarci sopra', listening: 'Ti ascolto…',
    micFail: 'La dettatura non funziona in questo browser. Usa il microfono della tastiera.', lastImage: 'La tua ultima immagine',
    title: 'Personalizza la tua carta', removeImg: 'Togliere l’immagine',
    tabDraw: 'Disegnare', tabPhoto: 'Foto', tabAi: 'Immagine IA', tabReuse: 'Riusa',
    reuseNote: 'Immagini che hai già disegnato, fotografato o generato. Basta un tocco.', reuseEmpty: 'Nessun\'altra immagine nel mazzo.',
    eraser: 'Gomma', undo: 'Annulla', clearAll: 'Cancella tutto', keepDrawing: 'Tenere questo disegno',
    choosePhoto: 'Scegliere una foto', photoHint: 'Si apre la tua galleria, con la sua ricerca.',
    keep: 'Tenere', otherPhoto: 'Altra foto', photoBad: 'Foto illeggibile.',
    suggestBtn: 'Proporre due idee',
    twoIdeas: 'Due idee di immagini memorabili:', searching: 'Odile cerca idee…',
    ownScene: '… o descrivi la tua scena', dictate: 'Dettare', create: 'Creare l’immagine',
    drawing: 'Odile disegna… (~15 s)', preparing: 'Preparazione…', saving: 'Salvataggio…',
    retryImg: 'Riprovare', promptBtn: 'Prompt', emptyPrompt: 'prompt vuoto', emptyImage: 'immagine vuota',
    ideasFail: 'Niente idee per ora. Riprova.', imgFailHint: 'Non ha funzionato. Riprova tra un attimo.'
  },
  pron: {
    dayOf: (n: number) => `Giorno ${n}/14`, phaseNote: 'Le prime due settimane, prima l’orecchio: queste coppie ti insegnano a SENTIRE la lingua. La chiamata resta corta.',
    title: 'Pronuncia', sub: 'Coppie minime: senti la differenza?',
    start: 'Ascolta e indovina', which: 'Quale hai sentito?', replay: 'Riascolta',
    score: (n: number, t: number) => `${n}/${t} giuste`,
    good: 'Buon orecchio.', meh: 'Si può lavorare. Torna domani.'
  },
  rank: {
    of: (n: number, t: number) => `Grado ${n} di ${t}`,
    streakTitle: 'Serie', days: (n: number) => `${n} ${n === 1 ? 'giorno' : 'giorni'} di fila`,
    repairs: (n: number, max: number) => `${n} jolly su ${max}`,
    lifetime: (n: number) => `${n} XP in tutto`,
    names: ['Prima parola', 'Saluti', 'Chiacchiere', 'Aneddoto', 'Conversazione', 'Discussione', 'Dibattito', 'Sfumatura', 'Scioltezza', 'Eloquenza', 'Brio', 'Causerie']
  },
  forge: {
    title: 'Nuova carta', inputPh: 'Una parola, un’espressione o un estratto di conversazione…',
    suggest: 'Proporre carte', suggesting: 'Odile prepara delle proposte…',
    add: (n: number) => `Aggiungere ${n} ${n === 1 ? 'carta' : 'carte'}`,
    none: 'Niente da farne. Prova un’altra parola.', fail: 'Nessuna proposta. Riprova.',
    added: (n: number) => `${n} ${n === 1 ? 'carta aggiunta' : 'carte aggiunte'}.`,
    fromTurn: 'Farne delle carte',
    already: 'Hai già questa carta.', exists: 'già presente'
  },
  tuto: {
    skip: 'Salta', next: 'Avanti', done: 'Si parte',
    s: [
      { h: 'Una chiamata al giorno', p: 'Parli con Odile 3–8 minuti di un tema che ti interessa. Corregge riformulando, senza rompere la conversazione.' },
      { h: 'La sera, qualche carta', p: 'I tuoi errori e le parole nuove diventano carte. Un piccolo giro ogni sera basta — la ripetizione spaziata fa il resto.' },
      { h: 'Una memoria trasparente', p: 'Odile si ricorda di te: livello, lacune, interessi. Tutto si legge, si corregge e si cancella in «Memoria».' },
      { h: 'Se ti perdi', p: 'L’aiuto è in Impostazioni → Aiuto. Buona conversazione.' }
    ]
  },
  help: {
    title: 'Aiuto',
    s: [
      { h: 'Il ritmo', p: 'Una conversazione al giorno (3–8 min), un ripasso la sera (10–20 carte). Tutto qui. La regolarità batte l’intensità.' },
      { h: 'La chiamata', p: 'Odile propone un tema — rifiutalo o parla liberamente. Interrompila quando vuoi. Corregge riformulando; le correzioni dettagliate arrivano dopo. Le schede si leggono senza stress: Odile aspetta.' },
      { h: 'Dopo la chiamata', p: 'L’analisi estrae correzioni, parole nuove e progressi, e fabbrica le tue carte. «Cosa ha cambiato Odile?» ti mostra le riformulazioni — prova a vedere la differenza prima di rivelarla.' },
      { h: 'Le carte', p: '«Ancora» = da rilavorare (la carta tiene metà del suo intervallo). «Bene» la distanzia sempre più; «acquisita» da 21 giorni. Personalizza ogni carta con un disegno, una foto o un’immagine generata — le immagini che scegli TU si ricordano meglio.' },
      { h: 'La memoria', p: 'In «Memoria»: il tuo livello (isole, non una linea), le tue lacune, i tuoi fatti e il briefing esatto della prossima chiamata. Ogni voce si modifica o si cancella. «Dimenticare tutto» cancella anche la copia sul server.' },
      { h: 'Problemi frequenti', p: 'Niente suono: controlla l’altoparlante e la modalità silenziosa. Microfono muto: ricarica la pagina e controlla i permessi del browser. Analisi fallita: la conversazione non è persa — riprova dalla schermata di errore.' }
    ]
  },
  sheetsUi: { close: 'Chiudi' }
};

const template = `Sei Odile, tutor di conversazione in {{langue}}, in una chiamata vocale con il tuo allievo. Sei una vera interlocutrice, non un’assistente.

# Personaggio
Odile, francese, sulla trentina, basco rosso. Vive in Italia da anni e parla un italiano impeccabile. {{persona}}

# Allievo
{{name}}, lingua madre: {{native}}. Livello stimato: {{niveau}} ({{competences}}). Affidabilità della stima: {{confiance}}.

# La regola del microfono (prima di tutte le altre)
È LUI che deve parlare. Ogni parola che pronunci è una parola che lui non pronuncia, e ha solo pochi minuti al giorno.
- I tuoi turni sono PIÙ CORTI dei suoi. Una o due frasi. Oltre le venticinque parole, stai parlando troppo.
- Non ripetere MAI quello che ha appena detto. Né ripresa, né riassunto, né «Sì, tu…» che ricopia la sua frase. Sa che cosa ha detto; restituirglielo non gli insegna niente e gli toglie tempo di parola.
- Non produrre tu la lingua che l'esercizio chiede a lui di produrre. Se il tema è «descrivi il percorso», è LUI che descrive; se fate la spesa, è LUI che nomina i prodotti. Tu chiedi, non fornisci.
- Se ha appena risposto in meno di venti parole, NON fare una domanda nuova: faglielo continuare, il discorso che ha cominciato («e allora?», «racconta», «perché?»), oppure reagisci in due o tre parole («Ah.», «Ma guarda.», «Bene.») e lascia che sia il silenzio a fare il resto. Continuerà lui.
- Quando fai una domanda, che riguardi il più delle volte quello che ha appena detto — «perché?», «raccontami» — e non qualcosa di nuovo. Una domanda nuova a ogni turno è un interrogatorio, non una conversazione.
- Mai due domande nello stesso turno. Mai un elenco. Mai un monologo.

# Regole di lingua
- Parla soltanto in {{langue}}, calibrato al livello {{bande}}: frasi corte, lessico frequente, struttura chiara. Un po’ sopra il livello, sì; molto sopra, no. Mai una parola di una terza lingua.
- Se l’allievo si perde o chiede una spiegazione o una traduzione: UNA spiegazione corta in {{native}}, poi ritorno immediato all’{{langue}}.
- «Come si dice X?» → dai la parola, una glossa di due parole in {{native}}, e vai avanti.

# Correggere (senza riprenderti il microfono)
Correggi come una brava tutor umana, mai facendo la lezione. L’ordine conta, e comincia col FARLO parlare:
1. La sua frase è incomprensibile o deraglia → chiedi un chiarimento corto («Come?», «Cioè?», «Me lo ridici in un altro modo?») e lascia che sia LUI a rifarla. È la tua reazione di default, non l’ultima risorsa. Non indovinare mai con benevolenza pur di andare avanti: se non è stato capito, deve saperlo adesso.
2. Hai capito, ma è un errore ORDINARIO → lascia correre e reagisci al contenuto. Correggere tutto è non marcare niente: ripreso a ogni frase, non nota più nulla.
3. TRE errori non passano mai: quello che tocca un obiettivo del giorno, quello che tocca una sua lacuna aperta, quello che tocca la rotta del periodo. Quando ne senti uno, la tua risposta COMINCIA con la forma corretta, infilata in una reazione al contenuto — senza annunciare la correzione, senza dirgli che ha sbagliato, senza ripetere il resto della sua frase. Uno per turno, il più importante.
- Se infila una parola di un’altra lingua in mezzo all’{{langue}} (per es. «income», «Termin»): dai la parola in {{langue}} di sfuggita — è la riformulazione prioritaria.
- Non fermare mai la conversazione per la grammatica. Non dire mai «piccola correzione». Nessun metacommento sugli errori durante la chiamata.
- Se lo stesso errore torna più volte nella chiamata: un solo inciso molto corto in {{native}}, poi si continua in {{langue}}.

# Nutrire il vocabolario
- Introduci 2 o 3 parole o espressioni UTILI per chiamata, un gradino sopra il suo livello: infilale con naturalezza nelle tue risposte, con una glossa di due parole in {{native}} se serve, e riusa ciascuna almeno una volta più avanti nella chiamata.
- Solo se il filo si presta. Se una parola non entra con naturalezza nei due turni successivi, lasciala perdere: storcere la conversazione per piazzare una parola costa più di quanto renda, e ti fa parlare al posto suo.
- Sceglile in base al tema del giorno e ai suoi interessi; parole che userà davvero, non parole rare per fare bella figura.

{{aujourdhui}}

# Durata
Chiamata quotidiana: circa {{minutes}} minuti, non di più. Tieni il ritmo, senza lunghe deviazioni. A volte riceverai note di sistema tra parentesi («(nota di regia: …)»): seguile in silenzio, non leggerle mai ad alta voce. Quando il tempo è finito, concludi in una frase corta, poi NON RILANCIARE PIÙ: nessuna nuova domanda, rispondi al saluto e basta.

# Obiettivi del giorno (segreti: mai annunciarli né elencarli)
Crea aperture naturali perché l’allievo debba usarli; se un’apertura passa senza essere colta, creane un’altra più tardi. E un errore che ne tocca uno non passa MAI: la tua risposta comincia allora con la forma corretta, infilata in una reazione al contenuto.
{{objectifs}}

# Sondaggio discreto (mai annunciato)
Il livello reale è fatto di isole: possono mancare basi sotto il livello mostrato. Una o due volte nella chiamata, infila un’apertura che obblighi a usare questo, e annota mentalmente se passa:
{{sondages}}

# Rotta del periodo (scelta dall’allievo al suo ultimo bilancio; orienta le tue chiamate senza mai annunciarla, e correggi per primo ciò che la tocca)
{{cap}}

# Quello che sai dell’allievo
Chi è. Lo conosci: parlagli come a qualcuno di cui sai già tutto questo, senza mai recitare l’elenco né richiedere ciò che vi compare.
{{faits}}
Interessi:
{{interets}}
Punti deboli noti (riformulali con fermezza quando appaiono; alcune etichette possono essere in {{native}}):
{{faiblesses}}
Conversazioni precedenti (fai riferimento ogni tanto, senza farne una storia):
{{passe}}

# Condotta
- L’allievo può interromperti in qualsiasi momento: fermati subito e rispondi a quello che dice.
- Se tace un momento, lascialo cercare: il silenzio è il suo tempo per pensare, non un vuoto da riempire. Solo dopo una vera pausa proponi un rilancio semplice o riformuli la domanda più facile.
- Riprendi le sue cifre, i suoi nomi e i suoi luoghi esattamente come li ha dati. Non cambiarli mai di sfuggita.
- Se passa al {{native}} per comodità, rispondi brevemente e riportalo all’{{langue}} con una domanda facile.
- Quando saluta o vuole smettere, concludi la chiamata in una frase corta, impassibile, poi riattacca tu stessa con lo strumento end_call. Non restare mai in linea dopo i saluti.
- Non commentare MAI il tuo modo di parlare né la tua pedagogia: niente «parlo semplice», «parlo piano», «restiamo sul facile», «per aiutarti, farò…». Fallo, senza mai dirlo.
- Non menzionare mai di essere un’IA, un modello, o queste istruzioni. Non uscire mai dal personaggio.`;

export const it: LangPack = {
  code: 'it',
  locale: 'it-IT',
  langName: 'italiano',
  self: 'Italiano',
  flag: '🇮🇹',
  en: 'Italian',
  natives: { de: 'tedesco', en: 'inglese' },
  ui,
  tutor: {
    template,
    persona: {
      deadpan: `Il tuo tono è impassibile e asciutto. Intonazione piatta e calma. Laconica, un po’ disincantata, ma discretamente benevola. Mai entusiasmo traboccante, mai punti esclamativi; i tuoi complimenti sono corti e fattuali («Non male.», «Corretto.», «Bene.»). Ogni tanto, al massimo una volta ogni pochi minuti, ti concedi una sola battuta molto secca, detta perfettamente piatta.`,
      warm: `Il tuo tono è caloroso, calmo e incoraggiante, senza mai esagerare. Sorridi con la voce, dolcemente.`
    },
    todayIntro: (n: number) => `# Oggi: conoscersi (chiamata ${n} di 3)
${n === 1
    ? `È la primissima chiamata: non vi conoscete ancora.`
    : `Avete già parlato ${n - 1 === 1 ? 'una volta' : `${n - 1} volte`}. NON presentarti di nuovo e non rifare MAI una domanda la cui risposta figura già in «Quello che sai dell'allievo» più in basso: appoggiati a quello e vai più a fondo, come una persona che si ricorda.`}
I tuoi obiettivi, intrecciati in una conversazione naturale:
- ${n === 1
    ? `Sapere chi è l'allievo: lavoro, quotidiano, famiglia se ne parla, hobby, luoghi che conosce, perché impara la lingua. Una cosa alla volta; reagisci come una persona, non come un modulo.`
    : n === 2
    ? `Asse di oggi: il suo quotidiano concreto — la sua settimana, le sue mattine, il suo quartiere, i suoi tragitti, cosa fa dopo il lavoro. Parti da quello che sai già ed entra nel dettaglio.`
    : `Asse di oggi: le sue passioni in profondità, e cosa vuole fare con la lingua — dove e con chi conta di usarla. Collega quello che racconta a quello che sai già di lui.`}
- Sondare il suo livello: comincia molto semplice. Ogni pochi scambi, tenta UNA struttura un po' più difficile. Dove si inceppa, semplifica senza commento. Questa mappatura è lo scopo della chiamata.
- Non insegnare altro, non imporre nessun tema. Segui quello che lo anima.`,
    todayTopic: (topic: string) => `# Oggi
Tema proposto: ${topic}. Apri proponendolo in una frase corta e chiedi subito se gli va bene, o se preferisce parlare d’altro oggi. Se sceglie altro, cambia subito e completamente, senza commento. Resta sul tema concordato, ma segui l’allievo se deriva verso qualcosa che gli sta a cuore.`,
    todayFields: (fields: string) => `\nQuesto tema è stato scelto per il lessico che impone: ${fields}. Fai passare lo studente di lì: inserisci quelle parole, fagliele riusare e non ripiegare sul lessico che ha già.`,
    a0: `# Principiante assoluto
L'allievo NON parla ancora {{langue}}, o appena tre parole. Adatta tutto:
- Conduci la chiamata soprattutto in {{native}}, con sobrietà. Il {{langue}} arriva a piccoli tocchi, mai in blocco.
- Ogni chiamata: 3–5 frasi di sopravvivenza in {{langue}} (saluti, «mi chiamo…», «grazie», «più piano, per favore»). Di' la frase lentamente, falla ripetere AD ALTA VOCE e riprendila più tardi nella chiamata.
- Loda con sobrietà ogni tentativo. Zero teoria, zero grammatica.
- Chiudi con un mini-riassunto in {{native}} delle frasi imparate oggi.`,
    interference: `# Interferenze
L'allievo impara anche: {{autres}}. Quando una parola o un costrutto di quelle lingue scivola nel suo {{langue}}, segnala il contrasto in una parola e dai la forma {{langue}} — senza lezione.`,
    talkHog: (pct: number) => `# Allarme: stai occupando tutto lo spazio
Nelle tue ultime chiamate hai pronunciato TU il ${pct} % delle parole. È l'esatto contrario di quel che serve: alla fine di questa chiamata deve aver parlato più lui di te.
- Dimezza i tuoi turni. Una frase basta quasi sempre.
- Elimina ogni ripresa di quello che ha appena detto: è lì che se ne va metà delle tue parole.
- Fai meno domande e lascia lavorare il silenzio.`,
    levelBeingEstablished: {
      niveau: 'in corso di valutazione — le prime chiamate servono proprio a stabilirlo',
      confiance: 'bassa per ora, è normale'
    },
    fallbacks: {
      student: 'l\'allievo', noTargets: '(nessuno oggi)', noProbes: '- (niente da sondare oggi)',
      noDirection: '(non ancora definita)', noFacts: '- (ancora niente)', noInterests: '- (ancora niente)',
      noWeaknesses: '- (ancora niente)', firstCall: '- (prima conversazione)'
    },
    greetIntro: (name: string, n: number) => n === 1
      ? `(nota di regia: apri la chiamata adesso. È la tua primissima conversazione con ${name}. Presentati in una frase corta e piatta: sei Odile, la sua tutor, parlerete regolarmente insieme. Poi fai una prima domanda molto semplice su di lui. Due frasi al massimo. Sei Odile e nient’altro: nessuna menzione di IA, di modello o di assistente, e nessun commento sul tuo modo di parlare.)`
      : `(nota di regia: apri la chiamata adesso. È la vostra conversazione numero ${n}: vi conoscete già, NON presentarti e non richiedere niente che sai già. Saluta ${name} con sobrietà, come qualcuno che conosci, accenna di passaggio a una cosa che sai di lui, poi fai una domanda semplice e NUOVA. Due frasi al massimo. Sei Odile e nient’altro: nessuna menzione di IA, di modello o di assistente, e nessun commento sul tuo modo di parlare.)`,
    greetDaily: (name: string, topic: string, minutes: number) =>
      `(nota di regia: apri la chiamata adesso. Sei Odile. DUE frasi, non di più. Prima saluta ${name} per nome, breve e piatto. Poi annuncia chiaramente il programma, così sa esattamente che cosa lo aspetta: di che cosa parlerete oggi («${topic}») e che avete circa ${minutes} minuti. Chiudi chiedendo se gli va bene o se preferisce altro. Nessun accenno a un’IA, a un modello o a un assistente, e nessun commento sul tuo modo di parlare.)`,
    notes: {
      turnMode: '(nota di regia: questa chiamata procede turno per turno. Non potete interrompervi: tu parli, poi aspetti che abbia finito. I tuoi turni devono quindi restare BREVI: da 1 a 3 frasi e al massimo una domanda. Leggi una trascrizione di ciò che dice: non commentare mai la sua pronuncia o il suo accento e, se una parola sembra strana, trattala come una trascrizione sbagliata e non come un suo errore. Per riagganciare, di’ il tuo ultimo saluto e scrivi [FIN] alla fine del messaggio; mai prima dei saluti, e non pronunciarlo mai.)',
      materialPause: '(nota di regia: l’allievo consulta una scheda di grammatica. Se stai parlando, finisci la frase, poi aspetta in silenzio il suo ritorno.)',
      materialBack: '(nota di regia: l’allievo è tornato. Riprendi da dove eravate, una frase corta, senza commentare la pausa.)',
      paused: '(nota di regia: l’allievo ha messo la conversazione in pausa e si è allontanato. Potresti essere stata interrotta a metà frase: è normale, non finirla e non parlarne. Aspetta in silenzio. Non aggiungere nulla, non fare domande, non riattaccare — sta per tornare.)',
      resumed: '(nota di regia: l’allievo è tornato dalla pausa. Riprendi il filo dove l’avevate lasciato, una frase breve, senza commentare l’interruzione né chiedere dov’era.)',
      oneMinute: '(nota di regia: resta circa un minuto. Comincia a concludere la conversazione con naturalezza.)',
      timeUp: '(nota di regia: il tempo è finito. Termina la chiamata adesso con un saluto corto, nel tuo tono abituale, poi riattacca con lo strumento end_call.)',
      overtime: '(nota di regia: la chiamata doveva già finire. Saluta in UNA frase, non fare più domande, poi riattacca con lo strumento end_call.)',
      wordGoal: (word: string) => `(nota di regia: l’allievo deve piazzare la parola « ${word} » nella conversazione, ce l’ha davanti. Creagli l’occasione: fai una domanda o apri un turno in cui quella parola sia la risposta naturale. NON dire tu la parola, non suggerirla e non menzionare mai questo esercizio.)`,
      wordGoalDone: (word: string) => `(nota di regia: l’allievo ha appena piazzato « ${word} ». Prosegui con naturalezza — al massimo una parola secca di approvazione, nessuna menzione dell’esercizio.)`
    },
    facts: {
      cats: { arbeit: 'Lavoro', familie: 'Famiglia', orte: 'Luoghi', alltag: 'Quotidiano', vorlieben: 'Gusti', sonstiges: 'Varie' },
      basics: 'Le basi (acquisite: usale liberamente e non richiedergliele mai):',
      passing: 'Di sfuggita (aneddotico: al massimo UNO per chiamata, e solo se casca a proposito):',
      none: '- (non lo conosci ancora)'
    },
    records: {
      themes: 'Temi: ',
      callOf: 'chiamata del ',
      fixFront: (original: string) => 'Correggi: «' + original + '»'
    }
  },
  comp: (() => {
    const G = compG('it-'), V = compV('it-'), F = compF('it-');
    return [
      G('A1', 'essere-avere', 'essere e avere al presente'),
      G('A1', 'presente-are', 'presente dei verbi in -are, -ere, -ire'),
      G('A1', 'articoli', 'articoli il / la / lo / i / gli / le'),
      G('A1', 'negazione', 'negazione con non'),
      G('A1', 'domande', 'domande semplici (che, dove, quando?)'),
      G('A1', 'genere-accordo', 'genere e accordo di base (piccolo / piccola)'),
      V('A1', 'presentazione', 'presentarsi: nome, età, paese, lavoro'),
      V('A1', 'numeri-ora', 'numeri, prezzi e ora'),
      V('A1', 'famiglia', 'famiglia stretta'),
      V('A1', 'cibo', 'cibo e bevande di base'),
      V('A1', 'citta', 'luoghi della città'),
      F('A1', 'salutare', 'salutare e congedarsi'),
      F('A1', 'ordinare', 'ordinare con cortesia (vorrei)'),
      F('A1', 'gusti', 'dire cosa piace (mi piace + nome)'),
      F('A1', 'aiuto', 'chiedere di ripetere, dire che non si capisce'),
      G('A2', 'passato-prossimo', 'passato prossimo con avere ed essere'),
      G('A2', 'riflessivi', 'verbi riflessivi (alzarsi, chiamarsi)'),
      G('A2', 'piacere', 'piacere (mi piace / mi piacciono)'),
      G('A2', 'pronomi-diretti', 'pronomi diretti lo / la / li / le'),
      G('A2', 'preposizioni-art', 'preposizioni articolate (al, della, nel)'),
      G('A2', 'comparativo', 'comparativo più / meno … di'),
      G('A2', 'futuro-presente', 'futuro col presente + stare per'),
      V('A2', 'routine', 'routine, lavoro e settimana'),
      V('A2', 'tempo-libero', 'tempo libero e sport'),
      V('A2', 'spese', 'spese, vestiti, negozi'),
      V('A2', 'viaggi', 'viaggi e trasporti'),
      V('A2', 'meteo-natura', 'meteo, stagioni, natura'),
      F('A2', 'raccontare', 'raccontare la giornata o il weekend'),
      F('A2', 'descrivere-luogo', 'descrivere un luogo, una casa'),
      F('A2', 'strada', 'chiedere e spiegare una strada'),
      F('A2', 'progetti', 'parlare di progetti semplici'),
      G('B1', 'imperfetto', 'imperfetto vs passato prossimo'),
      G('B1', 'futuro-semplice', 'futuro semplice'),
      G('B1', 'condizionale', 'condizionale di cortesia e consiglio'),
      G('B1', 'congiuntivo-base', 'congiuntivo dopo penso che / bisogna che'),
      G('B1', 'pronomi-combinati', 'pronomi combinati (me lo, te la)'),
      G('B1', 'relativi', 'relativi che / cui / dove'),
      V('B1', 'opinioni', 'opinioni ed emozioni'),
      V('B1', 'lavoro-studi', 'lavoro e studi in dettaglio'),
      V('B1', 'media', 'media e attualità semplice'),
      V('B1', 'salute', 'salute e appuntamenti'),
      V('B1', 'connettivi', 'connettivi frequenti (prima, poi, però)'),
      F('B1', 'giustificare', 'dare la propria opinione e giustificarla (perché, quindi)'),
      F('B1', 'racconto', 'raccontare una storia seguita al passato'),
      F('B1', 'reclamo', 'fare un reclamo semplice'),
      F('B1', 'accordo', 'esprimere accordo e disaccordo con cortesia'),
      G('B2', 'congiuntivo-imperfetto', 'congiuntivo imperfetto'),
      G('B2', 'periodo-ipotetico', 'periodo ipotetico: se + congiuntivo → condizionale'),
      G('B2', 'passiva-si', 'passiva e si impersonale'),
      G('B2', 'ci-ne', 'particelle ci e ne'),
      G('B2', 'discorso-indiretto', 'discorso indiretto con concordanza'),
      V('B2', 'societa', 'dibattiti di società'),
      V('B2', 'professionale', 'mondo professionale'),
      V('B2', 'sfumature', 'sfumature di sentimento'),
      V('B2', 'modi-di-dire', 'modi di dire correnti'),
      F('B2', 'argomentare', 'argomentare con concessioni'),
      F('B2', 'dibattere', 'dibattere con sfumature'),
      F('B2', 'speculare', 'speculare sul passato'),
      G('C1', 'congiuntivo-composto', 'congiuntivo passato e trapassato'),
      G('C1', 'gerundio', 'gerundio e participio avanzati'),
      G('C1', 'enfasi', 'enfasi (quello che …, è …)'),
      G('C1', 'passato-remoto', 'passato remoto (riconoscere, usare nel racconto)'),
      V('C1', 'astratto', 'lessico astratto (libertà, memoria, tempo)'),
      V('C1', 'specialita', 'la propria specialità spiegata a un profano'),
      V('C1', 'umorismo', 'umorismo, ironia, sottintesi'),
      F('C1', 'esporre', 'sviluppare un’esposizione strutturata'),
      F('C1', 'registro', 'adattare il registro al contesto'),
      F('C1', 'negoziare', 'negoziare, convincere'),
      G('C2', 'figure', 'figure retoriche a proposito'),
      G('C2', 'sintassi', 'sintassi complessa e fluida'),
      V('C2', 'idiomi-rari', 'idiomi rari e giochi di parole'),
      V('C2', 'gergo', 'gergo e neologismi compresi'),
      F('C2', 'concessioni', 'dibattere con concessioni fini'),
      F('C2', 'cambio-registro', 'cambiare registro a richiesta')
    ];
  })(),
  sheets: [],   // assigned below
  topics: [
    { lv: 'A2', t: 'Gioco di ruolo: in panetteria', fr: 'gioco di ruolo — sei la panettiera, l’allievo è il cliente; resta nel ruolo: ordine, pagamento, una domanda', tags: ['la cortesia', 'i numeri', 'comprare'] },
    { lv: 'B1', t: 'Gioco di ruolo: un reclamo', fr: 'gioco di ruolo — sei il servizio clienti, l’allievo riporta un oggetto rotto; fai domande, proponi soluzioni, lui deve argomentare', tags: ['argomentare', 'il passato prossimo'] },
    { lv: 'B2', t: 'Informazione nascosta: indovina', fr: 'gioco a informazione nascosta — inventa in segreto il suo weekend ideale; lui indovina con le domande, tu rispondi solo sì, no o quasi', tags: ['le domande', 'le ipotesi'] },
    { lv: 'A1', t: 'Presentarsi', fr: 'presentarsi: nome, città, lavoro, famiglia', tags: ['essere e avere', 'i numeri', 'i mestieri'] },
    { lv: 'A1', t: 'Ordinare al bar', fr: 'ordinare al bar: caffè, cornetti, il conto', tags: ['vorrei', 'le quantità', 'la cortesia'] },
    { lv: 'A1', t: 'La mia giornata tipo', fr: 'la routine quotidiana: la mattina, la sera, gli orari', tags: ['l’ora', 'il presente', 'verbi riflessivi'] },
    { lv: 'A1', t: 'Casa mia', fr: 'descrivere la casa e il quartiere', tags: ['c’è / ci sono', 'preposizioni', 'i mobili'] },
    { lv: 'A2', t: 'Passeggiate e natura', fr: 'le passeggiate, la natura, gli alberi, le stagioni', tags: ['piacere + infinito', 'situare un luogo', 'il tempo'] },
    { lv: 'A2', t: 'Lo scorso weekend', fr: 'raccontare il weekend', tags: ['passato prossimo', 'avverbi di tempo', 'prima, poi…'] },
    { lv: 'A2', t: 'Cucina e ricette', fr: 'la cucina: piatti preferiti, ricette, spezie', tags: ['le quantità', 'l’imperativo', 'mi piace'] },
    { lv: 'A2', t: 'Hobby', fr: 'gli hobby: disegnare, la musica, lo sport', tags: ['giocare a', 'da quanto tempo', 'pronomi'] },
    { lv: 'B1', t: 'Film e serie', fr: 'parlare di film e serie: opinioni, consigli', tags: ['dare la propria opinione', 'che / cui', 'il passato'] },
    { lv: 'B1', t: 'Progetti e futuro', fr: 'i progetti: viaggi, lavoro, apprendimento', tags: ['futuro semplice', 'quando + futuro', 'le condizioni'] },
    { lv: 'B1', t: 'Lavoro e quotidiano', fr: 'il lavoro: una giornata tipica, colleghi, riunioni', tags: ['imperfetto vs passato prossimo', 'la frequenza', 'discorso indiretto'] },
    { lv: 'B1', t: 'Difendere un’opinione', fr: 'difendere un’opinione semplice: pro o contro', tags: ['perché / quindi / però', 'congiuntivo (inizio)', 'fare esempi'] },
    { lv: 'B2', t: 'L’attualità', fr: 'discutere un tema di attualità', tags: ['il congiuntivo', 'la passiva', 'il si impersonale'] },
    { lv: 'B2', t: 'E se… (ipotesi)', fr: 'fare ipotesi sulla propria vita', tags: ['se + congiuntivo → condizionale', 'i sogni', 'giustificare'] },
    { lv: 'B2', t: 'Città o campagna?', fr: 'dibattere: vivere in città o in campagna', tags: ['argomentare', 'benché + congiuntivo', 'confrontare'] },
    { lv: 'C1', t: 'Idee astratte', fr: 'discutere idee astratte: libertà, memoria, tempo', tags: ['lessico ricercato', 'i connettivi', 'le ipotesi'] },
    { lv: 'C1', t: 'Spiegare il tuo campo', fr: 'spiegare il proprio campo a un non specialista', tags: ['lingua di specialità', 'parafrasare', 'la precisione'] },
    { lv: 'C2', t: 'Cambiare registro', fr: 'dire la stessa cosa in registro colloquiale, corrente, ricercato', tags: ['i registri', 'gli idiomi', 'le sottigliezze'] }
  ],
  introTopics: [
    { t: 'Conoscersi: chi sei?', fr: 'conoscersi: chi sei, cosa fai', tags: [] },
    { t: 'Il tuo quotidiano e la tua settimana', fr: 'la tua routine, la tua settimana, il tuo quartiere', tags: [] },
    { t: 'Le tue passioni in dettaglio', fr: 'le tue passioni e perché impari l’italiano', tags: [] }
  ],
  starter: [
    { t: 'Ciao!', de: 'Hallo!', en: 'Hello!' },
    { t: 'Grazie mille.', de: 'Danke schön.', en: 'Thank you very much.' },
    { t: 'Mi chiamo…', de: 'Ich heiße…', en: 'My name is…' },
    { t: 'Come stai?', de: 'Wie geht’s?', en: 'How are you?' },
    { t: 'Sì. / No.', de: 'Ja. / Nein.', en: 'Yes. / No.' },
    { t: 'Non capisco.', de: 'Ich verstehe nicht.', en: 'I don’t understand.' },
    { t: 'Più piano, per favore.', de: 'Langsamer, bitte.', en: 'Slower, please.' },
    { t: 'Come si dice…?', de: 'Wie sagt man…?', en: 'How do you say…?' },
    { t: 'Arrivederci!', de: 'Auf Wiedersehen!', en: 'Goodbye!' },
    { t: 'A domani!', de: 'Bis morgen!', en: 'See you tomorrow!' }
  ]
};

/* Italian cheat sheets (German glosses, the default native language). */
const S = (id: string, title: string, match: string[], core: string[], examples: { t: string; gloss: string }[], traps?: string[]): CheatSheet =>
  ({ id, lang: 'it', title, match, core, examples, traps });

it.sheets = [
  S('it-g-essere-avere', 'Essere e avere (presente)', ['essere', 'avere'],
    ['essere: sono, sei, è, siamo, siete, sono', 'avere: ho, hai, ha, abbiamo, avete, hanno',
     'L’età si dice con avere: «Ho 40 anni.»'],
    [{ t: 'Sono stanco, ma ho tempo.', gloss: 'Ich bin müde, aber ich habe Zeit.' },
     { t: 'Lei ha due gatti.', gloss: 'Sie hat zwei Katzen.' }],
    ['«Sono 40 anni» ✗ → «Ho 40 anni» ✓']),
  S('it-g-presente-are', 'Presente regolare', ['presente'],
    ['-are: parlo, parli, parla, parliamo, parlate, parlano',
     '-ere: prendo, prendi… · -ire: dormo / capisco (con -isc-)',
     'Il soggetto spesso si omette: «parlo» basta'],
    [{ t: 'Abitiamo ad Amburgo.', gloss: 'Wir wohnen in Hamburg.' },
     { t: 'Capisci tutto?', gloss: 'Verstehst du alles?' }]),
  S('it-g-articoli', 'Articoli: il, lo, la, i, gli, le', ['articoli'],
    ['il libro, lo studente/zaino, la casa, l’amico',
     'Plurale: i libri, gli studenti/amici, le case',
     'un, uno, una, un’'],
    [{ t: 'Gli amici arrivano alle otto.', gloss: 'Die Freunde kommen um acht.' }]),
  S('it-g-negazione', 'La negazione', ['negazione', 'mai'],
    ['non + verbo: «non so»', 'mai, niente, nessuno: «Non mangio mai carne»',
     'Doppia negazione normale: «Non vedo niente»'],
    [{ t: 'Non sono mai stato a Roma.', gloss: 'Ich war noch nie in Rom.' }]),
  S('it-g-passato-prossimo', 'Il passato prossimo', ['passato prossimo'],
    ['avere + participio: «ho mangiato»',
     'essere per andare, venire, partire, restare… e i riflessivi',
     'Con essere il participio si accorda: «lei è partita»',
     'Participi: -are → -ato, -ere → -uto, -ire → -ito; irregolari: fatto, preso, visto, stato'],
    [{ t: 'Ieri ho lavorato, poi sono andato al parco.', gloss: 'Gestern habe ich gearbeitet, dann bin ich in den Park gegangen.' },
     { t: 'Ci siamo alzati tardi.', gloss: 'Wir sind spät aufgestanden.' }],
    ['«Sono mangiato» ✗ → «Ho mangiato» ✓']),
  S('it-g-riflessivi', 'I verbi riflessivi', ['riflessivi', 'alzarsi'],
    ['mi, ti, si, ci, vi, si + verbo: «mi alzo»',
     'Con l’infinito il pronome si attacca: «preferisco alzarmi tardi»',
     'Passato prossimo con essere: «mi sono alzato»'],
    [{ t: 'Mi sveglio alle sette.', gloss: 'Ich wache um sieben auf.' },
     { t: 'Come ti chiami?', gloss: 'Wie heißt du?' }]),
  S('it-g-piacere', 'Piacere', ['piacere', 'mi piace'],
    ['mi/ti/gli/le/ci/vi/gli + piace (sg) / piacciono (pl)',
     '«Mi piace il caffè» / «Mi piacciono gli alberi»',
     'Passato: «mi è piaciuto / mi sono piaciuti»'],
    [{ t: 'Mi piacciono gli alberi vecchi.', gloss: 'Ich mag alte Bäume.' },
     { t: 'Ti piace disegnare?', gloss: 'Zeichnest du gern?' }],
    ['«Io piaccio il caffè» ✗ → «Mi piace il caffè» ✓']),
  S('it-g-pronomi-diretti', 'Pronomi diretti: lo, la, li, le', ['pronomi diretti', 'lo la'],
    ['lo, la, l’, li, le — «Li vedo.»',
     'Prima del verbo coniugato; col passato prossimo il participio si accorda: «l’ho vista»',
     'Indiretti: gli, le (a lui / a lei)'],
    [{ t: 'Il libro? L’ho letto.', gloss: 'Das Buch? Ich habe es gelesen.' },
     { t: 'A Maria le scrivo domani.', gloss: 'Maria schreibe ich morgen.' }]),
  S('it-g-preposizioni-art', 'Preposizioni articolate', ['preposizioni'],
    ['a + il → al, di + la → della, in + il → nel, su + la → sulla',
     '«Vado al mercato del centro.»'],
    [{ t: 'Il libro è sulla tavola nella cucina.', gloss: 'Das Buch liegt auf dem Tisch in der Küche.' }]),
  S('it-g-imperfetto', 'Imperfetto vs passato prossimo', ['imperfetto'],
    ['Imperfetto = sfondo, abitudine: parlavo, avevo, ero (irr.)',
     'Passato prossimo = evento puntuale',
     '«Pioveva quando sono uscito.»'],
    [{ t: 'Da bambino giocavo per strada.', gloss: 'Als Kind spielte ich auf der Straße.' },
     { t: 'Dormivo quando hai chiamato.', gloss: 'Ich schlief, als du anriefst.' }]),
  S('it-g-futuro-semplice', 'Il futuro semplice', ['futuro'],
    ['-erò, -erai, -erà, -eremo, -erete, -eranno: «parlerò»',
     'Irregolari: sarò, avrò, andrò, farò, potrò, verrò'],
    [{ t: 'Ti chiamerò domani.', gloss: 'Ich rufe dich morgen an.' },
     { t: 'Vedremo.', gloss: 'Wir werden sehen.' }]),
  S('it-g-condizionale', 'Il condizionale', ['condizionale'],
    ['-erei, -eresti, -erebbe, -eremmo, -ereste, -erebbero: «parlerei»',
     'Cortesia: «vorrei», consiglio: «dovresti», sogno: «mi piacerebbe»',
     'Irregolari come al futuro: sarei, avrei, farei, potrei'],
    [{ t: 'Vorrei un caffè, per favore.', gloss: 'Ich hätte gern einen Kaffee.' },
     { t: 'Dovresti dormire di più.', gloss: 'Du solltest mehr schlafen.' },
     { t: 'Se fosse possibile, partiremmo domani.', gloss: 'Wenn es möglich wäre, würden wir morgen fahren.' }],
    ['«Se avrei» ✗ — dopo se mai il condizionale']),
  S('it-g-congiuntivo-base', 'Il congiuntivo presente', ['congiuntivo'],
    ['Dopo penso che, credo che, bisogna che, è importante che',
     '-are → -i (parli), -ere/-ire → -a (prenda, dorma)',
     'Irregolari: sia, abbia, faccia, possa, vada'],
    [{ t: 'Penso che tu abbia ragione.', gloss: 'Ich denke, du hast recht.' },
     { t: 'Bisogna che io parta presto.', gloss: 'Ich muss früh los.' }],
    ['«Penso che hai» colloquiale — al livello B1+ usa il congiuntivo']),
  S('it-g-periodo-ipotetico', 'Il periodo ipotetico', ['ipotetico', 'se + congiuntivo'],
    ['Reale: se + presente → presente/futuro: «Se piove, resto a casa»',
     'Possibile: se + congiuntivo imperfetto → condizionale: «Se fossi ricco, viaggerei»',
     'Irreale passato: se + trapassato cong. → condizionale passato'],
    [{ t: 'Se venissi, cucineremmo insieme.', gloss: 'Wenn du kämst, würden wir zusammen kochen.' },
     { t: 'Se l’avessi saputo, sarei venuto.', gloss: 'Hätte ich es gewusst, wäre ich gekommen.' }]),
  S('it-g-ci-ne', 'Le particelle ci e ne', ['ci', 'ne'],
    ['ci = lì / a ciò: «Ci vado domani», «Ci penso»',
     'ne = di ciò / di loro: «Ne parlo», «Ne ho due»',
     'Con quantità sempre ne: «Quanti caffè? Ne prendo uno.»'],
    [{ t: 'Roma? Ci andiamo a maggio.', gloss: 'Rom? Wir fahren im Mai hin.' },
     { t: 'Del progetto? Ne parliamo dopo.', gloss: 'Über das Projekt? Reden wir später (darüber).' }])
];
