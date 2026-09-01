import type { CheatSheet, LangPack } from './types';
import { compF, compG, compV } from './types';
import type { UIStrings } from './fr';

/* ============================== PORTUGUÊS ============================== */

const ui: UIStrings = {
  nav: { today: 'Hoje', cards: 'Cartões', memory: 'Memória', settings: 'Definições' },
  skills: { grammar: 'gramática', vocabulary: 'vocabulário', fluency: 'fluência', comprehension: 'compreensão' },
  status: { new: 'novo', persisting: 'persistente', improving: 'a melhorar', resolved: 'dominado' },
  factCats: { arbeit: 'Trabalho', familie: 'Família', alltag: 'Dia a dia', vorlieben: 'Gostos', orte: 'Lugares', sonstiges: 'Vários' },
  periods: { week: 'Balanço da semana', month: 'Balanço do mês', quarter: 'Balanço do trimestre' },
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
    close: 'Fechar', cancel: 'Cancelar', back: 'Voltar', save: 'Guardar', del: 'Apagar',
    search: 'Procurar…', listen: 'Ouvir', moment: 'Um momento…', retry: 'Tentar de novo', done: 'Feito',
    copy: 'Copiar', copied: 'Copiado.', load: 'Carregar', see: 'Ver', settle: 'Resolver', min: 'min', undo: 'Desfazer', audioFail: 'Áudio indisponível. Tenta de novo.', edit: 'Editar', loading: 'A carregar…'
  },
  app: {
    analyzingTitle: 'A Odile relê a vossa conversa…', analyzingSub: 'Conselhos, nível, cartões novos.',
    verbatimStage: 'Transcrição fiel do teu microfone, erros incluídos…',
    thinkingStage: 'A Odile reflete…', writingStage: (pct: number) => `A análise escreve-se — ${pct} %`,
    failTitle: 'Análise falhada', failSub: 'A conversa não se perdeu.', keepTranscript: 'Guardar a transcrição',
    analyzeFailToast: (msg: string) => 'Análise falhada: ' + msg, authExpired: 'acesso expirado.',
    synced: 'Sincronizado do outro dispositivo.', transcriptKept: 'Transcrição guardada.', savedNoAnalysis: 'Guardado sem análise.',
    dropNothing: 'Ligação perdida, nada guardado.', emptyNothing: 'Nada guardado.',
    updateReady: 'Nova versão disponível.', updateReload: 'Recarregar',
    crashTitle: 'Este ecrã não pôde ser mostrado',
    crashSub: 'A tua conversa está guardada — é esta vista que não consegue lê-la.',
    crashBack: 'Voltar'
  },
  today: {
    backlogLine: (n: number, days: number) => `${n} novas à espera, cerca de ${days} dias`,
    roundOf: (n: number, of: number) => `sessão ${n}/${of}`,
    roundExtra: (n: number) => `sessão ${n} · extra`,
    rhythmLine: (perDay: number, rounds: number) => `${perDay} cartões novos por dia · ${rounds} ${rounds === 1 ? 'sessão' : 'sessões'}`,
    level: 'Nível', missingAccess: (what: string) => `Falta o acesso: ${what}.`, accessCode: 'código de acesso', apiKey: 'chave OpenAI',
    noServerKey: 'Falta a chave OpenAI no servidor (Netlify → OPENAI_API_KEY), ou passa para « A minha chave » nas definições.',
    twoMinutes: '2 minutos', doCheckin: 'Fazer o balanço',
    introChip: (n: number) => `Conhecermo-nos ${n}/3`, introSub: 'A Odile aprende quem és e estabelece o teu nível.',
    yourCall: (min: number) => `A tua conversa · ${min} min`, proposes: 'A Odile propõe', yourTopic: 'o teu tema',
    forYourLevel: 'para o teu nível', interestsYou: 'interessa-te',
    otherIdea: 'Outra ideia', freeTopic: 'Tema livre', freePlaceholder: 'De que queres falar?',
    callAgain: 'Liga à Odile', callOdile: 'Ligar à Odile', freeConversation: 'Conversa livre',
    eveningReview: 'A tua revisão', due: 'a rever', fresh: 'novos', total: 'no total',
    nothingToReview: 'Nada para rever', cardsTonight: (n: number) => `Aprender o vocabulário (${n})`,
    warmup: 'Aquecimento: 3 cartões antes da chamada',
    warmupShort: 'Aquecimento · 3',
    seeCards: 'Editar os cartões',
    moreActivities: 'Mais atividades',
    xpWeek: (n: number, g: number) => `${n} / ${g} XP esta semana`,
    xpWeekUp: (n: number) => `${n} XP · subida garantida`,
    xpWeekHeld: (n: number) => `${n} XP · patente mantida`,
    xpTotalOf: (n: number, next: number) => `${n} XP no total desde o início · próxima marca ${next}`,
    reviewTitle: 'Rever',
    watchesLead: (n: number) => `Ela repara em ${n === 1 ? 'uma coisa' : n === 2 ? 'duas coisas' : n === 3 ? 'três coisas' : `${n} coisas`}: `,
    nCards: (n: number) => `${n} ${n === 1 ? 'cartão' : 'cartões'}`,
    bornOf: (d: string) => `nascida da tua chamada de ${d}`,
    startReview: 'Começar',
    daysRow: (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`,
    daysMissed: (n: number) => `${n} ${n === 1 ? 'dia saltado' : 'dias saltados'}`,
  },
  call: {
    goalKicker: 'Coloca esta palavra', goalDone: 'Colocada', goalHit: (w: string) => `« ${w} » colocada.`,
    micStage: 'Micro…', connecting: 'A ligar…', configuring: 'Um momento…', readsSheet: 'deixa-te ler',
    speaks: 'fala', listens: 'escuta-te', yourTurn: 'é a tua vez',
    pause: 'Pausa', resume: 'Retomar', pausedState: 'em pausa', pausedNote: 'Odile espera. O tempo parou.',
    mute: 'Silenciar o micro', muted: 'Silenciado', mic: 'Micro', hangup: 'Desligar', captions: 'Legendas',
    sheet: 'Ficha', sheets: 'Fichas', resumeCall: 'Retomar a chamada',
    thinks: 'está a pensar', turnDone: 'Terminei', turnSpeak: 'Falar', turnSkip: 'Saltar',
    connFailed: (msg: string) => 'Ligação falhada: ' + msg, connLost: 'Ligação perdida.', autoEnded: 'A Odile desligou.', echoHeard: 'A chamada ouve-se a si própria — melhor com auscultadores. A Odile está a ajustar-se.'
  },
  review: {
    wordsPlaced: 'palavras colocadas',
    costTitle: 'Quanto custou esta chamada', costTotal: 'Total',
    briefingTitle: 'O que a Odile tinha à frente',
    briefingNote: 'O briefing exacto desta chamada, tal como estava nesse dia. O das definições mostra o que lhe seria dito hoje, o que não é a mesma coisa.',
    costLeg: { stt: 'O que disseste', chat: 'As respostas dela', tts: 'A voz dela', realtime: 'Conversa', captions: 'Legendas ao vivo', verbatim: 'Transcrição fiel', analysis: 'Análise' } as Record<string, string>,
    costPer10: (t: string) => `ou seja ${t} por dez minutos`,
    costNote: 'Estimativa, com os preços da OpenAI no momento da chamada.',
    yourConversation: 'A vossa conversa', toRemember: 'A RETER', duration: 'duração', yourWords: 'as tuas palavras',
    tips: 'conselhos', praise: 'muito bem', estLevel: 'Nível estimado', dayTargets: 'Objetivos do dia',
    transcriptTips: 'Transcrição e conselhos', tip: 'CONSELHO', better: 'Melhor:', great: 'MUITO BEM',
    verbatimTitle: 'O que disseste realmente', verbatimNote: 'O teu microfone, transcrito de uma só vez, erros incluídos. As bolhas acima vêm das legendas em direto, que cortam e suavizam.',
    starActive: '★ Primeiro esta noite', starCard: '☆ Priorizar o cartão', makeCard: '☆ Fazer um cartão',
    starTitle: 'O cartão passa para o início da tua próxima revisão',
    imgChange: '🖼 Mudar a imagem', imgAdd: '🖼 Juntar uma imagem', imgTitle: 'Juntar uma imagem ao cartão',
    newCards: (n: number) => `${n} ${n === 1 ? 'cartão novo' : 'cartões novos'}`, newVocab: 'Palavras novas', vocabHasCard: 'Cartão criado', vocabMakeCard: 'Criar o cartão', vocabRemoveCard: 'Remover os cartões', vocabCardsRemoved: (n: number) => `${n} ${n === 1 ? 'cartão removido' : 'cartões removidos'}.`,
    noAnalysis: 'Sem análise para esta conversa', duoImport: ' (importado do Duolingo)', continue: 'Continuar',
    noticeTitle: 'O que mudou a Odile?', noticeShow: 'Ver a versão dela',
    tipsTitle: 'Dicas', praiseTitle: 'O que correu bem',
    noVocab: 'Nenhuma palavra nova desta conversa.',
    turnCards: (n: number) => `${n} ${n === 1 ? 'cartão' : 'cartões'}`, turnCardsTitle: 'Esta frase gerou cartões',
    wpmLine: (n: number) => `${n} palavras/min`,
    yourShare: 'a tua parte da conversa',
    sceneTitle: 'A revisão', nextTime: 'Da próxima vez', backToCall: 'Voltar à conversa',
    callOf: (min: number, d: string) => `Chamada de ${min} min · ${d}`,
    panelYou: 'Tu', panelHer: 'Ela retoma', panelOut: 'O que sai daí',
  },
  flu: {
    title: 'Fluência 4/3/2',
    offer: 'Conta a conversa de hoje, três vezes, cada vez mais depressa.',
    explain: 'Três voltas: 60, 45 e 30 segundos. A mesma história de cada vez — menos tempo, mais à-vontade.',
    round: (n: number, s: number) => `Volta ${n} · ${s} s`,
    start: 'Falar', stopEarly: 'Terminei', recording: 'Estou a ouvir…', transcribing: 'A transcrever…',
    results: 'O teu ritmo', mots: 'palavras', wpm: 'palavras/min',
    failMic: 'Microfone indisponível.', later: 'Mais tarde',
    praiseUp: 'Mais rápido a cada volta. É esse o objetivo.', praiseFlat: 'Bem. A velocidade virá com a repetição.'
  },
  story: {
    title: 'História do dia', sub: 'Dois minutos de escuta, escritos para ti',
    make: 'Ouvir a história do dia', making: 'A Odile escreve a tua história…',
    play: 'Ouvir', stop: 'Parar', fail: 'Sem história por agora. Tenta de novo.',
    questions: 'Uma pergunta por parágrafo:',
    newOne: 'Nova história',
    showText: 'Ver o texto', hideText: 'Esconder o texto',
    tapHint: 'Toca no que não entendes: tradução, e cartões se quiseres.',
    listenFirst: 'As perguntas vão chegando enquanto ouves…',
    right: 'Exato!',
    wrongWas: (certa: string) => `Não — era: ${certa}`,
    para: (i: number) => `Parágrafo ${i}`,
    noTrans: 'Tradução impossível. Tenta de novo.',
    score: (g: number, n: number) => `${g}/${n} respostas certas`
  },
  rev: {
    typeCloze: 'Completa', typeToNative: 'O que significa?', typeToTarget: (lang: string) => `Em ${lang}?`,
    finishedTitle: 'Revisão terminada', doneCards: (n: number) => `${n} ${n === 1 ? 'cartão' : 'cartões'}. Bom.`, nothing: 'Nada para rever.',
    sessionLine: (known: number, hard: number, again: number, xp: number) => `${known} ${known === 1 ? 'sabido' : 'sabidos'} · ${hard} ${hard === 1 ? 'difícil' : 'difíceis'} · ${again} ${again === 1 ? 'repetido' : 'repetidos'} · +${xp} XP`,
    finish: 'Terminar', hint: 'Pista:', speakAloud: 'Responde em voz alta e vira.', flip: 'Virar',
    personalize: 'Personalizar (imagem)',
    grades: { again: 'Outra vez', hard: 'Difícil', good: 'Bem', easy: 'Fácil' },
    now: 'já a seguir', dayN: (n: number) => (n === 1 ? '1 dia' : `${n} dias`),
    recordAnswer: 'Gravar-te', replayAnswer: 'Reouvir a tua resposta',
    fromCall: (d: string) => `A tua frase de ${d}`, askedWord: (d: string) => `Palavra de ${d}`,
    sheRecast: 'Aqui foi ela que te corrigiu.', youAsked: 'Pediste-lhe esta palavra.',
  },
  pace: {
    title: 'Estás a acompanhar?',
    growing: (n: string) => `A pilha cresce ${n} cartões por dia.`,
    clearing: (n: string) => `A pilha diminui ${n} cartões por dia.`,
    level: 'Cartões criados e sustentados estão equilibrados.',
    idle: 'Sem cartões e sem revisões esta semana.',
    keyMade: 'criados', keyCarry: 'o que aguentas', keyOver: 'mais criados do que aguentados',
    waiting: (n: number) => `${n} à espera`,
    clearIn: (d: number) => `resolvido em cerca de ${d} dias`,
    neverClear: 'a este ritmo não recuperas',
    basis: (a: string, r: string) => `Nos últimos 7 dias: ${a} cartões novos por dia, ${r} revisões por dia.`,
    estimate: 'Quantos começas só agora passou a ser contado — estimado até lá.',
    addedN: (n: number) => `${n} criados`,
    reviewsN: (n: number) => `${n} revistos`
  },
  cards: {
    title: 'Cartões', review: 'Rever', nothingToReview: 'Nada para rever', due: 'a rever', fresh: 'novos',
    active: 'ativos', typeCloze: 'Lacuna', newCard: 'novo', forDate: (d: string) => 'para ' + d,
    days: 'd', missed: (n: number) => `${n}× falhado`,
    empty: 'Ainda sem cartões. Nascerão das tuas conversas.', lastReviews: 'Últimas revisões',
    reviewLine: (total: number, known: number, xp: number) => `${total} ${total === 1 ? 'cartão' : 'cartões'} · ${known} ${known === 1 ? 'sabido' : 'sabidos'} · +${xp} XP`,
    batchNew: (n: number) => `Esta sessão (${n})`, batchRest: 'O resto', batchChip: 'NOVA',
    matureNote: 'Aprendido = intervalo de 21 dias ou mais.', emptyFiltered: 'Nada com este filtro.',
    deletedToast: 'Cartão apagado.', resume: (d: number, t: number) => `Retomar ${d}/${t}`,
    f: {
      all: 'Todos', learning: 'Em curso', learned: 'Aprendidos',
      lastKnown: 'sabido', lastMissed: 'falhado',
      sort: 'Ordem', byDue: 'prazo', byStatus: 'estado', byDifficulty: 'dificuldade',
      stageLearning: 'em curso', stageLearned: 'aprendido'
    }
  },
  checkin: {
    rankWeeks: (up: number, down: number, held: number) => `${up} subidas, ${held} mantidas, ${down} descidas`,
    rankNeeds: (hold: number, climb: number) => `${hold} XP para manter · ${climb} para subir`,
    laterBtn: 'Mais tarde', calls: 'chamadas', minutes: 'minutos', cardsKnown: 'cartões sabidos', level: 'nível',
    working: 'A Odile faz o balanço…', unavailable: (e: string) => `Balanço indisponível: ${e}`,
    moved: 'MEXEU', toWork: 'A TRABALHAR', proposal: 'Proposta:', noted: 'Anotado',
    steer: 'As tuas escolhas orientam as chamadas do próximo período.',
    savedDirection: 'Rumo anotado. Mantemos o ritmo.', savedPlain: 'Balanço anotado.'
  },
  memory: {
    title: 'Memória', savedServer: 'guardada no servidor', savedLocal: 'só neste navegador',
    intro: 'Tudo o que a Odile sabe de ti. Cada entrada lê-se, edita-se, apaga-se.',
    tabs: { over: 'Visão geral', comp: 'Mapa', prog: 'Progresso', carnet: 'Caderno', sess: 'Conversas', adv: 'Avançado' },
    tabsOld: { gaps: 'Lacunas', str: 'Pontos fortes', facts: 'Factos', voc: 'Vocabulário', brief: 'Briefing', data: 'Dados' },
    portraitTitle: 'Quem tu és, para ela',
    portraitNote: 'O que a Odile tem em mente quando atende. Os factos que voltam de chamada para chamada fazem o retrato; os outros só aparecem de passagem.',
    levelCefr: 'NÍVEL (QECR)', reliability: 'Fiabilidade', establishing: 'Estabelecido nas três primeiras chamadas.',
    skillsTitle: 'Competências', progress: 'Progressão', weeklyCheckin: 'Fazer o balanço (semana)',
    streakDays: 'dias seguidos', conversations: 'conversas', minutes: 'minutos',
    yourTopics: 'Os teus temas', noTopics: 'Ainda nada. Virá a falar.',
    matrixIntro: 'O teu nível é feito de ilhas, não de uma linha. Cada célula é uma competência precisa; a Odile sonda as células cinzentas abaixo do teu nível e anota as ilhas acima.',
    catGrammar: 'Gramática', catVocab: 'Vocabulário', catSpeak: 'Falar',
    noData: 'Ainda sem dados. A Odile vai sondá-lo discretamente.',
    acquired: 'Dominado', toWorkOn: 'A trabalhar', partial: 'Parcial', seenOn: 'visto a',
    legendOk: 'dominado', legendKo: 'a trabalhar', legendPartial: 'parcial', legendNone: 'sem dados',
    pinNext: 'Trabalhar isto na próxima chamada', pinned: '✓ Previsto na próxima chamada — anular',
    pinnedToast: 'No programa da próxima chamada.', markAcquired: 'Marcar dominado', clearData: 'Apagar o dado',
    nextCall: 'Na próxima chamada:',
    gapsLine: (open: number, done: number) => `${open} abertas · ${done} dominadas. As lacunas abertas tornam-se os objetivos da próxima chamada.`,
    seenFirst: 'vista a', seenLast: 'última vez', workedTimes: 'trabalhada', examples: 'Exemplos',
    markGapAcquired: 'Marcar dominada', forget: 'Esquecer', noGaps: 'Nenhuma lacuna anotada por agora.',
    strengthTag: '✓ ponto forte', noStrengths: 'Ainda nada. Virá.',
    factsIntro: 'O que contaste à Odile. Guarda o essencial e usa-o para perguntas a sério.',
    saidOn: 'dito a', saidAgain: 'repetido a', noFacts: 'Ainda nada. Virá a falar.',
    noVocabFound: 'Nada encontrado.', vocabCount: (n: number) => `${n} palavras. A Odile resgata antigas de vez em quando.`,
    importTag: '✉ importado · ', noSessions: 'Ainda sem conversas.',
    briefIntro: 'Exatamente o que a Odile receberá na próxima chamada: tema, nível e objetivos vindos da app. Nada mais.',
    editTemplate: 'Editar o modelo', customTemplate: 'modelo personalizado', variables: 'Variáveis:',
    varWhat: 'O que contém cada variável?', reset: 'Repor', briefSaved: 'Briefing guardado.',
    varGloss: {
      name: 'nome', native: 'língua materna', langue: 'língua-alvo', niveau: 'nível estimado',
      competences: 'detalhe por competência', confiance: 'fiabilidade da estimativa', bande: 'banda A1–C2',
      persona: 'caráter da Odile', aujourdhui: 'bloco do tema do dia', minutes: 'duração prevista',
      objectifs: 'objetivos do dia', sondages: 'competências sondadas', cap: 'rumo do período',
      faits: 'factos pessoais', interets: 'interesses', faiblesses: 'pontos fracos', passe: 'conversas passadas'
    } as Record<string, string>,
    exportJson: 'Exportar (JSON)', importBtn: 'Importar', rawJson: 'JSON bruto', closeEditor: 'Fechar o editor',
    forgetAll: 'Esquecer tudo', forgetAllConfirm: 'Esquecer tudo? Isto apaga este perfil neste aparelho E a cópia no servidor.',
    serverWipeFailed: 'Não foi possível apagar a cópia no servidor (offline?). Apagar mesmo assim localmente?',
    entryForgotten: 'Entrada esquecida.',
    applySave: 'Validar e guardar', importedToast: 'Memória importada.', savedToast: 'Guardado.',
    invalidJson: (msg: string) => 'JSON inválido: ' + msg, unknownFormat: 'formato desconhecido',
    dataNoteSynced: 'Cópia local + servidor. Exportar/Importar para levar tudo contigo.',
    dataNoteLocal: 'Guardada neste navegador. Exportar/Importar para mudar de dispositivo.',
    levelChartEmpty: 'A tua curva de nível aparecerá após algumas conversas.', levelChartLabel: 'Progressão do nível',
    monthScenes: (n: number) => `${n} ${n === 1 ? 'cena' : 'cenas'}`,
    monthMoved: 'O que mexeu', monthEmpty: 'Ainda nada este mês. A grelha enche-se a falar.',
    legendCall: 'chamada', legendBoth: 'chamada + cartões', legendToday: 'hoje',
    cardsBorn: 'cartões nascidos das tuas chamadas', wpmLabel: 'palavras por minuto',
    wpmPrev: (n: number) => `(${n} no mês passado)`,
  },
  profiles: {
    languages: 'Línguas', addLanguage: 'Adicionar uma língua',
    title: 'Perfis', intro: 'Cada perfil tem a sua memória, o seu nível e os seus cartões. A Odile não confunde ninguém.',
    active: 'ativo', since: 'desde', rename: 'Renomear', renamePrompt: 'Novo nome:',
    deleteConfirm: (name: string) => `Apagar o perfil « ${name} », memória e cartões incluídos?`,
    newProfile: 'Novo perfil', backupTitle: 'Cópia e outros dispositivos',
    accountSaved: (email: string) => `Este perfil é guardado continuamente na tua conta (${email}). Inicia sessão noutro dispositivo e ele espera-te lá.`,
    onAccount: 'Na conta', thisOne: '(este)', lastActivity: 'última atividade', profileWord: 'Perfil',
    loadFailed: 'Carregamento falhado.', loaded: (name: string) => 'Perfil carregado: ' + name,
    switched: 'Perfil mudado.', noMemory: 'Este perfil ainda não tem memória.',
    syncOn: 'Todo este perfil (conversas, memória, cartões) é guardado continuamente no servidor. Noutro dispositivo, introduz este código em « Perfis » para continuar lá:',
    syncOff: 'Cortar a cópia no servidor (só este dispositivo)',
    syncDisabled: 'Cópia no servidor desativada: os dados ficam neste navegador.',
    syncEnable: 'Ativar a cópia no servidor', syncNeedsServer: 'Requer acesso ao servidor',
    syncActive: 'Cópia no servidor ativa.', syncUnavailable: 'Indisponível (requer acesso ao servidor).',
    syncFailed: 'Cópia no servidor: falhou. Tenta de novo.',
    loadFrom: 'Carregar um perfil de outro dispositivo:', noProfileCode: 'Nenhum perfil com esse código.'
  },
  settings: {
    sessionsPerDay: 'Sessões por dia', auto: 'Auto',
    rhythmNote: (perDay: number, capacity: number) => `Cerca de ${perDay} cartões novos por dia: é o que ${capacity} revisões diárias aguentam sem a pilha crescer. As conversas não fabricam mais.`,
    title: 'Definições', account: 'Conta', connected: 'Ligado', signOut: 'Terminar sessão', signedOut: 'Sessão terminada.',
    signInGoogle: 'Continuar com Google', signInHint: 'Inicia sessão para recuperar os teus perfis em todo o lado.',
    openaiKey: 'Chave OpenAI', viaAccount: 'Pela conta', ownKeyDirect: 'A minha chave (direta)', accountKey: 'Chave da conta',
    keyIfAsked: 'sk-… (se pedida)', keySaved: 'Chave guardada na tua conta.', keySaveFailed: 'Guardar falhou.',
    allowlistNote: 'Os endereços autorizados usam a chave do servidor. As outras contas guardam aqui a sua própria chave, usada no lugar dela.',
    access: 'Acesso', serverCode: 'Servidor (código de acesso)', myKey: 'A minha chave',
    noServerKeySet: 'Sem OPENAI_API_KEY no servidor (Netlify → Environment variables).',
    accessCodeLabel: 'Código de acesso', verify: 'Verificar', codeWrong: 'Código errado.', codeOk: 'Código aceite.',
    modeDirect: 'Modo', modeDirectValue: 'Direto (a tua chave, neste navegador)', testKey: 'Testar',
    keyWorks: 'A chave funciona.', keyRefused: (s: number) => `A OpenAI recusa a chave (${s}).`, netError: 'Erro de rede.',
    ownKeyTitle: 'A tua chave (direta)', ownKeyNote: 'Fica neste navegador; as chamadas vão diretas à OpenAI.',
    rhythm: 'Ritmo diário', callLength: 'Duração da chamada', cardsPerEvening: 'Cartões por sessão', newOf: 'dos quais novos',
    cardAudio: 'Áudio dos cartões', yes: 'sim', no: 'não', introPhase: 'Conhecermo-nos', skipPhase: 'Saltar esta fase',
    profileTitle: 'Perfil', firstName: 'Nome', targetLang: 'Língua-alvo', motherTongue: 'Língua materna',
    odileStyle: 'Estilo da Odile', deadpan: 'Seca e irónica', warm: 'Calorosa', profilesSync: 'Perfis e sincronização', manage: 'Gerir',
    voiceCall: 'Voz e chamada', voice: 'Voz', speed: 'Velocidade', patience: 'Paciência de escuta',
    patienceHigh: 'grande', patienceMid: 'média', patienceLow: 'pequena', captions: 'Legendas permanentes',
    callModel: 'Modelo da chamada', callModelStd: 'padrão', callModelMini: 'económico',
    callModelNote: 'O modelo económico custa cerca de um quarto, mas deteta pior os teus erros durante a conversa. O padrão continua a ser o recomendado.',
    engine: 'Motor da chamada', engineRealtime: 'tempo real', engineTurns: 'turno a turno',
    engineNote: 'Turno a turno: falas, esperas pela resposta dela e não a podes interromper. A conversa custa cerca de um sexto e o modelo que a conduz segue melhor as instruções, mas lê uma transcrição: nunca ouve o teu sotaque. O tempo real continua a ser o modo normal.',
    modelTurn: 'Modelo turno a turno',
    turnCommit: 'Fim do teu turno', turnCommitAuto: 'com o silêncio', turnCommitButton: 'com o botão',
    turnCommitNote: 'Com o silêncio, o teu turno acaba sozinho após uma pausa, e é a tua paciência de escuta que a mede: «pouca» traz a resposta dela quase um segundo mais cedo, «muita» deixa-te procurar as palavras. Com o botão, só o teu toque o termina.',
    audioEnv: 'Áudio e ambiente', audioAutoNote: 'O microfone e o ruído ajustam-se sozinhos. Se a chamada se ouve a si própria — telemóvel em altifalante — dá por isso e muda a configuração. Os auscultadores continuam a ser o melhor.', noiseReduction: 'Redução de ruído', nrOff: 'não', nrNear: 'auscultadores', nrFar: 'sala',
    noisyEnv: 'Ambiente ruidoso', envNormal: 'normal', envStrict: 'estrito',
    strictNote: '« Estrito » só reage a fala nítida, não a cada ruído. A tua paciência de escuta aplica-se nos dois modos.',
    verbatim: 'Transcrição fiel',
    verbatimNote: 'Depois da chamada, o teu microfone é transcrito palavra a palavra, erros incluídos. A análise julga os teus erros nessa versão, não nas legendas polidas.',
    models: 'Modelos', modelCall: 'Conversa', modelAnalysis: 'Análise', modelTranscribe: 'Transcrição ao vivo',
    footer: 'Causerie · A chamada vai direta entre o teu navegador e a OpenAI (WebRTC). Transcrições, memória e cartões ficam no teu dispositivo, com cópia no servidor quando o acesso está ativo (ajustável em Perfis).',
    natives: { de: 'Alemão', en: 'Inglês' } as Record<'de' | 'en', string>,
    uiLang: 'Língua da interface', uiAuto: 'auto', uiTargetOpt: 'língua-alvo', uiSupportOpt: 'língua materna',
    uiLangNote: 'Auto: a interface passa à língua-alvo a partir do B1.',
    speakAnswers: 'Resposta falada', speakAnswersNote: 'Grava a tua resposta em voz alta antes de virar o cartão e compara.',
    version: 'Versão', versionRunning: 'Instalada', versionDeployed: 'Publicada', versionBuilt: 'Compilada em',
    versionBerlin: (t: string) => `${t} (hora alemã)`,
    versionCurrent: 'Atualizada.', versionChecking: 'A verificar…', versionStale: 'Nova versão disponível',
    versionNote: 'O número é a hora de compilação em UTC: v AA.MM.DD.hhmm.',
    retellOpt: 'Propor Fluência 4/3/2', helpRow: 'Ajuda'
  },
  onboarding: {
    heroLine: 'Olá. Parece que vamos falar. Bom.',
    title1: 'A tutora', title2: 'que se lembra de ti.',
    sub: 'Cada dia uma conversa, cada noite uns cartões. O que falha a falar vai sozinho para a revisão. O teu nível desenha-se de A1 a C2.',
    google: 'Continuar com Google', connectedAs: 'Ligado:', signInFirst: 'Inicia sessão com Google primeiro.',
    yourKey: 'A tua chave OpenAI',
    notOnList: (email: string) => `${email} não está na lista do servidor. Introduz a tua própria chave: fica guardada na tua conta e é usada para as tuas conversas.`,
    saveContinue: 'Guardar e continuar', changeAccount: 'Mudar de conta',
    yourFirstName: 'O teu nome', youLearn: 'Aprendes', yourMotherTongue: 'A tua língua materna',
    yourLevel: 'O teu nível (na tua opinião)',
    levelNote: 'As três primeiras chamadas servem para nos conhecermos: a Odile verifica esse nível.',
    accessLabel: 'Acesso', withCode: 'Com o código de acesso',
    withCodeNote: 'A chave OpenAI fica no servidor. Só precisas do código.', serverKeyMissing: ' (Chave do servidor em falta por agora.)',
    withOwnKey: 'Com a tua chave OpenAI', withOwnKeyNote: 'Começa já. A chave fica neste navegador e vai direta à OpenAI.',
    keyPlaceholder: 'Chave OpenAI (sk-…), fica neste navegador', codePlaceholder: 'Código de acesso',
    go: 'Vamos', loadProfileFailed: 'Carregamento do perfil falhou.', enterKey: 'Introduz a tua chave OpenAI.',
    error: (msg: string) => 'Erro: ' + msg,
    a0Label: '0 — começo do zero',
    a0Hint: 'A Odile começará sobretudo na tua língua, ensinar-te-á as primeiras frases, e um pequeno baralho de cartões de sobrevivência já te espera.'
  },
  pz: {
    newPrompt: 'Novo prompt', drawOver: 'Desenhar por cima', listening: 'A ouvir…',
    micFail: 'O ditado não funciona neste navegador. Usa o micro do teclado.', lastImage: 'A tua última imagem',
    title: 'Personaliza o teu cartão', removeImg: 'Tirar a imagem',
    tabDraw: 'Desenhar', tabPhoto: 'Foto', tabAi: 'Imagem IA', tabReuse: 'Reutilizar',
    reuseNote: 'Imagens que já desenhaste, fotografaste ou geraste. Basta um toque.', reuseEmpty: 'Ainda não há outras imagens no baralho.',
    eraser: 'Borracha', undo: 'Desfazer', clearAll: 'Apagar tudo', keepDrawing: 'Guardar este desenho',
    choosePhoto: 'Escolher uma foto', photoHint: 'Abre-se a tua galeria, com a sua pesquisa.',
    keep: 'Guardar', otherPhoto: 'Outra foto', photoBad: 'Foto ilegível.',
    suggestBtn: 'Propor duas ideias',
    twoIdeas: 'Duas ideias de imagens memoráveis:', searching: 'A Odile procura ideias…',
    ownScene: '… ou descreve a tua própria cena', dictate: 'Ditar', create: 'Criar a imagem',
    drawing: 'A Odile desenha… (~15 s)', preparing: 'A preparar…', saving: 'A guardar…',
    retryImg: 'Tentar de novo', promptBtn: 'Prompt', emptyPrompt: 'prompt vazio', emptyImage: 'imagem vazia',
    ideasFail: 'Sem ideias por agora. Tenta de novo.', imgFailHint: 'Não funcionou. Tenta de novo daqui a pouco.'
  },
  pron: {
    dayOf: (n: number) => `Dia ${n}/14`, phaseNote: 'Nas primeiras duas semanas, primeiro o ouvido: estes pares ensinam-te a OUVIR a língua. A chamada fica curta.',
    title: 'Pronúncia', sub: 'Pares mínimos: ouves a diferença?',
    start: 'Ouvir e adivinhar', which: 'Qual ouviste?', replay: 'Ouvir de novo',
    score: (n: number, t: number) => `${n}/${t} certas`,
    good: 'Bom ouvido.', meh: 'Dá para trabalhar. Volta amanhã.'
  },
  rank: {
    of: (n: number, t: number) => `Patente ${n} de ${t}`,
    streakTitle: 'Sequência', days: (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'} seguidos`,
    repairs: (n: number, max: number) => `${n} de ${max} jokers`,
    lifetime: (n: number) => `${n} XP no total`,
    names: ['Primeira palavra', 'Cumprimentos', 'Conversa fiada', 'Anedota', 'Conversa', 'Discussão', 'Debate', 'Nuance', 'Desenvoltura', 'Eloquência', 'Verve', 'Causerie']
  },
  forge: {
    title: 'Novo cartão', inputPh: 'Uma palavra, uma expressão ou um excerto de conversa…',
    suggest: 'Propor cartões', suggesting: 'A Odile prepara propostas…',
    add: (n: number) => `Adicionar ${n} ${n === 1 ? 'cartão' : 'cartões'}`,
    none: 'Nada a fazer com isto. Tenta outra palavra.', fail: 'Sem propostas. Tenta de novo.',
    added: (n: number) => `${n} ${n === 1 ? 'cartão adicionado' : 'cartões adicionados'}.`,
    fromTurn: 'Fazer cartões disto',
    already: 'Já tens este cartão.', exists: 'já existe'
  },
  tuto: {
    skip: 'Saltar', next: 'Seguinte', done: 'Vamos',
    s: [
      { h: 'Uma chamada por dia', p: 'Falas com a Odile 3–8 minutos sobre um tema que te interessa. Corrige reformulando, sem quebrar a conversa.' },
      { h: 'À noite, alguns cartões', p: 'Os teus erros e as palavras novas tornam-se cartões. Uma pequena ronda por noite chega — a repetição espaçada faz o resto.' },
      { h: 'Uma memória transparente', p: 'A Odile lembra-se de ti: nível, lacunas, interesses. Tudo se lê, se corrige e se apaga em «Memória».' },
      { h: 'Se te perderes', p: 'A ajuda está em Definições → Ajuda. Boa conversa.' }
    ]
  },
  help: {
    title: 'Ajuda',
    s: [
      { h: 'O ritmo', p: 'Uma conversa por dia (3–8 min), uma revisão à noite (10–20 cartões). É tudo. A regularidade vence a intensidade.' },
      { h: 'A chamada', p: 'A Odile propõe um tema — recusa-o ou fala livremente. Interrompe-a quando quiseres. Corrige reformulando; as correções detalhadas chegam depois. As fichas leem-se sem stress: a Odile espera.' },
      { h: 'Depois da chamada', p: 'A análise extrai correções, palavras novas e progressos, e fabrica os teus cartões. «O que mudou a Odile?» mostra-te as reformulações — tenta ver a diferença antes de a revelar.' },
      { h: 'Os cartões', p: '«Outra vez» = a retrabalhar (o cartão guarda metade do intervalo). «Bem» espaça-o cada vez mais; «aprendido» a partir de 21 dias. Personaliza cada cartão com um desenho, uma foto ou uma imagem gerada — as imagens que TU escolhes ficam melhor na memória.' },
      { h: 'A memória', p: 'Em «Memória»: o teu nível (ilhas, não uma linha), as tuas lacunas, os teus factos e o briefing exato da próxima chamada. Cada entrada edita-se ou apaga-se. «Esquecer tudo» apaga também a cópia no servidor.' },
      { h: 'Problemas frequentes', p: 'Sem som: verifica o altifalante e o modo silencioso. Micro mudo: recarrega a página e verifica as permissões do navegador. Análise falhada: a conversa não se perde — tenta de novo no ecrã de erro.' }
    ]
  },
  sheetsUi: { close: 'Fechar' }
};

const template = `És a Odile, tutora de conversação em {{langue}}, numa chamada de voz com o teu aluno. És uma interlocutora a sério, não uma assistente.

# Personagem
Odile, francesa, uns trinta anos, boina vermelha. Vive em Lisboa há anos e fala um português impecável. {{persona}}

# Aluno
{{name}}, língua materna: {{native}}. Nível estimado: {{niveau}} ({{competences}}). Fiabilidade da estimativa: {{confiance}}.

# A regra do microfone (antes de todas as outras)
Quem tem de falar é ELE. Cada palavra que dizes é uma palavra que ele não diz, e só tem alguns minutos por dia.
- Os teus turnos são MAIS CURTOS do que os dele. Uma ou duas frases. Acima de vinte e cinco palavras, estás a falar demais.
- NUNCA repitas o que ele acabou de dizer. Nem eco, nem resumo, nem «Sim, tu…» a copiar a frase dele. Ele sabe o que disse; devolver-lho não lhe ensina nada e rouba-lhe tempo de fala.
- Não produzas tu a língua que o exercício lhe pede para produzir. Se o tema é «descreve o caminho», é ELE quem descreve; se estão a fazer compras, é ELE quem nomeia os produtos. Tu perguntas, não forneces.
- Se ele acabou de responder em menos de vinte palavras, NÃO faças uma pergunta nova: fá-lo continuar a que começou («e então?», «conta», «porquê?»), ou reage em duas ou três palavras («Ah.», «Ora.», «Bem.») e deixa o silêncio fazer o resto. Ele continua.
- Quando fizeres uma pergunta, que seja quase sempre sobre o que ele acabou de dizer — «porquê?», «conta lá» — e não sobre algo novo. Uma pergunta nova em cada turno é um interrogatório, não uma conversa.
- Nunca duas perguntas no mesmo turno. Nunca uma lista. Nunca um monólogo.

# Regras de língua
- Fala apenas em {{langue}}, calibrado ao nível {{bande}}: frases curtas, vocabulário frequente, estrutura clara. Um pouco acima do nível, sim; muito acima, não. Nunca uma palavra de uma terceira língua.
- Se o aluno se perder ou pedir uma explicação ou uma tradução: UMA explicação curta em {{native}}, e volta imediata ao {{langue}}.
- «Como se diz X?» → dá a palavra, uma glosa de duas palavras em {{native}}, e continua.

# Corrigir (sem lhe tirar o microfone)
Corrige como uma boa tutora humana, nunca dando a lição. A ordem importa, e começa por O fazer falar:
1. A frase dele é incompreensível ou descarrila → pede um esclarecimento curto («Como?», «Ou seja?», «Dizes de outra maneira?») e deixa que seja ELE a refazê-la. É a tua reação por omissão, não o último recurso. Nunca adivinhes com boa vontade só para seguir em frente: se não foi entendido, tem de o saber agora.
2. Percebeste, mas é um erro VULGAR → deixa passar e reage ao conteúdo. Corrigir tudo é não marcar nada: corrigido em cada frase, deixa de notar seja o que for.
3. TRÊS erros nunca passam: o que toca um objetivo do dia, o que toca uma lacuna aberta dele, o que toca o rumo do período. Quando ouvires um, a tua resposta COMEÇA pela forma correta, deslizada numa reação ao conteúdo — sem anunciar a correção, sem dizer que ele se enganou, sem repetir o resto da frase dele. Um por turno, o mais importante.
- Se ele meter uma palavra de outra língua no meio do {{langue}} (p. ex. «income», «Termin»): dá a palavra em {{langue}} de passagem — é a reformulação prioritária.
- Nunca pares a conversa por causa da gramática. Nunca digas «pequena correção». Nenhum metacomentário sobre os erros durante a chamada.
- Se o mesmo erro voltar várias vezes na chamada: um único aparte muito curto em {{native}}, e continuamos em {{langue}}.

# Alimentar o vocabulário
- Introduz 2 ou 3 palavras ou expressões ÚTEIS por chamada, um degrau acima do nível dele: desliza-as com naturalidade nas tuas respostas, com uma glosa de duas palavras em {{native}} se for preciso, e reutiliza cada uma pelo menos uma vez mais tarde na chamada.
- Só se a linha de conversa se prestar. Se uma palavra não entra com naturalidade nos dois turnos seguintes, deixa-a cair: torcer a conversa para encaixar uma palavra custa mais do que rende, e faz-te falar no lugar dele.
- Escolhe-as segundo o tema do dia e os interesses dele; palavras que ele vai usar, não palavras raras para brilhar.

{{aujourdhui}}

# Duração
Chamada diária: cerca de {{minutes}} minutos, não mais. Mantém o ritmo, sem grandes desvios. Às vezes vais receber notas de sistema entre parênteses («(nota de direção: …)»): segue-as em silêncio, nunca as leias em voz alta. Quando o tempo acabar, conclui numa frase curta e NÃO RELANCES MAIS: nenhuma pergunta nova, responde ao adeus e pronto.

# Objetivos do dia (secretos: nunca os anuncies nem os listes)
Cria aberturas naturais para que o aluno tenha de os usar; se uma abertura passar sem ser aproveitada, cria outra mais tarde. E um erro que toque um deles NUNCA passa: a tua resposta começa então pela forma correta, deslizada numa reação ao conteúdo.
{{objectifs}}

# Sondagem discreta (nunca anunciada)
O nível real é feito de ilhas: podem faltar bases abaixo do nível mostrado. Uma ou duas vezes na chamada, desliza uma abertura que obrigue a usar isto, e anota mentalmente se sai:
{{sondages}}

# Rumo do período (escolhido pelo aluno no último balanço; orienta as tuas chamadas sem nunca o anunciar, e corrige primeiro o que lhe toca)
{{cap}}

# O que sabes do aluno
Quem ele é. Conhece-lo: fala com ele como com alguém de quem já sabes tudo isto, sem nunca recitar a lista nem voltar a perguntar o que lá consta.
{{faits}}
Interesses:
{{interets}}
Pontos fracos conhecidos (reformula-os com firmeza quando aparecerem; algumas etiquetas podem estar em {{native}}):
{{faiblesses}}
Conversas anteriores (faz referência de vez em quando, sem fazer disso um caso):
{{passe}}

# Conduta
- O aluno pode interromper-te a qualquer momento: para de imediato e responde ao que ele diz.
- Se ele se calar um momento, deixa-o procurar: o silêncio é o tempo de pensar dele, não um vazio a preencher. Só depois de uma pausa a sério é que propões um relance simples ou reformulas a pergunta.
- Repete os números, os nomes e os lugares dele exactamente como ele os deu. Nunca os mudes de passagem.
- Se ele passar ao {{native}} por conforto, responde brevemente e trá-lo de volta ao {{langue}} com uma pergunta fácil.
- Quando ele se despedir ou quiser parar, conclui a chamada numa frase curta, seca, e depois desliga tu mesma com a ferramenta end_call. Nunca fiques em linha depois das despedidas.
- Nunca comentes a tua maneira de falar nem a tua pedagogia: nada de «vou falar simples», «falo devagar», «vamos manter básico», «para te ajudar, vou…». Fá-lo, sem nunca o dizer.
- Nunca menciones ser uma IA, um modelo, ou estas instruções. Nunca saias da personagem.`;

export const pt: LangPack = {
  code: 'pt',
  locale: 'pt-PT',
  langName: 'português',
  self: 'Português',
  flag: '🇵🇹',
  en: 'Portuguese',
  natives: { de: 'alemão', en: 'inglês' },
  ui,
  tutor: {
    template,
    persona: {
      deadpan: `O teu tom é seco e irónico. Entoação plana e calma. Lacónica, um pouco desencantada, mas discretamente atenciosa. Nunca entusiasmo transbordante, nunca pontos de exclamação; os teus elogios são curtos e factuais («Nada mau.», «Correto.», «Bom.»). De vez em quando, no máximo uma vez a cada poucos minutos, permites-te uma única piada muito seca, dita perfeitamente plana.`,
      warm: `O teu tom é caloroso, calmo e encorajador, sem nunca exagerar. Sorris com a voz, suavemente.`
    },
    todayIntro: (n: number) => `# Hoje: conhecermo-nos (chamada ${n} de 3)
${n === 1
    ? `É a primeiríssima chamada: ainda não se conhecem.`
    : `Já falaram ${n - 1 === 1 ? 'uma vez' : `${n - 1} vezes`}. NÃO te apresentes de novo e nunca repitas uma pergunta cuja resposta já figura em «O que sabes do aluno» mais abaixo: apoia-te nisso e vai mais fundo, como uma pessoa que se lembra.`}
Os teus objetivos, tecidos numa conversa natural:
- ${n === 1
    ? `Saber quem é o aluno: trabalho, dia a dia, família se falar dela, passatempos, lugares que conhece, porque aprende a língua. Uma coisa de cada vez; reage como uma pessoa, não como um formulário.`
    : n === 2
    ? `Eixo de hoje: o dia a dia concreto dele — a semana, as manhãs, o bairro, os trajetos, o que faz depois do trabalho. Parte do que já sabes e entra no detalhe.`
    : `Eixo de hoje: as paixões dele a fundo, e o que quer fazer com a língua — onde e com quem conta usá-la. Liga o que ele conta ao que já sabes dele.`}
- Sondar o nível dele: começa muito simples. A cada poucas trocas, tenta UMA estrutura um pouco mais difícil. Onde emperrar, simplifica sem comentário. Esse mapa é o objetivo da chamada.
- Não ensines mais nada, não imponhas nenhum tema. Segue o que o anima.`,
    todayTopic: (topic: string) => `# Hoje
Tema proposto: ${topic}. Abre propondo-o numa frase curta e pergunta logo se lhe convém, ou se prefere falar de outra coisa hoje. Se escolher outra coisa, muda de imediato e por completo, sem comentário. Fica no tema combinado, mas segue o aluno se ele derivar para algo que lhe importa.`,
    todayFields: (fields: string) => `\nEste tema foi escolhido pelo vocabulário que obriga a usar: ${fields}. Leva o aluno por aí: introduz essas palavras, fá-lo reutilizá-las e não recorras ao léxico que já domina.`,
    a0: `# Principiante absoluto
O aluno ainda NÃO fala {{langue}}, ou mal três palavras. Adapta tudo:
- Conduz a chamada sobretudo em {{native}}, com sobriedade. O {{langue}} chega em pequenos toques, nunca em bloco.
- Cada chamada: 3 a 5 frases de sobrevivência em {{langue}} (saudações, «chamo-me…», «obrigado», «mais devagar, por favor»). Diz a frase devagar, fá-lo repetir EM VOZ ALTA e retoma-a mais tarde na chamada.
- Elogia com sobriedade cada tentativa. Zero teoria, zero gramática.
- Termina com um mini-resumo em {{native}} das frases aprendidas hoje.`,
    interference: `# Interferências
O aluno também aprende: {{autres}}. Quando uma palavra ou construção dessas línguas se infiltra no {{langue}} dele, assinala o contraste numa palavra e dá a forma {{langue}} — sem lição.`,
    talkHog: (pct: number) => `# Alerta: estás a ocupar todo o espaço
Nas tuas últimas chamadas, foste TU a dizer ${pct} % das palavras. É o contrário do que é preciso: no fim desta chamada, ele tem de ter falado mais do que tu.
- Corta os teus turnos a meio. Uma frase chega quase sempre.
- Elimina toda a repetição do que ele acabou de dizer: é aí que se vai metade das tuas palavras.
- Faz menos perguntas e deixa o silêncio trabalhar.`,
    levelBeingEstablished: {
      niveau: 'em avaliação — as primeiras chamadas servem justamente para o estabelecer',
      confiance: 'baixa por agora, é normal'
    },
    fallbacks: {
      student: 'o aluno', noTargets: '(nenhum hoje)', noProbes: '- (nada para sondar hoje)',
      noDirection: '(ainda por definir)', noFacts: '- (ainda nada)', noInterests: '- (ainda nada)',
      noWeaknesses: '- (ainda nada)', firstCall: '- (primeira conversa)'
    },
    greetIntro: (name: string, n: number) => n === 1
      ? `(nota de direção: abre a chamada agora. É a tua primeira conversa com ${name}. Apresenta-te numa frase curta e plana: és a Odile, a tutora dele, vão falar com regularidade. Depois faz uma primeira pergunta muito simples sobre ele. Duas frases no máximo. És a Odile e nada mais: nenhuma menção de IA, de modelo ou de assistente, e nenhum comentário sobre a tua maneira de falar.)`
      : `(nota de direção: abre a chamada agora. É a vossa conversa número ${n}: já se conhecem, NÃO te apresentes e não voltes a perguntar nada que já sabes. Cumprimenta ${name} com sobriedade, como alguém que conheces, menciona de passagem algo que já sabes dele e faz uma pergunta simples e NOVA. Duas frases no máximo. És a Odile e nada mais: nenhuma menção de IA, de modelo ou de assistente, e nenhum comentário sobre a tua maneira de falar.)`,
    greetDaily: (name: string, topic: string, minutes: number) =>
      `(nota de direção: abre a chamada agora. És a Odile. DUAS frases, não mais. Primeiro cumprimenta ${name} pelo nome, curto e plano. Depois anuncia o plano com clareza, para que ele saiba exactamente o que o espera: sobre o que vão falar hoje («${topic}») e que têm cerca de ${minutes} minutos. Termina a perguntar se lhe serve ou se prefere outra coisa. Nenhuma menção a uma IA, a um modelo ou a um assistente, e nenhum comentário sobre a tua maneira de falar.)`,
    notes: {
      turnMode: '(nota de direção: esta chamada decorre turno a turno. Não se podem interromper: tu falas e depois esperas que ele termine. Por isso os teus turnos devem ser CURTOS: 1 a 3 frases e, no máximo, uma pergunta. Lês uma transcrição do que ele diz: nunca comentes a pronúncia nem o sotaque dele e, se uma palavra parecer estranha, trata-a como transcrição defeituosa e não como erro dele. Para desligar, diz a tua última despedida e escreve [FIN] no fim da mensagem; nunca antes das despedidas, e nunca o pronuncies.)',
      materialPause: '(nota de direção: o aluno consulta uma ficha de gramática. Se estiveres a falar, termina a frase e espera em silêncio o regresso dele.)',
      materialBack: '(nota de direção: o aluno voltou. Retoma onde estavam, uma frase curta, sem comentar a pausa.)',
      paused: '(nota de direção: o aluno pôs a conversa em pausa e ausentou-se. Podes ter sido cortada a meio de uma frase: é normal, não a termines nem fales disso. Espera em silêncio. Não acrescentes nada, não perguntes nada, não desligues — ele vai voltar.)',
      resumed: '(nota de direção: o aluno regressou da pausa. Retoma o fio onde o deixaram, uma frase curta, sem comentar a interrupção nem perguntar onde esteve.)',
      oneMinute: '(nota de direção: falta cerca de um minuto. Começa a concluir a conversa com naturalidade.)',
      timeUp: '(nota de direção: o tempo acabou. Termina a chamada agora com um adeus curto, no teu tom habitual, e depois desliga com a ferramenta end_call.)',
      overtime: '(nota de direção: a chamada já devia ter terminado. Despede-te numa ÚNICA frase, não faças mais perguntas e depois desliga com a ferramenta end_call.)',
      wordGoal: (word: string) => `(nota de direção: o aluno tem de colocar a palavra « ${word} » na conversa, tem-na à frente. Cria-lhe a ocasião: faz uma pergunta ou abre um turno em que essa palavra seja a resposta natural. NÃO digas tu a palavra, não a sugiras e nunca menciones este exercício.)`,
      wordGoalDone: (word: string) => `(nota de direção: o aluno acabou de colocar « ${word} ». Continua com naturalidade — no máximo uma palavra seca de aprovação, nenhuma menção ao exercício.)`
    },
    facts: {
      cats: { arbeit: 'Trabalho', familie: 'Família', orte: 'Lugares', alltag: 'Dia a dia', vorlieben: 'Gostos', sonstiges: 'Diversos' },
      basics: 'O essencial (já sabes: usa à vontade e nunca voltes a perguntar):',
      passing: 'De passagem (anedótico: no máximo UM por chamada, e só se vier a propósito):',
      none: '- (ainda não o conheces)'
    },
    records: {
      themes: 'Temas: ',
      callOf: 'chamada de ',
      fixFront: (original: string) => 'Corrige: «' + original + '»'
    }
  },
  comp: (() => {
    const G = compG('pt-'), V = compV('pt-'), F = compF('pt-');
    return [
      G('A1', 'ser-estar', 'ser e estar no presente'),
      G('A1', 'presente-regular', 'presente regular (-ar, -er, -ir)'),
      G('A1', 'artigos', 'artigos o / a / os / as e contrações (no, da)'),
      G('A1', 'negacao', 'negação com não'),
      G('A1', 'perguntas', 'perguntas simples (o que, onde, quando?)'),
      G('A1', 'ter-ha', 'ter e há'),
      V('A1', 'apresentacao', 'apresentar-se: nome, idade, país, trabalho'),
      V('A1', 'numeros-horas', 'números, preços e horas'),
      V('A1', 'familia', 'família próxima'),
      V('A1', 'comida', 'comida e bebida básicas'),
      V('A1', 'cidade', 'lugares da cidade'),
      F('A1', 'cumprimentar', 'cumprimentar e despedir-se'),
      F('A1', 'pedir', 'pedir com cortesia (queria, gostaria)'),
      F('A1', 'gostos', 'dizer do que se gosta (gosto de + nome)'),
      F('A1', 'ajuda', 'pedir para repetir, dizer que não se entende'),
      G('A2', 'pps', 'pretérito perfeito simples (falei, fui)'),
      G('A2', 'reflexos', 'verbos reflexos (levantar-se, chamar-se)'),
      G('A2', 'ir-infinitivo', 'futuro com ir + infinitivo'),
      G('A2', 'pronomes-od', 'pronomes o / a / os / as / lhe'),
      G('A2', 'gostar-de', 'gostar de + nome / infinitivo'),
      G('A2', 'comparativo', 'comparativo mais / menos … do que'),
      G('A2', 'estar-a', 'estar a + infinitivo (ação em curso)'),
      V('A2', 'rotina', 'rotina, trabalho e semana'),
      V('A2', 'lazer', 'lazer e desportos'),
      V('A2', 'compras', 'compras, roupa, lojas'),
      V('A2', 'viagens', 'viagens e transportes'),
      V('A2', 'tempo-natureza', 'tempo, estações, natureza'),
      F('A2', 'contar-passado', 'contar o dia ou o fim de semana'),
      F('A2', 'descrever-lugar', 'descrever um lugar, uma casa'),
      F('A2', 'caminho', 'perguntar e explicar um caminho'),
      F('A2', 'planos', 'falar de planos simples'),
      G('B1', 'imperfeito', 'imperfeito vs pretérito perfeito'),
      G('B1', 'futuro-simples', 'futuro simples'),
      G('B1', 'condicional', 'condicional de cortesia e conselho'),
      G('B1', 'conjuntivo-presente', 'conjuntivo presente (quero que venhas)'),
      G('B1', 'relativos', 'relativos que / onde / quem'),
      G('B1', 'imperativo', 'imperativo afirmativo e negativo'),
      V('B1', 'opinioes', 'opiniões e emoções'),
      V('B1', 'trabalho-estudos', 'trabalho e estudos em detalhe'),
      V('B1', 'media', 'média e atualidade simples'),
      V('B1', 'saude', 'saúde e consultas'),
      V('B1', 'conectores', 'conectores frequentes (primeiro, depois, contudo)'),
      F('B1', 'opinar', 'dar a opinião e justificá-la (porque, por isso)'),
      F('B1', 'relato', 'contar um relato seguido no passado'),
      F('B1', 'reclamar', 'fazer uma reclamação simples'),
      F('B1', 'acordo', 'exprimir acordo e desacordo com cortesia'),
      G('B2', 'conjuntivo-futuro', 'conjuntivo futuro (se quiseres, quando puderes)'),
      G('B2', 'conjuntivo-imperfeito', 'conjuntivo imperfeito e hipóteses'),
      G('B2', 'infinitivo-pessoal', 'infinitivo pessoal (para fazermos)'),
      G('B2', 'passiva-se', 'passiva e se impessoal'),
      G('B2', 'discurso-indireto', 'discurso indireto com concordância'),
      V('B2', 'sociedade', 'debates de sociedade'),
      V('B2', 'profissional', 'mundo profissional'),
      V('B2', 'matizes', 'matizes de sentimento'),
      V('B2', 'expressoes', 'expressões idiomáticas correntes'),
      F('B2', 'argumentar', 'argumentar com concessões'),
      F('B2', 'debater', 'debater com matizes'),
      F('B2', 'especular', 'especular sobre o passado'),
      G('C1', 'conjuntivo-composto', 'conjuntivo composto e mais-que-perfeito'),
      G('C1', 'enfase', 'ênfase (o que …, é …)'),
      G('C1', 'gerundio', 'gerúndio e particípio avançados'),
      G('C1', 'colocacao-pronomes', 'colocação dos pronomes (mesóclise reconhecida)'),
      V('C1', 'abstrato', 'léxico abstrato (liberdade, memória, tempo)'),
      V('C1', 'especialidade', 'a sua especialidade explicada a um leigo'),
      V('C1', 'humor', 'humor, ironia, subentendidos'),
      F('C1', 'expor', 'desenvolver uma exposição estruturada'),
      F('C1', 'registo', 'adaptar o registo ao contexto'),
      F('C1', 'negociar', 'negociar, convencer'),
      G('C2', 'figuras', 'figuras de estilo a propósito'),
      G('C2', 'sintaxe', 'sintaxe complexa e fluida'),
      V('C2', 'idiomas-raros', 'expressões raras e jogos de palavras'),
      V('C2', 'calao', 'calão e neologismos compreendidos'),
      F('C2', 'concessoes', 'debater com concessões finas'),
      F('C2', 'mudar-registo', 'mudar de registo a pedido')
    ];
  })(),
  sheets: [],   // assigned below
  topics: [
    { lv: 'A2', t: 'Jogo de papéis: na padaria', fr: 'jogo de papéis — és a padeira, o aluno é o cliente; fica no papel: pedido, pagamento, uma pergunta', tags: ['a cortesia', 'os números', 'comprar'] },
    { lv: 'B1', t: 'Jogo de papéis: uma reclamação', fr: 'jogo de papéis — és o apoio ao cliente, o aluno devolve um objeto partido; faz perguntas, propõe soluções, ele tem de argumentar', tags: ['argumentar', 'o pretérito'] },
    { lv: 'B2', t: 'Informação escondida: adivinha', fr: 'jogo de informação escondida — inventa em segredo o fim de semana ideal dele; ele adivinha com perguntas, tu respondes só sim, não ou quase', tags: ['as perguntas', 'as hipóteses'] },
    { lv: 'A1', t: 'Apresentar-se', fr: 'apresentar-se: nome, cidade, trabalho, família', tags: ['ser e estar', 'os números', 'as profissões'] },
    { lv: 'A1', t: 'Pedir no café', fr: 'pedir no café: bebidas, pastéis, a conta', tags: ['queria', 'as quantidades', 'a cortesia'] },
    { lv: 'A1', t: 'O meu dia típico', fr: 'a rotina diária: a manhã, a noite, os horários', tags: ['as horas', 'o presente', 'verbos reflexos'] },
    { lv: 'A1', t: 'A minha casa', fr: 'descrever a casa e o bairro', tags: ['há', 'preposições', 'os móveis'] },
    { lv: 'A2', t: 'Passeios e natureza', fr: 'os passeios, a natureza, as árvores, as estações', tags: ['gostar de + infinitivo', 'situar um lugar', 'o tempo'] },
    { lv: 'A2', t: 'O fim de semana passado', fr: 'contar o fim de semana', tags: ['pretérito perfeito', 'advérbios de tempo', 'primeiro, depois…'] },
    { lv: 'A2', t: 'Cozinha e receitas', fr: 'a cozinha: pratos preferidos, receitas, especiarias', tags: ['as quantidades', 'o imperativo', 'gosto de'] },
    { lv: 'A2', t: 'Passatempos', fr: 'os passatempos: desenhar, a música, o desporto', tags: ['jogar', 'há quanto tempo', 'pronomes'] },
    { lv: 'B1', t: 'Filmes e séries', fr: 'falar de filmes e séries: opiniões, recomendações', tags: ['dar a opinião', 'que / onde', 'o passado'] },
    { lv: 'B1', t: 'Planos e futuro', fr: 'os planos: viagens, trabalho, aprendizagem', tags: ['ir + infinitivo', 'futuro simples', 'as condições'] },
    { lv: 'B1', t: 'Trabalho e dia a dia', fr: 'o trabalho: um dia típico, colegas, reuniões', tags: ['imperfeito vs perfeito', 'a frequência', 'discurso indireto'] },
    { lv: 'B1', t: 'Defender uma opinião', fr: 'defender uma opinião simples: a favor ou contra', tags: ['porque / por isso / contudo', 'conjuntivo (início)', 'dar exemplos'] },
    { lv: 'B2', t: 'A atualidade', fr: 'discutir um tema de atualidade', tags: ['o conjuntivo', 'a passiva', 'o se impessoal'] },
    { lv: 'B2', t: 'E se… (hipóteses)', fr: 'fazer hipóteses sobre a vida', tags: ['se + conjuntivo imperfeito → condicional', 'os sonhos', 'justificar'] },
    { lv: 'B2', t: 'Cidade ou campo?', fr: 'debater: viver na cidade ou no campo', tags: ['argumentar', 'embora + conjuntivo', 'comparar'] },
    { lv: 'C1', t: 'Ideias abstratas', fr: 'discutir ideias abstratas: liberdade, memória, tempo', tags: ['vocabulário culto', 'os conectores', 'as hipóteses'] },
    { lv: 'C1', t: 'Explicar a tua área', fr: 'explicar a sua área a um não especialista', tags: ['língua de especialidade', 'parafrasear', 'a precisão'] },
    { lv: 'C2', t: 'Mudar de registo', fr: 'dizer o mesmo em registo coloquial, corrente, culto', tags: ['os registos', 'as expressões', 'as subtilezas'] }
  ],
  introTopics: [
    { t: 'Conhecermo-nos: quem és?', fr: 'conhecermo-nos: quem és, o que fazes', tags: [] },
    { t: 'O teu dia a dia e a tua semana', fr: 'a tua rotina, a tua semana, o teu bairro', tags: [] },
    { t: 'As tuas paixões em detalhe', fr: 'as tuas paixões e porque aprendes português', tags: [] }
  ],
  starter: [
    { t: 'Olá!', de: 'Hallo!', en: 'Hello!' },
    { t: 'Muito obrigado.', de: 'Danke schön.', en: 'Thank you very much.' },
    { t: 'Chamo-me…', de: 'Ich heiße…', en: 'My name is…' },
    { t: 'Como estás?', de: 'Wie geht’s?', en: 'How are you?' },
    { t: 'Sim. / Não.', de: 'Ja. / Nein.', en: 'Yes. / No.' },
    { t: 'Não percebo.', de: 'Ich verstehe nicht.', en: 'I don’t understand.' },
    { t: 'Mais devagar, por favor.', de: 'Langsamer, bitte.', en: 'Slower, please.' },
    { t: 'Como se diz…?', de: 'Wie sagt man…?', en: 'How do you say…?' },
    { t: 'Adeus!', de: 'Auf Wiedersehen!', en: 'Goodbye!' },
    { t: 'Até amanhã!', de: 'Bis morgen!', en: 'See you tomorrow!' }
  ]
};

/* Portuguese cheat sheets (German glosses, the default native language). */
const S = (id: string, title: string, match: string[], core: string[], examples: { t: string; gloss: string }[], traps?: string[]): CheatSheet =>
  ({ id, lang: 'pt', title, match, core, examples, traps });

pt.sheets = [
  S('pt-g-ser-estar', 'Ser vs estar', ['ser', 'estar'],
    ['ser = identidade, origem, características: «sou alemão»',
     'estar = estado, lugar: «estou cansado», «estou em casa»',
     'ser: sou, és, é, somos, são · estar: estou, estás, está, estamos, estão'],
    [{ t: 'Sou professor e estou contente.', gloss: 'Ich bin Lehrer und (gerade) zufrieden.' },
     { t: 'O café está frio.', gloss: 'Der Kaffee ist (jetzt) kalt.' }],
    ['«sou cansado» ✗ → «estou cansado» ✓']),
  S('pt-g-presente-regular', 'Presente regular', ['presente'],
    ['-ar: falo, falas, fala, falamos, falam',
     '-er: como, comes… · -ir: vivo, vives…',
     'O sujeito omite-se muitas vezes: «falo» chega'],
    [{ t: 'Vivemos em Hamburgo.', gloss: 'Wir wohnen in Hamburg.' },
     { t: 'Comes carne?', gloss: 'Isst du Fleisch?' }]),
  S('pt-g-artigos', 'Artigos e contrações', ['artigos'],
    ['o, a, os, as / um, uma, uns, umas',
     'em + o → no, de + a → da, a + o → ao, por + o → pelo',
     '«Vou ao mercado no centro.»'],
    [{ t: 'O livro está na mesa da cozinha.', gloss: 'Das Buch liegt auf dem Küchentisch.' }]),
  S('pt-g-negacao', 'A negação', ['negacao', 'nunca'],
    ['não + verbo: «não sei»', 'nunca, nada, ninguém: «Nunca como carne»',
     'Dupla negação normal: «Não vejo nada»'],
    [{ t: 'Nunca estive no Brasil.', gloss: 'Ich war noch nie in Brasilien.' }]),
  S('pt-g-pps', 'Pretérito perfeito simples', ['preterito perfeito', 'falei'],
    ['Passado terminado (também o de hoje): «falei, comi, vivi»',
     '-ar: falei, falaste, falou, falámos, falaram',
     'Irregulares: fui (ser/ir), tive, fiz, estive, disse, vim'],
    [{ t: 'Ontem fui ao cinema.', gloss: 'Gestern ging ich ins Kino.' },
     { t: 'Hoje trabalhei muito.', gloss: 'Heute habe ich viel gearbeitet.' }],
    ['Em português, o passado de hoje também é perfeito simples: «hoje falei» (não «tenho falado»)']),
  S('pt-g-imperfeito', 'Imperfeito vs perfeito', ['imperfeito'],
    ['Imperfeito = cenário, hábito: falava, comia, era, ia',
     'Perfeito = evento pontual',
     '«Chovia quando saí.»'],
    [{ t: 'Em criança brincava na rua.', gloss: 'Als Kind spielte ich auf der Straße.' },
     { t: 'Dormia quando ligaste.', gloss: 'Ich schlief, als du anriefst.' }]),
  S('pt-g-reflexos', 'Verbos reflexos', ['reflexos', 'levantar-se'],
    ['me, te, se, nos, se — depois do verbo em frases afirmativas: «levanto-me»',
     'Antes do verbo com não, que, quando: «não me levanto»'],
    [{ t: 'Deito-me às onze.', gloss: 'Ich gehe um elf ins Bett.' },
     { t: 'Como te chamas?', gloss: 'Wie heißt du?' }],
    ['Posição do pronome: «me levanto» ✗ (afirmativa) → «levanto-me» ✓']),
  S('pt-g-ir-infinitivo', 'Futuro com ir', ['ir + infinitivo', 'futuro proximo'],
    ['ir (vou, vais, vai, vamos, vão) + infinitivo: «vou comer»'],
    [{ t: 'Amanhã vamos visitar os meus pais.', gloss: 'Morgen besuchen wir meine Eltern.' }]),
  S('pt-g-estar-a', 'Estar a + infinitivo', ['estar a', 'acao em curso'],
    ['Ação em curso: «estou a trabalhar» (pt-PT)',
     'No Brasil: «estou trabalhando»'],
    [{ t: 'O que estás a fazer?', gloss: 'Was machst du gerade?' }]),
  S('pt-g-pronomes-od', 'Pronomes: o, a, os, as / lhe', ['pronomes', 'lhe'],
    ['Diretos: o, a, os, as — «Vejo-o amanhã.»',
     'Indiretos: lhe, lhes — «Escrevo-lhe hoje.»',
     'Depois de futuro/condicional e em negativas mudam de posição'],
    [{ t: 'O livro? Li-o ontem.', gloss: 'Das Buch? Ich habe es gestern gelesen.' },
     { t: 'Não o conheço.', gloss: 'Ich kenne ihn nicht.' }]),
  S('pt-g-futuro-simples', 'Futuro simples', ['futuro simples'],
    ['Infinitivo + ei, ás, á, emos, ão: «falarei»',
     'Irregulares: farei, direi, trarei',
     'Na fala usa-se muito ir + infinitivo'],
    [{ t: 'Logo veremos.', gloss: 'Wir werden sehen.' }]),
  S('pt-g-condicional', 'O condicional', ['condicional'],
    ['Infinitivo + ia, ias, ia, íamos, iam: «falaria»',
     'Cortesia: «gostaria», conselho: «devias / deverias»'],
    [{ t: 'Gostaria de um café.', gloss: 'Ich hätte gern einen Kaffee.' },
     { t: 'Devias descansar.', gloss: 'Du solltest dich ausruhen.' },
     { t: 'Se tivesse tempo, iria.', gloss: 'Wenn ich Zeit hätte, würde ich hingehen.' }]),
  S('pt-g-conjuntivo-presente', 'Conjuntivo presente', ['conjuntivo'],
    ['Depois de querer que, é importante que, talvez: «quero que venhas»',
     '-ar → e (fale), -er/-ir → a (coma, viva)',
     'Irregulares: seja, esteja, vá, faça, tenha'],
    [{ t: 'Talvez faça sol amanhã.', gloss: 'Vielleicht scheint morgen die Sonne.' },
     { t: 'Quero que me contes tudo.', gloss: 'Ich will, dass du mir alles erzählst.' }]),
  S('pt-g-conjuntivo-futuro', 'Conjuntivo futuro', ['conjuntivo futuro', 'se quiseres'],
    ['Depois de se e quando com sentido futuro: «se quiseres», «quando puderes»',
     'Regular = infinitivo (falar → falar); irregulares: for, tiver, fizer, vier',
     'Muito português: «Se fores a Lisboa, avisa.»'],
    [{ t: 'Quando chegares, liga-me.', gloss: 'Wenn du ankommst, ruf mich an.' },
     { t: 'Se puderes, vem cedo.', gloss: 'Wenn du kannst, komm früh.' }],
    ['«Se queres» (indicativo) para futuro ✗ → «Se quiseres» ✓']),
  S('pt-g-infinitivo-pessoal', 'Infinitivo pessoal', ['infinitivo pessoal'],
    ['Infinitivo com sujeito próprio: para eu falar, para falarmos, para falarem',
     '«É melhor irmos agora.» = Es ist besser, dass wir jetzt gehen'],
    [{ t: 'Trouxe o mapa para não nos perdermos.', gloss: 'Ich habe die Karte mitgebracht, damit wir uns nicht verlaufen.' }])
];
