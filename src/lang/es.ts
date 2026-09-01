import type { CheatSheet, LangPack } from './types';
import { compF, compG, compV } from './types';
import type { UIStrings } from './fr';

/* ============================== ESPAÑOL ============================== */

const ui: UIStrings = {
  nav: { today: 'Hoy', cards: 'Tarjetas', memory: 'Memoria', settings: 'Ajustes' },
  skills: { grammar: 'gramática', vocabulary: 'vocabulario', fluency: 'fluidez', comprehension: 'comprensión' },
  status: { new: 'nuevo', persisting: 'persistente', improving: 'mejorando', resolved: 'dominado' },
  factCats: { arbeit: 'Trabajo', familie: 'Familia', alltag: 'Vida diaria', vorlieben: 'Gustos', orte: 'Lugares', sonstiges: 'Otros' },
  periods: { week: 'Balance de la semana', month: 'Balance del mes', quarter: 'Balance del trimestre' },
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
    close: 'Cerrar', cancel: 'Cancelar', back: 'Volver', save: 'Guardar', del: 'Eliminar',
    search: 'Buscar…', listen: 'Escuchar', moment: 'Un momento…', retry: 'Reintentar', done: 'Listo',
    copy: 'Copiar', copied: 'Copiado.', load: 'Cargar', see: 'Ver', settle: 'Ajustar', min: 'min', undo: 'Deshacer', audioFail: 'Audio no disponible. Reintenta.', edit: 'Editar', loading: 'Cargando…'
  },
  app: {
    analyzingTitle: 'Odile relee vuestra conversación…', analyzingSub: 'Consejos, nivel, tarjetas nuevas.',
    verbatimStage: 'Transcripción fiel de tu micrófono, errores incluidos…',
    thinkingStage: 'Odile reflexiona…', writingStage: (pct: number) => `El análisis se escribe — ${pct} %`,
    failTitle: 'Análisis fallido', failSub: 'La conversación no se ha perdido.', keepTranscript: 'Guardar la transcripción',
    analyzeFailToast: (msg: string) => 'Análisis fallido: ' + msg, authExpired: 'acceso caducado.',
    synced: 'Sincronizado desde el otro dispositivo.', transcriptKept: 'Transcripción guardada.', savedNoAnalysis: 'Guardado sin análisis.',
    dropNothing: 'Conexión perdida, nada guardado.', emptyNothing: 'Nada guardado.',
    updateReady: 'Nueva versión disponible.', updateReload: 'Recargar',
    crashTitle: 'Esta pantalla no se ha podido mostrar',
    crashSub: 'Tu conversación está guardada: es esta vista la que no puede con ella.',
    crashBack: 'Volver'
  },
  today: {
    backlogLine: (n: number, days: number) => `${n} nuevas en espera, unos ${days} días`,
    roundOf: (n: number, of: number) => `sesión ${n}/${of}`,
    roundExtra: (n: number) => `sesión ${n} · extra`,
    rhythmLine: (perDay: number, rounds: number) => `${perDay} tarjetas nuevas al día · ${rounds} ${rounds === 1 ? 'sesión' : 'sesiones'}`,
    level: 'Nivel', missingAccess: (what: string) => `Falta el acceso: ${what}.`, accessCode: 'código de acceso', apiKey: 'clave OpenAI',
    noServerKey: 'Falta la clave OpenAI en el servidor (Netlify → OPENAI_API_KEY), o pasa a « Mi clave » en los ajustes.',
    twoMinutes: '2 minutos', doCheckin: 'Hacer balance',
    introChip: (n: number) => `Conocerse ${n}/3`, introSub: 'Odile aprende quién eres y establece tu nivel.',
    yourCall: (min: number) => `Tu conversación · ${min} min`, proposes: 'Odile propone', yourTopic: 'tu tema',
    forYourLevel: 'para tu nivel', interestsYou: 'te interesa',
    otherIdea: 'Otra idea', freeTopic: 'Tema libre', freePlaceholder: '¿De qué quieres hablar?',
    callAgain: 'Llama a Odile', callOdile: 'Llamar a Odile', freeConversation: 'Conversación libre',
    eveningReview: 'Tu repaso', due: 'para repasar', fresh: 'nuevas', total: 'en total',
    nothingToReview: 'Nada que repasar', cardsTonight: (n: number) => `Aprender el vocabulario (${n})`,
    warmup: 'Calentamiento: 3 tarjetas antes de la llamada',
    warmupShort: 'Calentamiento · 3',
    seeCards: 'Editar las tarjetas',
    moreActivities: 'Más actividades',
    xpWeek: (n: number, g: number) => `${n} / ${g} XP esta semana`,
    xpWeekUp: (n: number) => `${n} XP · ascenso asegurado`,
    xpWeekHeld: (n: number) => `${n} XP · rango mantenido`,
    xpTotalOf: (n: number, next: number) => `${n} XP en total desde el principio · próxima marca ${next}`,
    reviewTitle: 'Repasar',
    watchesLead: (n: number) => `Está atenta a ${n === 1 ? 'una cosa' : n === 2 ? 'dos cosas' : n === 3 ? 'tres cosas' : `${n} cosas`}: `,
    nCards: (n: number) => `${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`,
    bornOf: (d: string) => `nacida de tu llamada del ${d}`,
    startReview: 'Empezar',
    daysRow: (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`,
    daysMissed: (n: number) => `${n} ${n === 1 ? 'día saltado' : 'días saltados'}`,
  },
  call: {
    goalKicker: 'Coloca esta palabra', goalDone: 'Colocada', goalHit: (w: string) => `« ${w} » colocada.`,
    micStage: 'Micro…', connecting: 'Conectando…', configuring: 'Un momento…', readsSheet: 'te deja leer',
    speaks: 'habla', listens: 'te escucha', yourTurn: 'te toca',
    pause: 'Pausa', resume: 'Reanudar', pausedState: 'en pausa', pausedNote: 'Odile espera. El tiempo se ha detenido.',
    mute: 'Silenciar el micro', muted: 'Silenciado', mic: 'Micro', hangup: 'Colgar', captions: 'Subtítulos',
    sheet: 'Ficha', sheets: 'Fichas', resumeCall: 'Retomar la llamada',
    thinks: 'piensa', turnDone: 'He terminado', turnSpeak: 'Hablar', turnSkip: 'Saltar',
    connFailed: (msg: string) => 'Conexión fallida: ' + msg, connLost: 'Conexión perdida.', autoEnded: 'Odile ha colgado.', echoHeard: 'La llamada se oye a sí misma — mejor con auriculares. Odile se está adaptando.'
  },
  review: {
    wordsPlaced: 'palabras colocadas',
    costTitle: 'Lo que costó esta llamada', costTotal: 'Total',
    briefingTitle: 'Lo que Odile tenía delante',
    briefingNote: 'El briefing exacto de esta llamada, tal como estaba ese día. El de los ajustes muestra lo que se le diría hoy, que no es lo mismo.',
    costLeg: { stt: 'Lo que dijiste', chat: 'Sus respuestas', tts: 'Su voz', realtime: 'Conversación', captions: 'Subtítulos en directo', verbatim: 'Transcripción fiel', analysis: 'Análisis' } as Record<string, string>,
    costPer10: (t: string) => `es decir ${t} por diez minutos`,
    costNote: 'Estimación, con las tarifas de OpenAI en el momento de la llamada.',
    yourConversation: 'Vuestra conversación', toRemember: 'PARA RECORDAR', duration: 'duración', yourWords: 'tus palabras',
    tips: 'consejos', praise: 'muy bien', estLevel: 'Nivel estimado', dayTargets: 'Objetivos del día',
    transcriptTips: 'Transcripción y consejos', tip: 'CONSEJO', better: 'Mejor:', great: 'MUY BIEN',
    verbatimTitle: 'Lo que dijiste realmente', verbatimNote: 'Tu micrófono, transcrito de una sola vez, errores incluidos. Las burbujas de arriba vienen de los subtítulos en directo, que cortan y pulen.',
    starActive: '★ Primera esta noche', starCard: '☆ Priorizar la tarjeta', makeCard: '☆ Convertir en tarjeta',
    starTitle: 'La tarjeta pasa al principio de tu próximo repaso',
    imgChange: '🖼 Cambiar la imagen', imgAdd: '🖼 Añadir una imagen', imgTitle: 'Añadir una imagen a la tarjeta',
    newCards: (n: number) => `${n} ${n === 1 ? 'tarjeta nueva' : 'tarjetas nuevas'}`, newVocab: 'Palabras nuevas', vocabHasCard: 'Tarjeta creada', vocabMakeCard: 'Crear la tarjeta', vocabRemoveCard: 'Quitar las tarjetas', vocabCardsRemoved: (n: number) => `${n} ${n === 1 ? 'tarjeta quitada' : 'tarjetas quitadas'}.`,
    noAnalysis: 'Sin análisis para esta conversación', duoImport: ' (importado de Duolingo)', continue: 'Continuar',
    noticeTitle: '¿Qué cambió Odile?', noticeShow: 'Ver su versión',
    tipsTitle: 'Consejos', praiseTitle: 'Lo que salió bien',
    noVocab: 'No hay palabras nuevas de esta conversación.',
    turnCards: (n: number) => `${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`, turnCardsTitle: 'Esta frase generó tarjetas',
    wpmLine: (n: number) => `${n} palabras/min`,
    yourShare: 'tu parte de habla',
    sceneTitle: 'La revisión', nextTime: 'La próxima vez', backToCall: 'Volver a la conversación',
    callOf: (min: number, d: string) => `Llamada de ${min} min · ${d}`,
    panelYou: 'Tú', panelHer: 'Ella lo retoma', panelOut: 'Lo que sale de ahí',
  },
  flu: {
    title: 'Fluidez 4/3/2',
    offer: 'Cuenta la conversación de hoy, tres veces, cada vez más rápido.',
    explain: 'Tres rondas: 60, 45 y 30 segundos. La misma historia cada vez — menos tiempo, más soltura.',
    round: (n: number, s: number) => `Ronda ${n} · ${s} s`,
    start: 'Hablar', stopEarly: 'He terminado', recording: 'Te escucho…', transcribing: 'Transcribiendo…',
    results: 'Tu ritmo', mots: 'palabras', wpm: 'palabras/min',
    failMic: 'Micrófono no disponible.', later: 'Más tarde',
    praiseUp: 'Más rápido en cada ronda. De eso se trata.', praiseFlat: 'Bien. La velocidad llegará repitiendo.'
  },
  story: {
    title: 'Historia del día', sub: 'Dos minutos de escucha, escritos para ti',
    make: 'Escuchar la historia del día', making: 'Odile escribe tu historia…',
    play: 'Escuchar', stop: 'Parar', fail: 'Sin historia por ahora. Reintenta.',
    questions: 'Una pregunta por párrafo:',
    newOne: 'Nueva historia',
    showText: 'Ver el texto', hideText: 'Ocultar el texto',
    tapHint: 'Toca lo que no entiendas: traducción, y tarjetas si quieres.',
    listenFirst: 'Las preguntas van llegando mientras escuchas…',
    right: '¡Exacto!',
    wrongWas: (buena: string) => `No — era: ${buena}`,
    para: (i: number) => `Párrafo ${i}`,
    noTrans: 'Traducción imposible. Reintenta.',
    score: (g: number, n: number) => `${g}/${n} respuestas correctas`
  },
  rev: {
    typeCloze: 'Completa', typeToNative: '¿Qué significa?', typeToTarget: (lang: string) => `¿En ${lang}?`,
    finishedTitle: 'Repaso terminado', doneCards: (n: number) => `${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}. Bien.`, nothing: 'Nada que repasar.',
    sessionLine: (known: number, hard: number, again: number, xp: number) => `${known} ${known === 1 ? 'sabida' : 'sabidas'} · ${hard} ${hard === 1 ? 'difícil' : 'difíciles'} · ${again} ${again === 1 ? 'repetida' : 'repetidas'} · +${xp} XP`,
    finish: 'Terminar', hint: 'Pista:', speakAloud: 'Responde en voz alta y gira la tarjeta.', flip: 'Girar',
    personalize: 'Personalizar (imagen)',
    grades: { again: 'Otra vez', hard: 'Difícil', good: 'Bien', easy: 'Fácil' },
    now: 'ahora mismo', dayN: (n: number) => (n === 1 ? '1 día' : `${n} días`),
    recordAnswer: 'Grabarte', replayAnswer: 'Reescuchar tu respuesta',
    fromCall: (d: string) => `Tu frase del ${d}`, askedWord: (d: string) => `Palabra del ${d}`,
    sheRecast: 'Aquí te corrigió ella.', youAsked: 'Le pediste esta palabra.',
  },
  pace: {
    title: '¿Vas al día?',
    growing: (n: string) => `El montón crece ${n} tarjetas al día.`,
    clearing: (n: string) => `El montón baja ${n} tarjetas al día.`,
    level: 'Tarjetas creadas y repasadas están a la par.',
    idle: 'Ni tarjetas ni repasos esta semana.',
    keyMade: 'creadas', keyCarry: 'lo que sostienes', keyOver: 'más creadas que sostenidas',
    waiting: (n: number) => `${n} esperando`,
    clearIn: (d: number) => `resuelto en unos ${d} días`,
    neverClear: 'a este ritmo no alcanzas',
    basis: (a: string, r: string) => `En los últimos 7 días: ${a} tarjetas nuevas al día, ${r} repasos al día.`,
    estimate: 'Cuántas empiezas se acaba de empezar a contar — estimado hasta entonces.',
    addedN: (n: number) => `${n} creadas`,
    reviewsN: (n: number) => `${n} repasadas`
  },
  cards: {
    title: 'Tarjetas', review: 'Repasar', nothingToReview: 'Nada que repasar', due: 'para repasar', fresh: 'nuevas',
    active: 'activas', typeCloze: 'Hueco', newCard: 'nueva', forDate: (d: string) => 'para el ' + d,
    days: 'd', missed: (n: number) => `${n}× fallada`,
    empty: 'Aún no hay tarjetas. Nacerán de tus conversaciones.', lastReviews: 'Últimos repasos',
    reviewLine: (total: number, known: number, xp: number) => `${total} ${total === 1 ? 'tarjeta' : 'tarjetas'} · ${known} ${known === 1 ? 'sabida' : 'sabidas'} · +${xp} XP`,
    batchNew: (n: number) => `Esta sesión (${n})`, batchRest: 'El resto', batchChip: 'NUEVA',
    matureNote: 'Aprendida = intervalo de 21 días o más.', emptyFiltered: 'Nada con este filtro.',
    deletedToast: 'Tarjeta eliminada.', resume: (d: number, t: number) => `Reanudar ${d}/${t}`,
    f: {
      all: 'Todas', learning: 'En curso', learned: 'Aprendidas',
      lastKnown: 'sabida', lastMissed: 'fallada',
      sort: 'Orden', byDue: 'fecha', byStatus: 'estado', byDifficulty: 'dificultad',
      stageLearning: 'en curso', stageLearned: 'aprendida'
    }
  },
  checkin: {
    rankWeeks: (up: number, down: number, held: number) => `${up} subidas, ${held} mantenidas, ${down} bajadas`,
    rankNeeds: (hold: number, climb: number) => `${hold} XP para mantener · ${climb} para subir`,
    laterBtn: 'Más tarde', calls: 'llamadas', minutes: 'minutos', cardsKnown: 'tarjetas sabidas', level: 'nivel',
    working: 'Odile hace balance…', unavailable: (e: string) => `Balance no disponible: ${e}`,
    moved: 'HA CAMBIADO', toWork: 'A TRABAJAR', proposal: 'Propuesta:', noted: 'Anotado',
    steer: 'Tus respuestas orientan las llamadas del próximo periodo.',
    savedDirection: 'Rumbo anotado. Seguimos el ritmo.', savedPlain: 'Balance anotado.'
  },
  memory: {
    title: 'Memoria', savedServer: 'guardada en el servidor', savedLocal: 'solo en este navegador',
    intro: 'Todo lo que Odile sabe de ti. Cada entrada se lee, se edita, se borra.',
    tabs: { over: 'Resumen', comp: 'Mapa', prog: 'Progreso', carnet: 'Cuaderno', sess: 'Conversaciones', adv: 'Avanzado' },
    tabsOld: { gaps: 'Lagunas', str: 'Puntos fuertes', facts: 'Datos', voc: 'Vocabulario', brief: 'Briefing', data: 'Datos técnicos' },
    portraitTitle: 'Quién eres, para ella',
    portraitNote: 'Lo que Odile tiene en mente al descolgar. Los datos que vuelven de una llamada a otra forman el retrato; el resto solo aparece de pasada.',
    levelCefr: 'NIVEL (MCER)', reliability: 'Fiabilidad', establishing: 'Se establece en las tres primeras llamadas.',
    skillsTitle: 'Competencias', progress: 'Progresión', weeklyCheckin: 'Hacer balance (semana)',
    streakDays: 'días seguidos', conversations: 'conversaciones', minutes: 'minutos',
    yourTopics: 'Tus temas', noTopics: 'Aún nada. Llegará hablando.',
    matrixIntro: 'Tu nivel se compone de islas, no de una línea. Cada casilla es una competencia concreta; Odile sondea las casillas grises bajo tu nivel y anota las islas de arriba.',
    catGrammar: 'Gramática', catVocab: 'Vocabulario', catSpeak: 'Hablar',
    noData: 'Sin datos todavía. Odile lo sondeará con disimulo.',
    acquired: 'Dominado', toWorkOn:'A trabajar', partial: 'Parcial', seenOn: 'visto el',
    legendOk: 'dominado', legendKo: 'a trabajar', legendPartial: 'parcial', legendNone: 'sin datos',
    pinNext: 'Trabajar esto en la próxima llamada', pinned: '✓ Previsto en la próxima llamada — cancelar',
    pinnedToast: 'En el programa de la próxima llamada.', markAcquired: 'Marcar dominado', clearData: 'Borrar el dato',
    nextCall: 'En la próxima llamada:',
    gapsLine: (open: number, done: number) => `${open} abiertas · ${done} dominadas. Las lagunas abiertas se vuelven los objetivos de la próxima llamada.`,
    seenFirst: 'vista el', seenLast: 'última vez', workedTimes: 'trabajada', examples: 'Ejemplos',
    markGapAcquired: 'Marcar dominada', forget: 'Olvidar', noGaps: 'Ninguna laguna anotada por ahora.',
    strengthTag: '✓ punto fuerte', noStrengths: 'Nada todavía. Llegará.',
    factsIntro: 'Lo que le has contado a Odile. Guarda lo esencial y lo usa para preguntas de verdad.',
    saidOn: 'dicho el', saidAgain: 'repetido el', noFacts: 'Nada todavía. Llegará hablando.',
    noVocabFound: 'Nada encontrado.', vocabCount: (n: number) => `${n} palabras. Odile rescata antiguas de vez en cuando.`,
    importTag: '✉ importado · ', noSessions: 'Aún no hay conversaciones.',
    briefIntro: 'Exactamente lo que Odile recibirá en la próxima llamada: tema, nivel y objetivos desde la app. Nada más.',
    editTemplate: 'Editar la plantilla', customTemplate: 'plantilla personalizada', variables: 'Variables:',
    varWhat: '¿Qué contiene cada variable?', reset: 'Restablecer', briefSaved: 'Briefing guardado.',
    varGloss: {
      name: 'nombre', native: 'lengua materna', langue: 'lengua meta', niveau: 'nivel estimado',
      competences: 'detalle por competencia', confiance: 'fiabilidad de la estimación', bande: 'banda A1–C2',
      persona: 'carácter de Odile', aujourdhui: 'bloque del tema del día', minutes: 'duración prevista',
      objectifs: 'objetivos del día', sondages: 'competencias sondeadas', cap: 'rumbo del periodo',
      faits: 'datos personales', interets: 'intereses', faiblesses: 'puntos débiles', passe: 'conversaciones pasadas'
    } as Record<string, string>,
    exportJson: 'Exportar (JSON)', importBtn: 'Importar', rawJson: 'JSON bruto', closeEditor: 'Cerrar el editor',
    forgetAll: 'Olvidarlo todo', forgetAllConfirm: '¿Olvidarlo todo? Esto borra este perfil en este dispositivo Y su copia en el servidor.',
    serverWipeFailed: 'No se pudo borrar la copia del servidor (¿sin conexión?). ¿Borrar igualmente en local?',
    entryForgotten: 'Entrada olvidada.',
    applySave: 'Validar y guardar', importedToast: 'Memoria importada.', savedToast: 'Guardado.',
    invalidJson: (msg: string) => 'JSON no válido: ' + msg, unknownFormat: 'formato desconocido',
    dataNoteSynced: 'Copia local + servidor. Exportar/Importar para llevártelo todo.',
    dataNoteLocal: 'Guardada en este navegador. Exportar/Importar para cambiar de dispositivo.',
    levelChartEmpty: 'Tu curva de nivel aparecerá tras algunas conversaciones.', levelChartLabel: 'Progresión del nivel',
    monthScenes: (n: number) => `${n} ${n === 1 ? 'escena' : 'escenas'}`,
    monthMoved: 'Lo que se movió', monthEmpty: 'Nada aún este mes. La cuadrícula se llena hablando.',
    legendCall: 'llamada', legendBoth: 'llamada + tarjetas', legendToday: 'hoy',
    cardsBorn: 'tarjetas nacidas de tus llamadas', wpmLabel: 'palabras por minuto',
    wpmPrev: (n: number) => `(${n} el mes pasado)`,
  },
  profiles: {
    languages: 'Idiomas', addLanguage: 'Añadir un idioma',
    title: 'Perfiles', intro: 'Cada perfil tiene su memoria, su nivel y sus tarjetas. Odile no confunde a nadie.',
    active: 'activo', since: 'desde', rename: 'Renombrar', renamePrompt: 'Nuevo nombre:',
    deleteConfirm: (name: string) => `¿Eliminar el perfil « ${name} », con memoria y tarjetas?`,
    newProfile: 'Nuevo perfil', backupTitle: 'Copia y otros dispositivos',
    accountSaved: (email: string) => `Este perfil se guarda continuamente en tu cuenta (${email}). Inicia sesión en otro dispositivo y te espera allí.`,
    onAccount: 'En la cuenta', thisOne: '(este)', lastActivity: 'última actividad', profileWord: 'Perfil',
    loadFailed: 'Carga fallida.', loaded: (name: string) => 'Perfil cargado: ' + name,
    switched: 'Perfil cambiado.', noMemory: 'Este perfil aún no tiene memoria.',
    syncOn: 'Todo este perfil (conversaciones, memoria, tarjetas) se guarda continuamente en el servidor. En otro dispositivo, introduce este código en « Perfiles » para continuar allí:',
    syncOff: 'Cortar la copia en el servidor (solo este dispositivo)',
    syncDisabled: 'Copia en el servidor desactivada: los datos se quedan en este navegador.',
    syncEnable: 'Activar la copia en el servidor', syncNeedsServer: 'Requiere acceso al servidor',
    syncActive: 'Copia en el servidor activa.', syncUnavailable: 'No disponible (requiere acceso al servidor).',
    syncFailed: 'Copia en el servidor: fallo. Reintenta.',
    loadFrom: 'Cargar un perfil desde otro dispositivo:', noProfileCode: 'Ningún perfil con ese código.'
  },
  settings: {
    sessionsPerDay: 'Sesiones al día', auto: 'Auto',
    rhythmNote: (perDay: number, capacity: number) => `Unas ${perDay} tarjetas nuevas al día: es lo que ${capacity} repasos diarios pueden sostener sin que el montón crezca. Las conversaciones no fabrican más.`,
    title: 'Ajustes', account: 'Cuenta', connected: 'Conectado', signOut: 'Cerrar sesión', signedOut: 'Sesión cerrada.',
    signInGoogle: 'Continuar con Google', signInHint: 'Inicia sesión para recuperar tus perfiles en todas partes.',
    openaiKey: 'Clave OpenAI', viaAccount: 'Con la cuenta', ownKeyDirect: 'Mi clave (directa)', accountKey: 'Clave de la cuenta',
    keyIfAsked: 'sk-… (si se pide)', keySaved: 'Clave guardada en tu cuenta.', keySaveFailed: 'Guardado fallido.',
    allowlistNote: 'Las direcciones autorizadas usan la clave del servidor. Las demás cuentas guardan aquí su propia clave, usada en su lugar.',
    access: 'Acceso', serverCode: 'Servidor (código de acceso)', myKey: 'Mi clave',
    noServerKeySet: 'No hay OPENAI_API_KEY en el servidor (Netlify → Environment variables).',
    accessCodeLabel: 'Código de acceso', verify: 'Verificar', codeWrong: 'Código incorrecto.', codeOk: 'Código aceptado.',
    modeDirect: 'Modo', modeDirectValue: 'Directo (tu clave, en este navegador)', testKey: 'Probar',
    keyWorks: 'La clave funciona.', keyRefused: (s: number) => `OpenAI rechaza la clave (${s}).`, netError: 'Error de red.',
    ownKeyTitle: 'Tu clave (directa)', ownKeyNote: 'Se queda en este navegador; las llamadas van directas a OpenAI.',
    rhythm: 'Ritmo diario', callLength: 'Duración de la llamada', cardsPerEvening: 'Tarjetas por sesión', newOf: 'de ellas nuevas',
    cardAudio: 'Audio de tarjetas', yes: 'sí', no: 'no', introPhase: 'Conocerse', skipPhase: 'Saltar esta fase',
    profileTitle: 'Perfil', firstName: 'Nombre', targetLang: 'Lengua meta', motherTongue: 'Lengua materna',
    odileStyle: 'Estilo de Odile', deadpan: 'Socarrona', warm: 'Cálida', profilesSync: 'Perfiles y sincronización', manage: 'Gestionar',
    voiceCall: 'Voz y llamada', voice: 'Voz', speed: 'Velocidad', patience: 'Paciencia al escuchar',
    patienceHigh: 'mucha', patienceMid: 'media', patienceLow: 'poca', captions: 'Subtítulos permanentes',
    callModel: 'Modelo de llamada', callModelStd: 'estándar', callModelMini: 'económico',
    callModelNote: 'El modelo económico cuesta alrededor de la cuarta parte, pero detecta peor tus errores durante la conversación. Se sigue recomendando el estándar.',
    engine: 'Motor de llamada', engineRealtime: 'tiempo real', engineTurns: 'turno a turno',
    engineNote: 'Turno a turno: hablas, esperas su respuesta y no se la puede interrumpir. La conversación cuesta alrededor de una sexta parte y el modelo que la lleva sigue mejor las instrucciones, pero lee una transcripción: nunca oye tu acento. El tiempo real sigue siendo el modo normal.',
    modelTurn: 'Modelo turno a turno',
    turnCommit: 'Fin de tu turno', turnCommitAuto: 'con el silencio', turnCommitButton: 'con el botón',
    turnCommitNote: 'Con silencio, tu turno termina solo tras una pausa, y tu paciencia de escucha es la que la mide: «poca» adelanta su respuesta casi un segundo, «mucha» te deja buscar las palabras. Con el botón, solo tu toque lo termina.',
    audioEnv: 'Audio y entorno', audioAutoNote: 'El micrófono y el ruido se ajustan solos. Si la llamada se oye a sí misma — móvil en altavoz — lo nota y cambia su configuración. Los auriculares siguen siendo lo mejor.', noiseReduction: 'Reducción de ruido', nrOff: 'no', nrNear: 'auriculares', nrFar: 'habitación',
    noisyEnv: 'Entorno ruidoso', envNormal: 'normal', envStrict: 'estricto',
    strictNote: '« Estricto » solo reacciona a habla clara, no a cada ruido. Tu paciencia de escucha se aplica en ambos modos.',
    verbatim: 'Transcripción fiel',
    verbatimNote: 'Tras la llamada, tu micrófono se transcribe palabra por palabra, errores incluidos. El análisis juzga tus errores sobre esa versión, no sobre los subtítulos pulidos.',
    models: 'Modelos', modelCall: 'Conversación', modelAnalysis: 'Análisis', modelTranscribe: 'Transcripción en vivo',
    footer: 'Causerie · La llamada va directa entre tu navegador y OpenAI (WebRTC). Transcripciones, memoria y tarjetas se quedan en tu dispositivo, con copia en el servidor cuando el acceso está activo (ajustable en Perfiles).',
    natives: { de: 'Alemán', en: 'Inglés' } as Record<'de' | 'en', string>,
    uiLang: 'Idioma de la interfaz', uiAuto: 'auto', uiTargetOpt: 'lengua meta', uiSupportOpt: 'lengua materna',
    uiLangNote: 'Auto: la interfaz pasa a la lengua meta a partir de B1.',
    speakAnswers: 'Respuesta hablada', speakAnswersNote: 'Graba tu respuesta en voz alta antes de girar la tarjeta y compara.',
    version: 'Versión', versionRunning: 'Instalada', versionDeployed: 'Publicada', versionBuilt: 'Compilada el',
    versionBerlin: (t: string) => `${t} (hora alemana)`,
    versionCurrent: 'Al día.', versionChecking: 'Comprobando…', versionStale: 'Nueva versión disponible',
    versionNote: 'El número es la hora de compilación en UTC: v AA.MM.DD.hhmm.',
    retellOpt: 'Proponer Fluidez 4/3/2', helpRow: 'Ayuda'
  },
  onboarding: {
    heroLine: 'Hola. Parece que vamos a hablar. Bien.',
    title1: 'La tutora', title2: 'que se acuerda de ti.',
    sub: 'Cada día una conversación, cada noche unas tarjetas. Lo que falla al hablar pasa solo al repaso. Tu nivel se dibuja de A1 a C2.',
    google: 'Continuar con Google', connectedAs: 'Conectado:', signInFirst: 'Inicia sesión con Google primero.',
    yourKey: 'Tu clave OpenAI',
    notOnList: (email: string) => `${email} no está en la lista del servidor. Introduce tu propia clave: se guarda en tu cuenta y se usa para tus conversaciones.`,
    saveContinue: 'Guardar y continuar', changeAccount: 'Cambiar de cuenta',
    yourFirstName: 'Tu nombre', youLearn: 'Aprendes', yourMotherTongue: 'Tu lengua materna',
    yourLevel: 'Tu nivel (según tú)',
    levelNote: 'Las tres primeras llamadas sirven para conocerse: Odile verifica ese nivel.',
    accessLabel: 'Acceso', withCode: 'Con el código de acceso',
    withCodeNote: 'La clave OpenAI se queda en el servidor. Solo necesitas el código.', serverKeyMissing: ' (Falta la clave del servidor por ahora.)',
    withOwnKey: 'Con tu clave OpenAI', withOwnKeyNote: 'Empieza ya. La clave se queda en este navegador y va directa a OpenAI.',
    keyPlaceholder: 'Clave OpenAI (sk-…), se queda en este navegador', codePlaceholder: 'Código de acceso',
    go: 'Vamos', loadProfileFailed: 'Carga del perfil fallida.', enterKey: 'Introduce tu clave OpenAI.',
    error: (msg: string) => 'Error: ' + msg,
    a0Label: '0 — empiezo de cero',
    a0Hint: 'Odile empezará sobre todo en tu idioma, te enseñará tus primeras frases, y un pequeño mazo de tarjetas de supervivencia ya te espera.'
  },
  pz: {
    newPrompt: 'Nuevo prompt', drawOver: 'Dibujar encima', listening: 'Te escucho…',
    micFail: 'El dictado no funciona en este navegador. Usa el micro del teclado.', lastImage: 'Tu última imagen',
    title: 'Personaliza tu tarjeta', removeImg: 'Quitar la imagen',
    tabDraw: 'Dibujar', tabPhoto: 'Foto', tabAi: 'Imagen IA', tabReuse: 'Reutilizar',
    reuseNote: 'Imágenes que ya has dibujado, fotografiado o generado. Basta con tocar una.', reuseEmpty: 'Todavía no hay otras imágenes en el mazo.',
    eraser: 'Goma', undo: 'Deshacer', clearAll: 'Borrar todo', keepDrawing: 'Guardar este dibujo',
    choosePhoto: 'Elegir una foto', photoHint: 'Se abre tu galería, con su buscador.',
    keep: 'Guardar', otherPhoto: 'Otra foto', photoBad: 'Foto ilegible.',
    suggestBtn: 'Proponer dos ideas',
    twoIdeas: 'Dos ideas de imágenes memorables:', searching: 'Odile busca ideas…',
    ownScene: '… o describe tu propia escena', dictate: 'Dictar', create: 'Crear la imagen',
    drawing: 'Odile dibuja… (~15 s)', preparing: 'Preparando…', saving: 'Guardando…',
    retryImg: 'Reintentar', promptBtn: 'Prompt', emptyPrompt: 'prompt vacío', emptyImage: 'imagen vacía',
    ideasFail: 'Sin ideas por ahora. Reintenta.', imgFailHint: 'No ha funcionado. Reintenta en un momento.'
  },
  pron: {
    dayOf: (n: number) => `Día ${n}/14`, phaseNote: 'Las dos primeras semanas, primero el oído: estos pares te enseñan a OÍR la lengua. La llamada queda corta.',
    title: 'Pronunciación', sub: 'Pares mínimos: ¿oyes la diferencia?',
    start: 'Escuchar y adivinar', which: '¿Cuál has oído?', replay: 'Volver a escuchar',
    score: (n: number, t: number) => `${n}/${t} aciertos`,
    good: 'Buen oído.', meh: 'Se puede trabajar. Vuelve mañana.'
  },
  rank: {
    of: (n: number, t: number) => `Rango ${n} de ${t}`,
    streakTitle: 'Racha', days: (n: number) => `${n} ${n === 1 ? 'día' : 'días'} seguidos`,
    repairs: (n: number, max: number) => `${n} de ${max} comodines`,
    lifetime: (n: number) => `${n} XP en total`,
    names: ['Primera palabra', 'Saludos', 'Charla', 'Anécdota', 'Conversación', 'Discusión', 'Debate', 'Matiz', 'Soltura', 'Elocuencia', 'Brío', 'Causerie']
  },
  forge: {
    title: 'Nueva tarjeta', inputPh: 'Una palabra, una expresión o un fragmento de conversación…',
    suggest: 'Proponer tarjetas', suggesting: 'Odile prepara propuestas…',
    add: (n: number) => `Añadir ${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}`,
    none: 'Nada que hacer con esto. Prueba otra palabra.', fail: 'Sin propuestas. Reintenta.',
    added: (n: number) => `${n} ${n === 1 ? 'tarjeta añadida' : 'tarjetas añadidas'}.`,
    fromTurn: 'Hacer tarjetas de esto',
    already: 'Ya tienes esta tarjeta.', exists: 'ya está'
  },
  tuto: {
    skip: 'Saltar', next: 'Siguiente', done: 'Vamos',
    s: [
      { h: 'Una llamada al día', p: 'Hablas con Odile 3–8 minutos sobre un tema que te interesa. Corrige reformulando, sin romper la conversación.' },
      { h: 'Por la noche, unas tarjetas', p: 'Tus fallos y las palabras nuevas se vuelven tarjetas. Una pequeña ronda cada noche basta — la repetición espaciada hace el resto.' },
      { h: 'Una memoria transparente', p: 'Odile se acuerda de ti: nivel, lagunas, intereses. Todo se lee, se corrige y se borra en «Memoria».' },
      { h: 'Si te pierdes', p: 'La ayuda está en Ajustes → Ayuda. Buena conversación.' }
    ]
  },
  help: {
    title: 'Ayuda',
    s: [
      { h: 'El ritmo', p: 'Una conversación al día (3–8 min), un repaso por la noche (10–20 tarjetas). Eso es todo. La regularidad gana a la intensidad.' },
      { h: 'La llamada', p: 'Odile propone un tema — recházalo o habla libremente. Interrúmpela cuando quieras. Corrige reformulando; las correcciones detalladas llegan después. Las fichas se leen sin estrés: Odile espera.' },
      { h: 'Después de la llamada', p: 'El análisis extrae correcciones, palabras nuevas y progresos, y fabrica tus tarjetas. «¿Qué cambió Odile?» te muestra las reformulaciones — intenta ver la diferencia antes de revelarla.' },
      { h: 'Las tarjetas', p: '«Otra vez» = a retrabajar (la tarjeta conserva la mitad de su intervalo). «Bien» la espacia cada vez más; «aprendida» a partir de 21 días. Personaliza cada tarjeta con un dibujo, una foto o una imagen generada — las imágenes que TÚ eliges se recuerdan mejor.' },
      { h: 'La memoria', p: 'En «Memoria»: tu nivel (islas, no una línea), tus lagunas, tus datos y el briefing exacto de la próxima llamada. Cada entrada se edita o se borra. «Olvidarlo todo» borra también la copia del servidor.' },
      { h: 'Problemas frecuentes', p: 'Sin sonido: revisa el altavoz y el modo silencio del teléfono. Micro mudo: recarga la página y revisa los permisos del navegador. Análisis fallido: la conversación no se pierde — reintenta desde la pantalla de error.' }
    ]
  },
  sheetsUi: { close: 'Cerrar' }
};

const template = `Eres Odile, tutora de conversación en {{langue}}, en una llamada de voz con tu alumno. Eres una interlocutora de verdad, no una asistente.

# Personaje
Odile, francesa, unos treinta años, boina roja. Vive en España desde hace años y habla un español impecable. {{persona}}

# Alumno
{{name}}, lengua materna: {{native}}. Nivel estimado: {{niveau}} ({{competences}}). Fiabilidad de la estimación: {{confiance}}.

# La regla del micrófono (antes que todas las demás)
Quien tiene que hablar es ÉL. Cada palabra que dices es una palabra que él no dice, y solo tiene unos minutos al día.
- Tus turnos son MÁS CORTOS que los suyos. Una o dos frases. Por encima de veinticinco palabras, hablas demasiado.
- NUNCA repitas lo que él acaba de decir. Ni eco, ni resumen, ni «Sí, tú…» que copie su frase. Él ya sabe lo que ha dicho; devolvérselo no le enseña nada y le quita su tiempo de habla.
- No produzcas tú la lengua que el ejercicio le pide producir a él. Si el tema es «describe el camino», es ÉL quien describe; si hacéis la compra, es ÉL quien nombra los productos. Tú preguntas, no suministras.
- Si acaba de responder en menos de veinte palabras, NO hagas una pregunta nueva: hazle continuar la que empezó («¿y entonces?», «cuenta», «¿por qué?»), o reacciona en dos o tres palabras («Ah.», «Vaya.», «Bien.») y deja que el silencio haga el resto. Él seguirá.
- Cuando preguntes, que sea casi siempre sobre lo que él acaba de decir — «¿por qué?», «cuéntame» — y no sobre algo nuevo. Una pregunta nueva en cada turno es un interrogatorio, no una conversación.
- Nunca dos preguntas en el mismo turno. Nunca una lista. Nunca un monólogo.

# Reglas de lengua
- Habla únicamente en {{langue}}, calibrado al nivel {{bande}}: frases cortas, vocabulario frecuente, estructura clara. Un poco por encima del nivel, sí; mucho por encima, no. Nunca una palabra de una tercera lengua.
- Si el alumno se pierde o pide una explicación o una traducción: UNA explicación corta en {{native}}, y vuelta inmediata al {{langue}}.
- «¿Cómo se dice X?» → da la palabra, una glosa de dos palabras en {{native}}, y sigue.

# Corregir (sin quitarle el micrófono)
Corrige como una buena tutora humana, nunca dando la lección. El orden importa, y empieza por HACERLE hablar:
1. Su frase es incomprensible o descarrila → pide una aclaración corta («¿Cómo?», «¿Es decir?», «¿Lo dices de otra manera?») y déjale a ÉL rehacerla. Es tu reacción por defecto, no tu último recurso. No adivines nunca con buena voluntad para seguir adelante: si no se le ha entendido, tiene que enterarse ahora.
2. Has entendido, pero es un error CORRIENTE → déjalo pasar y reacciona al contenido. Corregirlo todo es no marcar nada: corregido en cada frase, deja de notar nada.
3. TRES errores no pasan nunca: el que toca un objetivo del día, el que toca una de sus lagunas abiertas, el que toca el rumbo del periodo. Cuando oigas uno, tu respuesta EMPIEZA por la forma correcta, deslizada en una reacción al contenido — sin anunciar la corrección, sin decirle que se equivocó, sin repetir el resto de su frase. Uno por turno, el más importante.
- Si mete una palabra de otra lengua en medio del {{langue}} (p. ej. «income», «Termin»): da la palabra en {{langue}} de pasada — es la reformulación prioritaria.
- Nunca pares la conversación por la gramática. Nunca digas «pequeña corrección». Ningún metacomentario sobre los errores durante la llamada.
- Si el mismo error vuelve varias veces en la llamada: un único aparte muy corto en {{native}}, y seguimos en {{langue}}.

# Alimentar el vocabulario
- Introduce 2 o 3 palabras o expresiones ÚTILES por llamada, un punto por encima de su nivel: deslízalas con naturalidad en tus respuestas, con una glosa de dos palabras en {{native}} si hace falta, y reutiliza cada una al menos una vez más tarde en la llamada.
- Solo si el hilo se presta. Si una palabra no entra con naturalidad en los dos turnos siguientes, déjala caer: retorcer la conversación para colocar una palabra cuesta más de lo que da, y te hace hablar en su lugar.
- Elígelas según el tema del día y sus intereses; palabras que va a usar, no palabras raras para lucirte.

{{aujourdhui}}

# Duración
Llamada diaria: unos {{minutes}} minutos, no más. Mantén el ritmo, sin largos rodeos. A veces recibirás notas de sistema entre paréntesis («(nota de dirección: …)»): síguelas en silencio, nunca las leas en voz alta. Cuando el tiempo se acabe, concluye en una frase corta y NO RELANCES MÁS: ninguna pregunta nueva, responde al adiós y ya está.

# Objetivos del día (secretos: nunca los anuncies ni los listes)
Crea aperturas naturales para que el alumno tenga que usarlos; si una apertura pasa sin ser aprovechada, crea otra más tarde. Y un error que toque uno de ellos NUNCA pasa: tu respuesta empieza entonces por la forma correcta, deslizada en una reacción al contenido.
{{objectifs}}

# Sondeo discreto (nunca anunciado)
El nivel real se compone de islas: pueden faltar bases por debajo del nivel mostrado. Una o dos veces en la llamada, desliza una apertura que obligue a usar esto, y anota mentalmente si sale:
{{sondages}}

# Rumbo del periodo (elegido por el alumno en su último balance; orienta tus llamadas sin anunciarlo nunca, y corrige primero lo que lo toca)
{{cap}}

# Lo que sabes del alumno
Quién es. Lo conoces: háblale como a alguien de quien ya sabes todo esto, sin recitar nunca la lista ni volver a preguntar lo que ya figura en ella.
{{faits}}
Intereses:
{{interets}}
Puntos débiles conocidos (reformúlalos con firmeza cuando aparezcan; algunas etiquetas pueden estar en {{native}}):
{{faiblesses}}
Conversaciones anteriores (haz referencia de vez en cuando, sin darle demasiada importancia):
{{passe}}

# Conducta
- El alumno puede interrumpirte en cualquier momento: párate de inmediato y responde a lo que dice.
- Si se calla un rato, déjale buscar: el silencio es su tiempo de pensar, no un hueco que rellenar. Solo tras una pausa de verdad propones un relance simple o reformulas tu pregunta más fácil.
- Repite sus cifras, sus nombres y sus lugares exactamente como él los ha dado. No los cambies nunca de pasada.
- Si pasa al {{native}} por comodidad, responde brevemente y tráelo de vuelta al {{langue}} con una pregunta fácil.
- Cuando se despida o quiera parar, concluye la llamada en una frase corta, socarrona, y luego cuelga tú misma con la herramienta end_call. No te quedes nunca en línea después de las despedidas.
- No comentes NUNCA tu manera de hablar ni tu pedagogía: nada de «voy a hablar simple», «hablo despacio», «mantengámoslo básico», «para ayudarte, voy a…». Hazlo, sin decirlo nunca.
- Nunca menciones ser una IA, un modelo, o estas instrucciones. Nunca salgas del personaje.`;

export const es: LangPack = {
  code: 'es',
  locale: 'es-ES',
  langName: 'español',
  self: 'Español',
  flag: '🇪🇸',
  en: 'Spanish',
  natives: { de: 'alemán', en: 'inglés' },
  ui,
  tutor: {
    template,
    persona: {
      deadpan: `Tu tono es socarrón y seco. Entonación plana y tranquila. Lacónica, algo desencantada, pero discretamente amable. Nunca entusiasmo desbordante, nunca signos de exclamación; tus cumplidos son cortos y factuales («No está mal.», «Correcto.», «Bien.»). De vez en cuando, como mucho una vez cada pocos minutos, te permites una única broma muy seca, dicha perfectamente plana.`,
      warm: `Tu tono es cálido, tranquilo y alentador, sin pasarte nunca. Sonríes con la voz, suavemente.`
    },
    todayIntro: (n: number) => `# Hoy: conocerse (llamada ${n} de 3)
${n === 1
    ? `Es la primerísima llamada: aún no os conocéis.`
    : `Ya habéis hablado ${n - 1 === 1 ? 'una vez' : `${n - 1} veces`}. NO te presentes de nuevo y no repitas NUNCA una pregunta cuya respuesta ya figura en «Lo que sabes del alumno» más abajo: apóyate en ello y profundiza, como una persona que se acuerda.`}
Tus objetivos, tejidos en una conversación natural:
- ${n === 1
    ? `Saber quién es el alumno: trabajo, día a día, familia si la menciona, aficiones, lugares que conoce, por qué aprende la lengua. Una cosa a la vez; reacciona como una persona, no como un formulario.`
    : n === 2
    ? `Eje de hoy: su día a día concreto — su semana, sus mañanas, su barrio, sus trayectos, lo que hace después del trabajo. Parte de lo que ya sabes y entra en el detalle.`
    : `Eje de hoy: sus pasiones a fondo, y qué quiere hacer con la lengua — dónde y con quién piensa usarla. Conecta lo que cuenta con lo que ya sabes de él.`}
- Sondear su nivel: empieza muy simple. Cada pocos intercambios, intenta UNA estructura algo más difícil. Donde se atasque, simplifica sin comentario. Ese mapa es el objetivo de la llamada.
- No enseñes nada más, no impongas ningún tema. Sigue lo que le anima.`,
    todayTopic: (topic: string) => `# Hoy
Tema propuesto: ${topic}. Abre proponiéndolo en una frase corta y pregunta de inmediato si le va bien, o si prefiere hablar de otra cosa hoy. Si elige otra cosa, cambia al instante y por completo, sin comentario. Quédate en el tema acordado, pero sigue al alumno si deriva hacia algo que le importa.`,
    todayFields: (fields: string) => `\nEste tema se eligió por el vocabulario que obliga a usar: ${fields}. Haz pasar al alumno por ahí: introduce esas palabras, hazlas reutilizar y no te refugies en el léxico que ya domina.`,
    a0: `# Principiante absoluto
El alumno aún NO habla {{langue}}, o apenas tres palabras. Adáptalo todo:
- Lleva la llamada sobre todo en {{native}}, con sobriedad. El {{langue}} llega en pequeños toques, nunca en bloque.
- Cada llamada: 3 a 5 frases de supervivencia en {{langue}} (saludos, «me llamo…», «gracias», «más despacio, por favor»). Di la frase despacio, hazla repetir EN VOZ ALTA y retómala más tarde en la llamada.
- Elogia con sobriedad cada intento. Cero teoría, cero gramática.
- Termina con un mini-resumen en {{native}} de las frases aprendidas hoy.`,
    interference: `# Interferencias
El alumno también aprende: {{autres}}. Cuando una palabra o un giro de esas lenguas se cuela en su {{langue}}, señala el contraste en una palabra y da la forma {{langue}} — sin lección.`,
    talkHog: (pct: number) => `# Alerta: estás ocupando todo el espacio
En tus últimas llamadas, TÚ has dicho el ${pct} % de las palabras. Es justo lo contrario de lo que hace falta: al final de esta llamada, él tiene que haber hablado más que tú.
- Corta tus turnos por la mitad. Casi siempre basta con una frase.
- Elimina toda repetición de lo que él acaba de decir: ahí se va la mitad de tus palabras.
- Haz menos preguntas y deja trabajar al silencio.`,
    levelBeingEstablished: {
      niveau: 'en evaluación — las primeras llamadas sirven justamente para establecerlo',
      confiance: 'baja por ahora, es normal'
    },
    fallbacks: {
      student: 'el alumno', noTargets: '(ninguno hoy)', noProbes: '- (nada que sondear hoy)',
      noDirection: '(aún sin definir)', noFacts: '- (nada todavía)', noInterests: '- (nada todavía)',
      noWeaknesses: '- (nada todavía)', firstCall: '- (primera conversación)'
    },
    greetIntro: (name: string, n: number) => n === 1
      ? `(nota de dirección: abre la llamada ahora. Es tu primera conversación con ${name}. Preséntate en una frase corta y plana: eres Odile, su tutora, hablaréis con regularidad. Luego haz una primera pregunta muy simple sobre él. Dos frases como máximo. Eres Odile y nada más: ninguna mención de IA, de modelo o de asistente, y ningún comentario sobre tu manera de hablar.)`
      : `(nota de dirección: abre la llamada ahora. Es vuestra conversación número ${n}: ya os conocéis, NO te presentes y no vuelvas a preguntar nada que ya sepas. Saluda a ${name} con sobriedad, como a alguien que conoces, menciona de pasada algo que ya sabes de él y haz una pregunta simple y NUEVA. Dos frases como máximo. Eres Odile y nada más: ninguna mención de IA, de modelo o de asistente, y ningún comentario sobre tu manera de hablar.)`,
    greetDaily: (name: string, topic: string, minutes: number) =>
      `(nota de dirección: abre la llamada ahora. Eres Odile. DOS frases, no más. Primero saluda a ${name} por su nombre, corto y llano. Luego anuncia el plan con claridad, para que sepa exactamente qué le espera: de qué vais a hablar hoy («${topic}») y que tenéis unos ${minutes} minutos. Termina preguntando si le parece bien o si prefiere otra cosa. Ninguna mención a una IA, a un modelo o a un asistente, y ningún comentario sobre tu forma de hablar.)`,
    notes: {
      turnMode: '(nota de dirección: esta llamada va turno a turno. No podéis interrumpiros: tú hablas y luego esperas a que él termine. Por eso tus turnos deben ser CORTOS: de 1 a 3 frases y como mucho una pregunta. Lees una transcripción de lo que dice: no comentes nunca su pronunciación ni su acento y, si una palabra parece rara, trátala como una transcripción defectuosa y no como un error suyo. Para colgar, di tu última despedida y escribe [FIN] al final del mensaje; nunca antes de las despedidas, y no lo pronuncies jamás.)',
      materialPause: '(nota de dirección: el alumno consulta una ficha de gramática. Si estás hablando, termina tu frase y espera en silencio su vuelta.)',
      materialBack: '(nota de dirección: el alumno ha vuelto. Retoma donde estabais, una frase corta, sin comentar la pausa.)',
      paused: '(nota de dirección: el alumno ha puesto la conversación en pausa y se ha ausentado. Puede que te hayan cortado a media frase: es normal, no la termines ni la menciones. Espera en silencio. No añadas nada, no preguntes nada, no cuelgues — va a volver.)',
      resumed: '(nota de dirección: el alumno vuelve de su pausa. Retoma el hilo donde lo dejasteis, una frase corta, sin comentar la interrupción ni preguntar dónde estaba.)',
      oneMinute: '(nota de dirección: queda más o menos un minuto. Empieza a concluir la conversación con naturalidad.)',
      timeUp: '(nota de dirección: el tiempo se ha acabado. Termina la llamada ahora con un adiós corto, en tu tono habitual, y luego cuelga con la herramienta end_call.)',
      overtime: '(nota de dirección: la llamada ya debería haber terminado. Despídete en UNA frase, no hagas más preguntas y luego cuelga con la herramienta end_call.)',
      wordGoal: (word: string) => `(nota de dirección: el alumno tiene que colocar la palabra « ${word} » en la conversación, la tiene delante. Créale la ocasión: haz una pregunta o abre un turno donde esa palabra sea la respuesta natural. NO digas tú la palabra, no la sugieras y no menciones nunca este ejercicio.)`,
      wordGoalDone: (word: string) => `(nota de dirección: el alumno acaba de colocar « ${word} ». Sigue con naturalidad — como mucho una palabra seca de aprobación, ninguna mención del ejercicio.)`
    },
    facts: {
      cats: { arbeit: 'Trabajo', familie: 'Familia', orte: 'Lugares', alltag: 'Día a día', vorlieben: 'Gustos', sonstiges: 'Varios' },
      basics: 'Lo básico (ya lo sabes: úsalo con naturalidad y no se lo vuelvas a preguntar):',
      passing: 'De pasada (anecdótico: como mucho UNO por llamada, y solo si viene a cuento):',
      none: '- (todavía no lo conoces)'
    },
    records: {
      themes: 'Temas: ',
      callOf: 'llamada del ',
      fixFront: (original: string) => 'Corrige: «' + original + '»'
    }
  },
  comp: (() => {
    const G = compG('es-'), V = compV('es-'), F = compF('es-');
    return [
      G('A1', 'ser-estar', 'ser y estar en presente'),
      G('A1', 'presente-regular', 'presente regular (-ar, -er, -ir)'),
      G('A1', 'articulos-genero', 'artículos el / la / los / las y género'),
      G('A1', 'negacion', 'negación con no'),
      G('A1', 'preguntas', 'preguntas simples (¿qué, dónde, cuándo?)'),
      G('A1', 'tener-hay', 'tener y hay'),
      V('A1', 'presentacion', 'presentarse: nombre, edad, país, trabajo'),
      V('A1', 'numeros-hora', 'números, precios y hora'),
      V('A1', 'familia', 'familia cercana'),
      V('A1', 'comida', 'comida y bebida básicas'),
      V('A1', 'ciudad', 'lugares de la ciudad'),
      F('A1', 'saludar', 'saludar y despedirse'),
      F('A1', 'pedir', 'pedir con cortesía (quisiera, me gustaría)'),
      F('A1', 'gustos', 'decir lo que gusta (me gusta + nombre)'),
      F('A1', 'ayuda', 'pedir que repitan, decir que no se entiende'),
      G('A2', 'perfecto', 'pretérito perfecto (he hablado)'),
      G('A2', 'indefinido', 'pretérito indefinido (hablé, fui)'),
      G('A2', 'reflexivos', 'verbos reflexivos (levantarse, llamarse)'),
      G('A2', 'ir-a', 'futuro con ir a + infinitivo'),
      G('A2', 'pronombres-od', 'pronombres lo / la / los / las / le'),
      G('A2', 'gustar', 'gustar y verbos similares'),
      G('A2', 'comparativo', 'comparativo más / menos … que'),
      V('A2', 'rutina', 'rutina, trabajo y semana'),
      V('A2', 'ocio', 'ocio y deportes'),
      V('A2', 'compras', 'compras, ropa, tiendas'),
      V('A2', 'viajes', 'viajes y transportes'),
      V('A2', 'tiempo-naturaleza', 'tiempo, estaciones, naturaleza'),
      F('A2', 'contar-pasado', 'contar el día o el fin de semana'),
      F('A2', 'describir-lugar', 'describir un lugar, una vivienda'),
      F('A2', 'camino', 'preguntar y explicar un camino'),
      F('A2', 'planes', 'hablar de planes simples'),
      G('B1', 'imperfecto', 'imperfecto vs indefinido'),
      G('B1', 'futuro-simple', 'futuro simple'),
      G('B1', 'condicional', 'condicional de cortesía y consejo'),
      G('B1', 'subjuntivo-base', 'subjuntivo tras querer que / es importante que'),
      G('B1', 'estar-gerundio', 'estar + gerundio'),
      G('B1', 'relativos', 'relativos que / donde / quien'),
      V('B1', 'opiniones', 'opiniones y emociones'),
      V('B1', 'trabajo-estudios', 'trabajo y estudios en detalle'),
      V('B1', 'medios', 'medios y actualidad simple'),
      V('B1', 'salud', 'salud y citas'),
      V('B1', 'conectores', 'conectores frecuentes (primero, luego, sin embargo)'),
      F('B1', 'opinar', 'dar la opinión y justificarla (porque, por eso)'),
      F('B1', 'relato', 'contar un relato seguido en pasado'),
      F('B1', 'reclamar', 'hacer una reclamación simple'),
      F('B1', 'acuerdo', 'expresar acuerdo y desacuerdo con cortesía'),
      G('B2', 'subjuntivo-emocion', 'subjuntivo tras emoción y duda'),
      G('B2', 'subjuntivo-imperfecto', 'imperfecto de subjuntivo'),
      G('B2', 'si-clauses', 'hipótesis: si + subjuntivo → condicional'),
      G('B2', 'pasiva-se', 'pasiva y se impersonal'),
      G('B2', 'estilo-indirecto', 'estilo indirecto con concordancia'),
      V('B2', 'sociedad', 'debates de sociedad'),
      V('B2', 'profesional', 'mundo profesional'),
      V('B2', 'matices', 'matices de sentimiento'),
      V('B2', 'modismos', 'modismos corrientes'),
      F('B2', 'argumentar', 'argumentar con concesiones'),
      F('B2', 'debatir', 'debatir con matices'),
      F('B2', 'especular', 'especular sobre el pasado'),
      G('C1', 'subjuntivo-compuesto', 'subjuntivo compuesto y pluscuamperfecto'),
      G('C1', 'relieve', 'énfasis (lo que …, es …)'),
      G('C1', 'gerundio-avanzado', 'gerundio y participio avanzados'),
      G('C1', 'perifrasis', 'perífrasis verbales (llevar + gerundio, acabar de)'),
      V('C1', 'abstracto', 'léxico abstracto (libertad, memoria, tiempo)'),
      V('C1', 'especialidad', 'su especialidad explicada a un profano'),
      V('C1', 'humor', 'humor, ironía, sobreentendidos'),
      F('C1', 'exponer', 'desarrollar una exposición estructurada'),
      F('C1', 'registro', 'adaptar el registro al contexto'),
      F('C1', 'negociar', 'negociar, convencer'),
      G('C2', 'figuras', 'figuras de estilo con acierto'),
      G('C2', 'sintaxis', 'sintaxis compleja y fluida'),
      V('C2', 'modismos-raros', 'modismos raros y juegos de palabras'),
      V('C2', 'jerga', 'jerga y neologismos comprendidos'),
      F('C2', 'concesiones', 'debatir con concesiones finas'),
      F('C2', 'registro-cambio', 'cambiar de registro a demanda')
    ];
  })(),
  sheets: [],   // assigned below
  topics: [
    { lv: 'A2', t: 'Rol: en la panadería', fr: 'juego de rol — eres la panadera, el alumno es el cliente; quédate en tu papel: pedido, pago, una pregunta', tags: ['la cortesía', 'los números', 'comprar'] },
    { lv: 'B1', t: 'Rol: una reclamación', fr: 'juego de rol — eres atención al cliente, el alumno devuelve un objeto roto; haz preguntas, propone soluciones, él debe argumentar', tags: ['argumentar', 'el pretérito'] },
    { lv: 'B2', t: 'Información oculta: adivina', fr: 'juego de información oculta — inventa en secreto su fin de semana ideal; él adivina con preguntas, tú solo respondes sí, no o casi', tags: ['las preguntas', 'las hipótesis'] },
    { lv: 'A1', t: 'Presentarse', fr: 'presentarse: nombre, ciudad, trabajo, familia', tags: ['ser y estar', 'los números', 'los oficios'] },
    { lv: 'A1', t: 'Pedir en el café', fr: 'pedir en el café: bebidas, la cuenta', tags: ['quisiera', 'las cantidades', 'la cortesía'] },
    { lv: 'A1', t: 'Mi día típico', fr: 'la rutina diaria: la mañana, la tarde, los horarios', tags: ['la hora', 'el presente', 'verbos reflexivos'] },
    { lv: 'A1', t: 'Mi casa', fr: 'describir la casa y el barrio', tags: ['hay', 'preposiciones', 'los muebles'] },
    { lv: 'A2', t: 'Paseos y naturaleza', fr: 'los paseos, la naturaleza, los árboles, las estaciones', tags: ['gustar + infinitivo', 'situar un lugar', 'el tiempo'] },
    { lv: 'A2', t: 'El fin de semana pasado', fr: 'contar el fin de semana', tags: ['indefinido', 'adverbios de tiempo', 'primero, luego…'] },
    { lv: 'A2', t: 'Cocina y recetas', fr: 'la cocina: platos favoritos, recetas, especias', tags: ['las cantidades', 'el imperativo', 'me gusta / me encanta'] },
    { lv: 'A2', t: 'Aficiones', fr: 'las aficiones: dibujar, la música, el deporte', tags: ['jugar a', 'desde hace', 'pronombres'] },
    { lv: 'B1', t: 'Cine y series', fr: 'hablar de películas y series: opiniones, recomendaciones', tags: ['dar la opinión', 'que / donde', 'el pasado'] },
    { lv: 'B1', t: 'Planes y futuro', fr: 'los planes: viajes, trabajo, aprendizaje', tags: ['ir a + infinitivo', 'futuro simple', 'las condiciones'] },
    { lv: 'B1', t: 'Trabajo y día a día', fr: 'el trabajo: un día típico, colegas, reuniones', tags: ['imperfecto vs indefinido', 'la frecuencia', 'estilo indirecto'] },
    { lv: 'B1', t: 'Defender una opinión', fr: 'defender una opinión simple: a favor o en contra', tags: ['porque / por eso / sin embargo', 'subjuntivo (inicio)', 'dar ejemplos'] },
    { lv: 'B2', t: 'La actualidad', fr: 'discutir un tema de actualidad', tags: ['el subjuntivo', 'la pasiva con se', 'nominalización'] },
    { lv: 'B2', t: 'Y si… (hipótesis)', fr: 'hacer hipótesis sobre la vida', tags: ['si + imperfecto de subjuntivo → condicional', 'los sueños', 'justificar'] },
    { lv: 'B2', t: '¿Ciudad o campo?', fr: 'debatir: vivir en la ciudad o en el campo', tags: ['argumentar', 'aunque + subjuntivo', 'comparar'] },
    { lv: 'C1', t: 'Ideas abstractas', fr: 'discutir ideas abstractas: libertad, memoria, tiempo', tags: ['vocabulario culto', 'los conectores', 'las hipótesis'] },
    { lv: 'C1', t: 'Explicar tu campo', fr: 'explicar su campo a un no especialista', tags: ['lengua de especialidad', 'parafrasear', 'la precisión'] },
    { lv: 'C2', t: 'Cambiar de registro', fr: 'decir lo mismo en registro coloquial, corriente, culto', tags: ['los registros', 'los modismos', 'las sutilezas'] }
  ],
  introTopics: [
    { t: 'Conocerse: ¿quién eres?', fr: 'conocerse: quién eres, qué haces', tags: [] },
    { t: 'Tu día a día y tu semana', fr: 'tu rutina, tu semana, tu barrio', tags: [] },
    { t: 'Tus pasiones en detalle', fr: 'tus pasiones y por qué aprendes español', tags: [] }
  ],
  starter: [
    { t: '¡Hola!', de: 'Hallo!', en: 'Hello!' },
    { t: 'Muchas gracias.', de: 'Danke schön.', en: 'Thank you very much.' },
    { t: 'Me llamo…', de: 'Ich heiße…', en: 'My name is…' },
    { t: '¿Qué tal?', de: 'Wie geht’s?', en: 'How are you?' },
    { t: 'Sí. / No.', de: 'Ja. / Nein.', en: 'Yes. / No.' },
    { t: 'No entiendo.', de: 'Ich verstehe nicht.', en: 'I don’t understand.' },
    { t: 'Más despacio, por favor.', de: 'Langsamer, bitte.', en: 'Slower, please.' },
    { t: '¿Cómo se dice…?', de: 'Wie sagt man…?', en: 'How do you say…?' },
    { t: '¡Adiós!', de: 'Auf Wiedersehen!', en: 'Goodbye!' },
    { t: '¡Hasta mañana!', de: 'Bis morgen!', en: 'See you tomorrow!' }
  ]
};

/* Spanish cheat sheets (German glosses, the default native language). */
const E = (id: string, title: string, match: string[], core: string[], examples: { t: string; gloss: string }[], traps?: string[]): CheatSheet =>
  ({ id, lang: 'es', title, match, core, examples, traps });

es.sheets = [
  E('es-g-ser-estar', 'Ser vs estar', ['ser', 'estar'],
    ['ser = identité, origine, heure : « soy alemán »',
     'estar = état, lieu, gérondif : « estoy cansado », « estoy en casa »',
     'ser : soy, eres, es, somos, sois, son · estar : estoy, estás, está…'],
    [{ t: 'Soy profesor y estoy contento.', gloss: 'Ich bin Lehrer und (gerade) zufrieden.' },
     { t: 'El café está frío.', gloss: 'Der Kaffee ist (jetzt) kalt.' }],
    ['« soy cansado » ✗ → « estoy cansado » ✓']),
  E('es-g-presente', 'Presente regular', ['presente'],
    ['-ar : hablo, hablas, habla, hablamos, habláis, hablan',
     '-er : como, comes… · -ir : vivo, vives…',
     'Sujet souvent omis : « hablo » suffit'],
    [{ t: 'Vivimos en Hamburgo.', gloss: 'Wir wohnen in Hamburg.' },
     { t: '¿Comes carne?', gloss: 'Isst du Fleisch?' }]),
  E('es-g-articulos', 'Artículos y género', ['articulos', 'genero'],
    ['el, la, los, las / un, una, unos, unas',
     '-o masculin, -a féminin (mais : el día, la mano)',
     'a + el → al ; de + el → del'],
    [{ t: 'Voy al mercado del centro.', gloss: 'Ich gehe zum Markt im Zentrum.' }]),
  E('es-g-negacion', 'La negación', ['negacion', 'nunca'],
    ['no + verbe : « no sé »', 'nunca, nada, nadie : « No como nunca carne » ou « Nunca como carne »',
     'Double négation normale : « No veo nada »'],
    [{ t: 'No he estado nunca en México.', gloss: 'Ich war noch nie in Mexiko.' }]),
  E('es-g-preguntas', 'Preguntas', ['preguntas'],
    ['¿ … ? avec intonation : « ¿Vienes? »',
     '¿Qué, dónde, cuándo, por qué, cómo, cuánto?'],
    [{ t: '¿Dónde trabajas?', gloss: 'Wo arbeitest du?' },
     { t: '¿Por qué no vamos juntos?', gloss: 'Warum gehen wir nicht zusammen?' }]),
  E('es-g-preterito-perfecto', 'Pretérito perfecto', ['preterito perfecto', 'he hablado'],
    ['haber + participio : he, has, ha, hemos, habéis, han + hablado/comido/vivido',
     'Pour un passé lié au présent : hoy, esta semana, ya, todavía no',
     'Irréguliers : hecho, visto, dicho, escrito, puesto'],
    [{ t: 'Hoy he trabajado mucho.', gloss: 'Heute habe ich viel gearbeitet.' },
     { t: '¿Ya has visto la película?', gloss: 'Hast du den Film schon gesehen?' }]),
  E('es-g-indefinido', 'Pretérito indefinido', ['indefinido'],
    ['Passé daté, terminé : ayer, en 2020, la semana pasada',
     '-ar : hablé, hablaste, habló, hablamos, hablasteis, hablaron',
     'Irréguliers : fui (ser/ir), tuve, hice, estuve, dije'],
    [{ t: 'Ayer fui al cine.', gloss: 'Gestern ging ich ins Kino.' },
     { t: 'En 2019 viví en Madrid.', gloss: '2019 lebte ich in Madrid.' }],
    ['hoy → perfecto ; ayer → indefinido']),
  E('es-g-imperfecto', 'Imperfecto vs indefinido', ['imperfecto'],
    ['Imperfecto = décor, habitude : hablaba, comía, vivía (era, iba, veía irrég.)',
     'Indefinido = événement ponctuel',
     '« Llovía cuando salí. »'],
    [{ t: 'De niño jugaba en la calle.', gloss: 'Als Kind spielte ich auf der Straße.' },
     { t: 'Dormía cuando llamaste.', gloss: 'Ich schlief, als du anriefst.' }]),
  E('es-g-reflexivos', 'Verbos reflexivos', ['reflexivos', 'levantarse'],
    ['me, te, se, nos, os, se : « me levanto »',
     'Avec infinitif : « prefiero levantarme tarde » (pronom attaché)'],
    [{ t: 'Me acuesto a las once.', gloss: 'Ich gehe um elf ins Bett.' },
     { t: '¿Cómo te llamas?', gloss: 'Wie heißt du?' }]),
  E('es-g-ir-a', 'Futuro con ir a', ['ir a', 'futuro proximo'],
    ['ir (voy, vas, va…) + a + infinitivo : « voy a comer »'],
    [{ t: 'Mañana vamos a visitar a mis padres.', gloss: 'Morgen besuchen wir meine Eltern.' }]),
  E('es-g-od-oi', 'Pronombres : lo, la, los, las / le, les', ['pronombres', 'lo la'],
    ['Direct : lo, la, los, las — « Lo veo. »',
     'Indirect : le, les (→ se devant lo/la) : « Se lo digo. »',
     'Avant le verbe conjugué, ou attachés à l’infinitif : « quiero verlo »'],
    [{ t: '¿El libro? Lo he leído.', gloss: 'Das Buch? Ich habe es gelesen.' },
     { t: 'A María le escribo mañana.', gloss: 'Maria schreibe ich morgen.' }],
    ['« le lo » ✗ → « se lo » ✓']),
  E('es-g-comparativo', 'Comparar', ['comparativo', 'mas que'],
    ['más/menos + adj + que ; tan + adj + como',
     'bueno → mejor ; malo → peor'],
    [{ t: 'El tren es más rápido que el bus.', gloss: 'Der Zug ist schneller als der Bus.' },
     { t: 'Hoy es mejor que ayer.', gloss: 'Heute ist besser als gestern.' }]),
  E('es-g-futuro', 'Futuro simple', ['futuro simple'],
    ['Infinitif + é, ás, á, emos, éis, án : « hablaré »',
     'Irréguliers : tendré, haré, podré, sabré, vendré'],
    [{ t: 'Te llamaré mañana.', gloss: 'Ich rufe dich morgen an.' },
     { t: 'Ya veremos.', gloss: 'Wir werden sehen.' }]),
  E('es-g-condicional', 'El condicional', ['condicional'],
    ['Infinitif + ía, ías, ía, íamos, íais, ían : « hablaría »',
     'Politesse : « me gustaría », conseil : « deberías »',
     'Irréguliers comme au futur : tendría, haría, podría'],
    [{ t: 'Me gustaría un café.', gloss: 'Ich hätte gern einen Kaffee.' },
     { t: 'Deberías descansar.', gloss: 'Du solltest dich ausruhen.' },
     { t: 'Si tuviera tiempo, iría.', gloss: 'Wenn ich Zeit hätte, würde ich hingehen.' }]),
  E('es-g-subjuntivo', 'Subjuntivo presente', ['subjuntivo'],
    ['Après querer que, es importante que, ojalá : « quiero que vengas »',
     '-ar → e (hable), -er/-ir → a (coma, viva)',
     'Irréguliers : sea, esté, vaya, haga, tenga'],
    [{ t: 'Ojalá haga sol mañana.', gloss: 'Hoffentlich scheint morgen die Sonne.' },
     { t: 'Quiero que me lo cuentes.', gloss: 'Ich will, dass du es mir erzählst.' }]),
  E('es-g-si-clauses', 'Hipótesis con si', ['hipotesis', 'si + subjuntivo'],
    ['Réel : si + presente → futuro : « Si llueve, me quedaré »',
     'Irréel : si + imperfecto de subjuntivo → condicional : « Si fuera rico, viajaría »'],
    [{ t: 'Si vinieras, cocinaríamos juntos.', gloss: 'Wenn du kämst, würden wir zusammen kochen.' }],
    ['Jamais « si + condicional »']),
  E('es-g-gerundio', 'Gerundio y estar + -ndo', ['gerundio'],
    ['-ar → -ando, -er/-ir → -iendo : hablando, comiendo',
     'estar + gerundio = action en cours : « estoy trabajando »'],
    [{ t: '¿Qué estás haciendo?', gloss: 'Was machst du gerade?' },
     { t: 'Aprendo escuchando.', gloss: 'Ich lerne durch Zuhören.' }]),
  E('es-g-gustar', 'Gustar y verbos como gustar', ['gustar'],
    ['me/te/le/nos/os/les + gusta (sg) / gustan (pl)',
     '« Me gusta el café » / « Me gustan los árboles »',
     'Pareil : encantar, interesar, doler'],
    [{ t: 'Me encantan los árboles viejos.', gloss: 'Ich liebe alte Bäume.' },
     { t: '¿Te gusta dibujar?', gloss: 'Zeichnest du gern?' }],
    ['« Yo gusto el café » ✗ → « Me gusta el café » ✓'])
];
