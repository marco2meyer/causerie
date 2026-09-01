import type { CheatSheet, LangPack } from './types';
import { compF, compG, compV } from './types';
import type { UIStrings } from './fr';

/* ============================== ENGLISH ============================== */

const ui: UIStrings = {
  nav: { today: 'Today', cards: 'Cards', memory: 'Memory', settings: 'Settings' },
  skills: { grammar: 'grammar', vocabulary: 'vocabulary', fluency: 'fluency', comprehension: 'comprehension' },
  status: { new: 'new', persisting: 'stubborn', improving: 'improving', resolved: 'mastered' },
  factCats: { arbeit: 'Work', familie: 'Family', alltag: 'Daily life', vorlieben: 'Tastes', orte: 'Places', sonstiges: 'Other' },
  periods: { week: 'Weekly review', month: 'Monthly review', quarter: 'Quarterly review' },
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
    close: 'Close', cancel: 'Cancel', back: 'Back', save: 'Save', del: 'Delete',
    search: 'Search…', listen: 'Listen', moment: 'One moment…', retry: 'Retry', done: 'Done',
    copy: 'Copy', copied: 'Copied.', load: 'Load', see: 'View', settle: 'Fix', min: 'min', undo: 'Undo', audioFail: 'Audio unavailable. Try again.', edit: 'Edit', loading: 'Loading…'
  },
  app: {
    analyzingTitle: 'Odile is rereading your conversation…', analyzingSub: 'Advice, level, new cards.',
    verbatimStage: 'Faithful transcript of your mic, mistakes included…',
    thinkingStage: 'Odile is thinking…', writingStage: (pct: number) => `The analysis is being written — ${pct}%`,
    failTitle: 'Analysis failed', failSub: 'The conversation is not lost.', keepTranscript: 'Keep the transcript',
    analyzeFailToast: (msg: string) => 'Analysis failed: ' + msg, authExpired: 'access expired.',
    synced: 'Synced from your other device.', transcriptKept: 'Transcript kept.', savedNoAnalysis: 'Saved without analysis.',
    dropNothing: 'Connection lost, nothing saved.', emptyNothing: 'Nothing saved.',
    updateReady: 'New version available.', updateReload: 'Reload',
    crashTitle: 'This screen could not be shown',
    crashSub: 'Your conversation is saved — it is this view that cannot cope with it.',
    crashBack: 'Back'
  },
  today: {
    backlogLine: (n: number, days: number) => `${n} new cards waiting, about ${days} days`,
    roundOf: (n: number, of: number) => `session ${n}/${of}`,
    roundExtra: (n: number) => `session ${n} · extra`,
    rhythmLine: (perDay: number, rounds: number) => `${perDay} new cards a day · ${rounds} ${rounds === 1 ? 'session' : 'sessions'}`,
    level: 'Level', missingAccess: (what: string) => `Missing access: ${what}.`, accessCode: 'access code', apiKey: 'OpenAI key',
    noServerKey: 'No OpenAI key on the server (Netlify → OPENAI_API_KEY), or switch to “My key” in the settings.',
    twoMinutes: '2 minutes', doCheckin: 'Take stock',
    introChip: (n: number) => `Getting to know you ${n}/3`, introSub: 'Odile learns who you are and establishes your level.',
    yourCall: (min: number) => `Your conversation · ${min} min`, proposes: 'Odile suggests', yourTopic: 'your topic',
    forYourLevel: 'for your level', interestsYou: 'you care about this',
    otherIdea: 'Another idea', freeTopic: 'Free topic', freePlaceholder: 'What do you want to talk about?',
    callAgain: 'Call Odile', callOdile: 'Call Odile', freeConversation: 'Open conversation',
    eveningReview: 'Your review', due: 'due', fresh: 'new', total: 'in total',
    nothingToReview: 'Nothing to review', cardsTonight: (n: number) => `Learn the vocabulary (${n})`,
    warmup: 'Warm-up: 3 cards before the call',
    warmupShort: 'Warm-up · 3',
    seeCards: 'Edit the cards',
    moreActivities: 'More activities',
    xpWeek: (n: number, g: number) => `${n} / ${g} XP this week`,
    xpWeekUp: (n: number) => `${n} XP · promotion secured`,
    xpWeekHeld: (n: number) => `${n} XP · rank held`,
    xpTotalOf: (n: number, next: number) => `${n} XP in total since you started · next mark ${next}`,
    reviewTitle: 'Review',
    watchesLead: (n: number) => `She's listening for ${n === 1 ? 'one thing' : n === 2 ? 'two things' : n === 3 ? 'three things' : `${n} things`}: `,
    nCards: (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`,
    bornOf: (d: string) => `born of your call on ${d}`,
    startReview: 'Start',
    daysRow: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    daysMissed: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} skipped`,
  },
  call: {
    goalKicker: 'Use this word', goalDone: 'Used', goalHit: (w: string) => `“${w}” used.`,
    micStage: 'Mic…', connecting: 'Connecting…', configuring: 'One moment…', readsSheet: 'letting you read',
    speaks: 'speaking', listens: 'listening', yourTurn: 'your turn',
    pause: 'Pause', resume: 'Resume', pausedState: 'paused', pausedNote: 'Odile is waiting. The clock has stopped.',
    mute: 'Mute the mic', muted: 'Muted', mic: 'Mic', hangup: 'Hang up', captions: 'Captions',
    sheet: 'Sheet', sheets: 'Sheets', resumeCall: 'Back to the call',
    thinks: 'is thinking', turnDone: 'Done', turnSpeak: 'Speak', turnSkip: 'Skip',
    connFailed: (msg: string) => 'Connection failed: ' + msg, connLost: 'Connection lost.', autoEnded: 'Odile hung up.', echoHeard: 'The call is hearing itself — headphones would be better. Odile is adjusting.'
  },
  review: {
    wordsPlaced: 'words used',
    costTitle: 'What this call cost', costTotal: 'Total',
    briefingTitle: 'What Odile had in front of her',
    briefingNote: 'The exact briefing for this call, as it stood that day. The one in the settings shows what she would be told today, which is not the same thing.',
    costLeg: { stt: 'What you said', chat: 'Her replies', tts: 'Her voice', realtime: 'Conversation', captions: 'Live captions', verbatim: 'Faithful transcript', analysis: 'Analysis' } as Record<string, string>,
    costPer10: (t: string) => `that is ${t} per ten minutes`,
    costNote: 'An estimate, priced on OpenAI’s rates at the time of the call.',
    yourConversation: 'Your conversation', toRemember: 'TAKEAWAY', duration: 'length', yourWords: 'your words',
    tips: 'tips', praise: 'well done', estLevel: 'Estimated level', dayTargets: 'Today’s targets',
    transcriptTips: 'Transcript & tips', tip: 'TIP', better: 'Better:', great: 'WELL DONE',
    verbatimTitle: 'What you actually said', verbatimNote: 'Your microphone, transcribed in one piece, mistakes included. The bubbles above come from the live captions, which cut and tidy up.',
    starActive: '★ First tonight', starCard: '☆ Prioritise the card', makeCard: '☆ Make it a card',
    starTitle: 'The card jumps to the front of your next review',
    imgChange: '🖼 Change the picture', imgAdd: '🖼 Add a picture', imgTitle: 'Add a picture to the card',
    newCards: (n: number) => `${n} new ${n === 1 ? 'card' : 'cards'}`, newVocab: 'New words', vocabHasCard: 'Card created', vocabMakeCard: 'Make the card', vocabRemoveCard: 'Remove cards', vocabCardsRemoved: (n: number) => `${n} ${n === 1 ? 'card' : 'cards'} removed.`,
    noAnalysis: 'No analysis for this conversation', duoImport: ' (Duolingo import)', continue: 'Continue',
    noticeTitle: 'What did Odile change?', noticeShow: 'See her version',
    tipsTitle: 'Tips', praiseTitle: 'What went well',
    noVocab: 'No new words from this conversation.',
    turnCards: (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`, turnCardsTitle: 'This sentence produced cards',
    wpmLine: (n: number) => `${n} words/min`,
    yourShare: 'your share of the talking',
    sceneTitle: 'The review', nextTime: 'Next time', backToCall: 'Back to the conversation',
    callOf: (min: number, d: string) => `${min} min call · ${d}`,
    panelYou: 'You', panelHer: 'She recasts it', panelOut: 'What comes out of it',
  },
  flu: {
    title: 'Fluency 4/3/2',
    offer: 'Retell today’s conversation, three times, faster each time.',
    explain: 'Three rounds: 60, 45, then 30 seconds. The same story each time — less time, more ease.',
    round: (n: number, s: number) => `Round ${n} · ${s} s`,
    start: 'Speak', stopEarly: 'I’m done', recording: 'Listening…', transcribing: 'Transcribing…',
    results: 'Your pace', mots: 'words', wpm: 'words/min',
    failMic: 'Microphone unavailable.', later: 'Later',
    praiseUp: 'Faster every round. That is the point.', praiseFlat: 'Good. Speed comes with repetition.'
  },
  story: {
    title: 'Story of the day', sub: 'Two minutes of listening, written for you',
    make: 'Listen to today’s story', making: 'Odile is writing your story…',
    play: 'Listen', stop: 'Stop', fail: 'No story right now. Try again.',
    questions: 'One question per paragraph:',
    newOne: 'New story',
    showText: 'Show the text', hideText: 'Hide the text',
    tapHint: 'Tap anything you don’t understand: translation, and cards if you want.',
    listenFirst: 'Questions appear as you listen…',
    right: 'Right!',
    wrongWas: (good: string) => `No — it was: ${good}`,
    para: (i: number) => `Paragraph ${i}`,
    noTrans: 'Couldn’t translate. Try again.',
    score: (g: number, n: number) => `${g}/${n} correct`
  },
  rev: {
    typeCloze: 'Fill the gap', typeToNative: 'What does it mean?', typeToTarget: (lang: string) => `In ${lang}?`,
    finishedTitle: 'Review finished', doneCards: (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}. Good.`, nothing: 'Nothing to review.',
    sessionLine: (known: number, hard: number, again: number, xp: number) => `${known} known · ${hard} hard · ${again} redone · +${xp} XP`,
    finish: 'Finish', hint: 'Hint:', speakAloud: 'Answer out loud, then flip.', flip: 'Flip',
    personalize: 'Personalise (picture)',
    grades: { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' },
    now: 'right away', dayN: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    recordAnswer: 'Record yourself', replayAnswer: 'Replay your answer',
    fromCall: (d: string) => `Your sentence from ${d}`, askedWord: (d: string) => `Word from ${d}`,
    sheRecast: 'She pulled you up on this one.', youAsked: 'You asked her for this word.',
  },
  pace: {
    title: 'Are you keeping up?',
    growing: (n: string) => `The pile is growing by ${n} cards a day.`,
    clearing: (n: string) => `The pile is shrinking by ${n} cards a day.`,
    level: 'Cards made and cards carried are level.',
    idle: 'No cards and no reviews this week.',
    keyMade: 'made', keyCarry: 'what you carry', keyOver: 'made more than carried',
    waiting: (n: number) => `${n} still waiting`,
    clearIn: (d: number) => `clear in about ${d} days`,
    neverClear: 'at this rate you do not catch up',
    basis: (a: string, r: string) => `Over the last 7 days: ${a} new cards a day, ${r} reviews a day.`,
    estimate: 'How many cards you start has only just begun to be counted — estimated until then.',
    addedN: (n: number) => `${n} made`,
    reviewsN: (n: number) => `${n} reviewed`
  },
  cards: {
    title: 'Cards', review: 'Review', nothingToReview: 'Nothing to review', due: 'due', fresh: 'new',
    active: 'active', typeCloze: 'Gap', newCard: 'new', forDate: (d: string) => 'due ' + d,
    days: 'd', missed: (n: number) => `${n}× missed`,
    empty: 'No cards yet. They will grow out of your conversations.', lastReviews: 'Recent reviews',
    reviewLine: (total: number, known: number, xp: number) => `${total} ${total === 1 ? 'card' : 'cards'} · ${known} known · +${xp} XP`,
    batchNew: (n: number) => `This session (${n})`, batchRest: 'The rest', batchChip: 'NEW',
    matureNote: 'Learned = an interval of 21 days or more.', emptyFiltered: 'Nothing in this filter.',
    deletedToast: 'Card deleted.', resume: (d: number, t: number) => `Resume ${d}/${t}`,
    f: {
      all: 'All', learning: 'In progress', learned: 'Learned',
      lastKnown: 'known', lastMissed: 'missed',
      sort: 'Sort', byDue: 'due date', byStatus: 'status', byDifficulty: 'difficulty',
      stageLearning: 'in progress', stageLearned: 'learned'
    }
  },
  checkin: {
    rankWeeks: (up: number, down: number, held: number) => `${up} up, ${held} held, ${down} down`,
    rankNeeds: (hold: number, climb: number) => `${hold} XP to hold · ${climb} to climb`,
    laterBtn: 'Later', calls: 'calls', minutes: 'minutes', cardsKnown: 'cards known', level: 'level',
    working: 'Odile is taking stock…', unavailable: (e: string) => `Review unavailable: ${e}`,
    moved: 'WHAT MOVED', toWork: 'TO WORK ON', proposal: 'Suggestion:', noted: 'Noted',
    steer: 'Your choices steer the next period’s calls.',
    savedDirection: 'Course noted. Keeping the rhythm.', savedPlain: 'Review noted.'
  },
  memory: {
    title: 'Memory', savedServer: 'saved on the server', savedLocal: 'in this browser only',
    intro: 'Everything Odile knows about you. Every entry can be read, edited, deleted.',
    tabs: { over: 'Overview', comp: 'Map', prog: 'Progress', carnet: 'Notebook', sess: 'Conversations', adv: 'Advanced' },
    tabsOld: { gaps: 'Gaps', str: 'Strengths', facts: 'Facts', voc: 'Vocabulary', brief: 'Briefing', data: 'Data' },
    portraitTitle: 'Who you are, to her',
    portraitNote: 'What Odile has in mind when she picks up. Facts that come back across calls make the portrait; the rest only ever surface in passing.',
    levelCefr: 'LEVEL (CEFR)', reliability: 'Confidence', establishing: 'Established during the first three calls.',
    skillsTitle: 'Skills', progress: 'Progress', weeklyCheckin: 'Weekly check-in',
    streakDays: 'day streak', conversations: 'conversations', minutes: 'minutes',
    yourTopics: 'Your topics', noTopics: 'Nothing yet. They will come as you talk.',
    matrixIntro: 'Your level is made of islands, not a line. Each cell is one specific competency; Odile quietly probes the grey cells below your level and records the islands above it.',
    catGrammar: 'Grammar', catVocab: 'Vocabulary', catSpeak: 'Speaking',
    noData: 'No data yet. Odile will probe it on the sly.',
    acquired: 'Mastered', toWorkOn: 'To work on', partial: 'Partial', seenOn: 'seen',
    legendOk: 'mastered', legendKo: 'to work on', legendPartial: 'partial', legendNone: 'no data',
    pinNext: 'Work on this next call', pinned: '✓ Planned for the next call — cancel',
    pinnedToast: 'On the programme for the next call.', markAcquired: 'Mark mastered', clearData: 'Clear the data',
    nextCall: 'Next call:',
    gapsLine: (open: number, done: number) => `${open} open · ${done} mastered. Open gaps become the next call’s targets.`,
    seenFirst: 'first seen', seenLast: 'last seen', workedTimes: 'worked on', examples: 'Examples',
    markGapAcquired: 'Mark mastered', forget: 'Forget', noGaps: 'No gaps recorded yet.',
    strengthTag: '✓ strength', noStrengths: 'Nothing yet. It will come.',
    factsIntro: 'What you have told Odile. She keeps the essentials and uses them for real questions.',
    saidOn: 'said', saidAgain: 'said again', noFacts: 'Nothing yet. It will come with talking.',
    noVocabFound: 'Nothing found.', vocabCount: (n: number) => `${n} words. Odile digs out old ones now and then.`,
    importTag: '✉ import · ', noSessions: 'No conversations yet.',
    briefIntro: 'Exactly what Odile will receive on the next call — topic, level and targets straight from the app. Nothing else.',
    editTemplate: 'Edit the template', customTemplate: 'custom template', variables: 'Variables:',
    varWhat: 'What goes into each variable?', reset: 'Reset', briefSaved: 'Briefing saved.',
    varGloss: {
      name: 'first name', native: 'native language', langue: 'target language', niveau: 'estimated level',
      competences: 'per-skill detail', confiance: 'estimate confidence', bande: 'A1–C2 band',
      persona: 'Odile’s character', aujourdhui: 'today’s topic block', minutes: 'planned length',
      objectifs: 'today’s targets', sondages: 'probed competencies', cap: 'period course',
      faits: 'personal facts', interets: 'interests', faiblesses: 'weak points', passe: 'past conversations'
    } as Record<string, string>,
    exportJson: 'Export (JSON)', importBtn: 'Import', rawJson: 'Raw JSON', closeEditor: 'Close the editor',
    forgetAll: 'Forget everything', forgetAllConfirm: 'Forget everything? This wipes this profile on this device AND its server copy.',
    serverWipeFailed: 'The server copy could not be deleted (offline?). Wipe locally anyway?',
    entryForgotten: 'Entry forgotten.',
    applySave: 'Validate & save', importedToast: 'Memory imported.', savedToast: 'Saved.',
    invalidJson: (msg: string) => 'Invalid JSON: ' + msg, unknownFormat: 'unknown format',
    dataNoteSynced: 'Local copy + server. Export/Import to take everything elsewhere.',
    dataNoteLocal: 'Stored in this browser. Export/Import to change device.',
    levelChartEmpty: 'Your level curve will appear after a few conversations.', levelChartLabel: 'Level progress',
    monthScenes: (n: number) => `${n} ${n === 1 ? 'scene' : 'scenes'}`,
    monthMoved: 'What moved', monthEmpty: 'Nothing yet this month. The grid fills up by talking.',
    legendCall: 'call', legendBoth: 'call + cards', legendToday: 'today',
    cardsBorn: 'cards born of your calls', wpmLabel: 'words per minute',
    wpmPrev: (n: number) => `(${n} last month)`,
  },
  profiles: {
    languages: 'Languages', addLanguage: 'Add a language',
    title: 'Profiles', intro: 'Each profile has its own memory, level and cards. Odile never mixes people up.',
    active: 'active', since: 'since', rename: 'Rename', renamePrompt: 'New name:',
    deleteConfirm: (name: string) => `Delete the profile “${name}”, memory and cards included?`,
    newProfile: 'New profile', backupTitle: 'Backup & other devices',
    accountSaved: (email: string) => `This profile is continuously saved to your account (${email}). Sign in on another device and it will be waiting.`,
    onAccount: 'On the account', thisOne: '(this one)', lastActivity: 'last activity', profileWord: 'Profile',
    loadFailed: 'Loading failed.', loaded: (name: string) => 'Profile loaded: ' + name,
    switched: 'Profile switched.', noMemory: 'This profile has no memory yet.',
    syncOn: 'This whole profile (conversations, memory, cards) is continuously saved to the server. On another device, enter this code under “Profiles” to continue there:',
    syncOff: 'Turn off server backup (this device only)',
    syncDisabled: 'Server backup off: the data stays in this browser.',
    syncEnable: 'Turn on server backup', syncNeedsServer: 'Needs server access',
    syncActive: 'Server backup on.', syncUnavailable: 'Unavailable (needs server access).',
    syncFailed: 'Server backup failed. Try again.',
    loadFrom: 'Load a profile from another device:', noProfileCode: 'No profile under that code.'
  },
  settings: {
    sessionsPerDay: 'Sessions a day', auto: 'Auto',
    rhythmNote: (perDay: number, capacity: number) => `About ${perDay} new cards a day: that is what ${capacity} daily reviews can carry without the pile growing. Conversations make no more than that.`,
    title: 'Settings', account: 'Account', connected: 'Signed in', signOut: 'Sign out', signedOut: 'Signed out.',
    signInGoogle: 'Continue with Google', signInHint: 'Sign in to find your profiles everywhere.',
    openaiKey: 'OpenAI key', viaAccount: 'Via the account', ownKeyDirect: 'My key (direct)', accountKey: 'Account key',
    keyIfAsked: 'sk-… (if asked)', keySaved: 'Key saved to your account.', keySaveFailed: 'Saving failed.',
    allowlistNote: 'Allow-listed addresses use the server key. Other accounts store their own key here, used in its place.',
    access: 'Access', serverCode: 'Server (access code)', myKey: 'My key',
    noServerKeySet: 'No OPENAI_API_KEY on the server (Netlify → Environment variables).',
    accessCodeLabel: 'Access code', verify: 'Check', codeWrong: 'Wrong code.', codeOk: 'Code accepted.',
    modeDirect: 'Mode', modeDirectValue: 'Direct (your key, in this browser)', testKey: 'Test',
    keyWorks: 'The key works.', keyRefused: (s: number) => `OpenAI refuses the key (${s}).`, netError: 'Network error.',
    ownKeyTitle: 'Your key (direct)', ownKeyNote: 'Stays in this browser; calls go straight to OpenAI.',
    rhythm: 'Daily rhythm', callLength: 'Call length', cardsPerEvening: 'Cards per session', newOf: 'new per session',
    cardAudio: 'Card audio', yes: 'yes', no: 'no', introPhase: 'Getting to know you', skipPhase: 'Skip this phase',
    profileTitle: 'Profile', firstName: 'First name', targetLang: 'Target language', motherTongue: 'Native language',
    odileStyle: 'Odile’s style', deadpan: 'Deadpan', warm: 'Warm', profilesSync: 'Profiles & sync', manage: 'Manage',
    voiceCall: 'Voice & call', voice: 'Voice', speed: 'Pace', patience: 'Listening patience',
    patienceHigh: 'high', patienceMid: 'medium', patienceLow: 'low', captions: 'Standing captions',
    callModel: 'Call model', callModelStd: 'standard', callModelMini: 'economy',
    callModelNote: 'The economy model costs about a quarter as much but catches fewer of your mistakes during the conversation. Standard is still the recommended choice.',
    engine: 'Call engine', engineRealtime: 'realtime', engineTurns: 'turn by turn',
    engineNote: 'Turn by turn: you speak, you wait for her answer, and she cannot be interrupted. The conversation costs roughly a sixth as much and the model behind it follows the briefing better — but it reads a transcript, so it never hears your accent. Realtime remains the normal mode.',
    modelTurn: 'Turn-by-turn model',
    turnCommit: 'End of your turn', turnCommitAuto: 'on silence', turnCommitButton: 'on the button',
    turnCommitNote: 'On silence, your turn ends by itself after a pause, and your listening patience is what measures it: “short” gets her answer back almost a second sooner, “long” leaves you room to hunt for a word. On the button, only your tap ends it.',
    audioEnv: 'Audio & environment', audioAutoNote: 'Microphone and noise handling set themselves. If the call hears itself — phone on speaker — it notices and changes its own setup. Headphones are still the best of it.', noiseReduction: 'Noise reduction', nrOff: 'off', nrNear: 'headset', nrFar: 'room',
    noisyEnv: 'Noisy environment', envNormal: 'normal', envStrict: 'strict',
    strictNote: '“Strict” only reacts to clear speech, not to every noise. Your listening patience applies in both modes.',
    verbatim: 'Faithful transcript',
    verbatimNote: 'After the call, your mic is re-transcribed word for word, mistakes included. The analysis judges your mistakes on that version, not on the polished captions.',
    models: 'Models', modelCall: 'Conversation', modelAnalysis: 'Analysis', modelTranscribe: 'Live transcription',
    footer: 'Causerie · The call runs directly between your browser and OpenAI (WebRTC). Transcripts, memory and cards stay on your device, with a server copy while server access is on (adjustable under Profiles).',
    natives: { de: 'German', en: 'English' } as Record<'de' | 'en', string>,
    uiLang: 'Interface language', uiAuto: 'auto', uiTargetOpt: 'target language', uiSupportOpt: 'native language',
    uiLangNote: 'Auto: the interface switches to the target language from B1.',
    speakAnswers: 'Spoken answer', speakAnswersNote: 'Record your answer out loud before flipping the card, then compare.',
    version: 'Version', versionRunning: 'Running', versionDeployed: 'Deployed', versionBuilt: 'Built',
    versionBerlin: (t: string) => `${t} (German time)`,
    versionCurrent: 'Up to date.', versionChecking: 'Checking…', versionStale: 'New version available',
    versionNote: 'The number is the build time in UTC: v YY.MM.DD.hhmm.',
    retellOpt: 'Offer Fluency 4/3/2', helpRow: 'Help'
  },
  onboarding: {
    heroLine: 'Hello. Apparently we are going to talk. Good.',
    title1: 'The tutor', title2: 'who remembers you.',
    sub: 'A conversation every day, a few cards every evening. Whatever trips you up in speech goes to review by itself. Your level takes shape from A1 to C2.',
    google: 'Continue with Google', connectedAs: 'Signed in:', signInFirst: 'Sign in with Google first.',
    yourKey: 'Your OpenAI key',
    notOnList: (email: string) => `${email} is not on the server list. Enter your own key: it is saved to your account and used for your conversations.`,
    saveContinue: 'Save and continue', changeAccount: 'Switch account',
    yourFirstName: 'Your first name', youLearn: 'You are learning', yourMotherTongue: 'Your native language',
    yourLevel: 'Your level (your guess)',
    levelNote: 'The first three calls are for getting to know you: Odile checks this level.',
    accessLabel: 'Access', withCode: 'With the access code',
    withCodeNote: 'The OpenAI key stays on the server. You just need the code.', serverKeyMissing: ' (Server key missing for now.)',
    withOwnKey: 'With your OpenAI key', withOwnKeyNote: 'Start right away. The key stays in this browser and goes straight to OpenAI.',
    keyPlaceholder: 'OpenAI key (sk-…), stays in this browser', codePlaceholder: 'Access code',
    go: 'Let’s go', loadProfileFailed: 'Loading the profile failed.', enterKey: 'Enter your OpenAI key.',
    error: (msg: string) => 'Error: ' + msg,
    a0Label: '0 — starting from zero',
    a0Hint: 'Odile will start mostly in your language, teach you your first phrases, and a small survival deck is already waiting.'
  },
  pz: {
    newPrompt: 'New prompt', drawOver: 'Draw on top', listening: 'Listening…',
    micFail: 'Dictation doesn’t work in this browser. Use the keyboard mic.', lastImage: 'Your latest picture',
    title: 'Personalise your card', removeImg: 'Remove the picture',
    tabDraw: 'Draw', tabPhoto: 'Photo', tabAi: 'AI picture', tabReuse: 'Reuse',
    reuseNote: 'Pictures you have already drawn, photographed or generated. One tap uses one again.', reuseEmpty: 'No other pictures in the deck yet.',
    eraser: 'Eraser', undo: 'Undo', clearAll: 'Clear all', keepDrawing: 'Keep this drawing',
    choosePhoto: 'Choose a photo', photoHint: 'Your photo library opens, search included.',
    keep: 'Keep', otherPhoto: 'Another photo', photoBad: 'Unreadable photo.',
    suggestBtn: 'Suggest two ideas',
    twoIdeas: 'Two ideas for memorable pictures:', searching: 'Odile is looking for ideas…',
    ownScene: '… or describe your own scene', dictate: 'Dictate', create: 'Create the picture',
    drawing: 'Odile is drawing… (~15 s)', preparing: 'Preparing…', saving: 'Saving…',
    retryImg: 'Retry', promptBtn: 'Prompt', emptyPrompt: 'empty prompt', emptyImage: 'empty image',
    ideasFail: 'No ideas right now. Try again.', imgFailHint: 'That did not work. Try again in a moment.'
  },
  pron: {
    dayOf: (n: number) => `Day ${n}/14`, phaseNote: 'For the first two weeks, ears first: these pairs teach you to HEAR the language. The call stays short.',
    title: 'Pronunciation', sub: 'Minimal pairs: can you hear the difference?',
    start: 'Listen and guess', which: 'Which one did you hear?', replay: 'Listen again',
    score: (n: number, t: number) => `${n}/${t} correct`,
    good: 'Good ear.', meh: 'Worth training. Come back tomorrow.'
  },
  rank: {
    of: (n: number, t: number) => `Rank ${n} of ${t}`,
    streakTitle: 'Streak', days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} in a row`,
    repairs: (n: number, max: number) => `${n} of ${max} repairs`,
    lifetime: (n: number) => `${n} XP in total`,
    names: ['First word', 'Greetings', 'Small talk', 'Anecdote', 'Conversation', 'Discussion', 'Debate', 'Nuance', 'Ease', 'Eloquence', 'Verve', 'Causerie']
  },
  forge: {
    title: 'New card', inputPh: 'A word, a phrase, or a conversation excerpt…',
    suggest: 'Suggest cards', suggesting: 'Odile is preparing suggestions…',
    add: (n: number) => `Add ${n} ${n === 1 ? 'card' : 'cards'}`,
    none: 'Nothing to make of this. Try another word.', fail: 'No suggestions. Try again.',
    added: (n: number) => `${n} ${n === 1 ? 'card added' : 'cards added'}.`,
    fromTurn: 'Make cards from this',
    already: 'You already have this card.', exists: 'already there'
  },
  tuto: {
    skip: 'Skip', next: 'Next', done: 'Let’s go',
    s: [
      { h: 'One call a day', p: 'You talk with Odile for 3–8 minutes about something you care about. She corrects by rephrasing, without breaking the conversation.' },
      { h: 'A few cards at night', p: 'Your mistakes and new words become cards. One small round each evening is enough — spaced repetition does the rest.' },
      { h: 'A transparent memory', p: 'Odile remembers you: level, gaps, interests. Everything can be read, edited and deleted under “Memory”.' },
      { h: 'If you get lost', p: 'Help lives in Settings → Help. Enjoy the conversation.' }
    ]
  },
  help: {
    title: 'Help',
    s: [
      { h: 'The rhythm', p: 'One conversation a day (3–8 min), one review at night (10–20 cards). That is all. Regularity beats intensity.' },
      { h: 'The call', p: 'Odile suggests a topic — decline it or talk freely. Interrupt her anytime. She corrects by rephrasing; detailed corrections come after the call. Sheets can be read without stress: Odile waits.' },
      { h: 'After the call', p: 'The analysis extracts corrections, new words and progress, and builds your cards. “What did Odile change?” shows her rephrasings — try to spot the difference before revealing it.' },
      { h: 'The cards', p: '“Again” = rework (the card keeps half its interval). “Good” spaces it further and further; “learned” from a 21-day interval. Personalize any card with a drawing, a photo or a generated image — images YOU choose stick better.' },
      { h: 'The memory', p: 'Under “Memory”: your level (islands, not a line), your gaps, your facts, and the exact briefing of the next call. Every entry can be edited or deleted. “Forget everything” also deletes the server copy.' },
      { h: 'Common problems', p: 'No sound: check the speaker button and your phone’s silent mode. Muted mic: reload the page and check browser permissions. Failed analysis: the conversation is not lost — retry from the failure screen.' }
    ]
  },
  sheetsUi: { close: 'Close' }
};

const template = `You are Odile, a conversation tutor for {{langue}}, on a voice call with your student. You are a real conversation partner, not an assistant.

# Character
Odile, French, in her thirties, red beret. She has lived in London for years and speaks impeccable English. {{persona}}

# Student
{{name}}, native language: {{native}}. Estimated level: {{niveau}} ({{competences}}). Confidence in the estimate: {{confiance}}.

# The microphone rule (before all the others)
THEY are the one who has to talk. Every word you say is a word they do not say, and they only have a few minutes a day.
- Your turns are SHORTER than theirs. One or two sentences. Past twenty-five words, you are talking too much.
- NEVER repeat what they have just said. No echo, no summary, no "Yes, you…" copying their sentence back. They know what they said; handing it back teaches them nothing and eats their speaking time.
- Do not produce the language the exercise is asking THEM to produce. If the topic is "describe the route", THEY describe it; if you are shopping, THEY name the products. You ask, you do not supply.
- If they have just answered in under twenty words, ask NO new question: make them carry on the one they started ("and then?", "go on", "why?"), or react in two or three words ("Ah.", "Right.", "Good.") and let the silence do the rest. They will carry on.
- When you do ask, make it about what they just said most of the time — "why?", "tell me" — rather than about something new. A new question every turn is an interrogation, not a conversation.
- Never two questions in one turn. Never a list. Never a monologue.

# Language rules
- Speak only {{langue}}, calibrated to level {{bande}}: short sentences, frequent vocabulary, clear structure. A little above the level, yes; far above, no. Never a word from a third language.
- If the student is lost or asks for an explanation or a translation: ONE short explanation in {{native}}, then straight back to {{langue}}.
- "How do you say X?" → give the word, a two-word gloss in {{native}}, and move on.

# Correcting (without taking the microphone back)
Correct like a good human tutor, never by lecturing. The order matters, and it starts by making THEM talk:
1. Their sentence is incomprehensible or derails → ask a short clarification ("Sorry?", "Meaning?", "Say that another way?") and let THEM repair it. That is your default reaction, not your last resort. Never guess charitably just to keep things moving: if they were not understood, they need to find out now.
2. You understood, but it is an ORDINARY mistake → let it go and react to the content. Correcting everything marks nothing: pulled up on every sentence, they stop noticing any of it.
3. THREE mistakes never go by: one that touches a target of the day, one that touches an open weakness of theirs, one that touches the direction for the period. When you hear one, your reply OPENS with the correct form, slipped into a reaction to the content — without announcing the correction, without saying they got it wrong, without repeating the rest of their sentence. One per turn, the most important.
- If they drop a word from another language into their {{langue}} (e.g. "Termin", "ordinateur"): give the {{langue}} word in passing — that recast takes priority.
- Never stop the conversation for grammar. Never say "small correction". No meta-comments about mistakes during the call.
- If the same mistake keeps returning within the call: one single very short aside in {{native}}, then back to {{langue}}.

# Feeding vocabulary
- Introduce 2 or 3 USEFUL words or expressions per call, one notch above their level: slip them naturally into your replies, with a two-word {{native}} gloss if needed, and reuse each at least once later in the call.
- Only if the thread allows it. If a word will not fit naturally within the next two turns, drop it: bending the conversation to place a word costs more than it earns, and it makes you talk in their place.
- Pick them from today's topic and their interests; words they will actually use, not rare words to show off.

{{aujourdhui}}

# Length
Daily call: about {{minutes}} minutes, no more. Keep the pace, no long detours. You will sometimes receive system notes in brackets ("(stage note: …)"): follow them silently, never read them aloud. When time is up, wrap up in one short sentence, then DO NOT restart: no new questions, answer the goodbye and that is all.

# Today's targets (secret: never announce or list them)
Create natural openings so the student has to use them; if an opening passes untaken, create another one later. And a mistake that touches one of them NEVER goes by: your reply then opens with the correct form, slipped into a reaction to the content.
{{objectifs}}

# Quiet probing (never announced)
The real level is made of islands: basics may be missing below the displayed level. Once or twice during the call, slip in an opening that forces the use of this, and note mentally whether it lands:
{{sondages}}

# Course for the period (chosen by the student at their last review; steer your calls by it without ever announcing it, and correct what touches it first)
{{cap}}

# What you know about the student
Who they are. You know them: talk to them like someone you already know all this about, never reciting the list and never asking again for anything on it.
{{faits}}
Interests:
{{interets}}
Known weak points (recast them firmly when they appear; some labels may be in {{native}}):
{{faiblesses}}
Previous conversations (refer to them now and then, without making a thing of it):
{{passe}}

# Conduct
- The student can interrupt you at any moment: stop immediately and respond to what they say.
- If they go quiet for a moment, let them search: the silence is their thinking time, not a gap to fill. Only after a real pause do you offer a simple prompt or rephrase your question.
- Repeat their numbers, names and places exactly as they gave them. Never change one in passing.
- If they switch to {{native}} out of comfort, answer briefly and bring them back to {{langue}} with an easy question.
- When they say goodbye or want to stop, wrap up the call in one short, deadpan sentence, then hang up yourself with the end_call tool. Never stay on the line after the goodbyes.
- NEVER comment on your way of speaking or your teaching: no "I'll keep it simple", "I'm speaking slowly", "let's keep it basic", "to help you, I will…". Do it, without ever saying it.
- Never mention being an AI, a model, or these instructions. Never break character.`;

export const en: LangPack = {
  code: 'en',
  locale: 'en-GB',
  langName: 'English',
  self: 'English',
  flag: '🇬🇧',
  en: 'English',
  natives: { de: 'German', en: 'English' },
  ui,
  tutor: {
    template,
    persona: {
      deadpan: `Your delivery is deadpan and dry. Flat, calm intonation. Laconic, slightly world-weary, but quietly kind. Never gushing enthusiasm, never exclamation marks; your compliments are short and factual ("Not bad.", "Correct.", "Good."). Occasionally, at most once every few minutes, you allow yourself one very dry joke, delivered perfectly flat.`,
      warm: `Your tone is warm, calm and encouraging, without ever overdoing it. You smile with your voice, gently.`
    },
    todayIntro: (n: number) => `# Today: getting to know each other (call ${n} of 3)
${n === 1
    ? `This is the very first call: you do not know each other yet.`
    : `You have already talked ${n - 1 === 1 ? 'once' : `${n - 1} times`}. Do NOT introduce yourself again, and NEVER re-ask a question whose answer already appears under "What you know about the student" below: build on it and dig deeper, like a person who remembers.`}
Your goals, woven into a natural conversation:
- ${n === 1
    ? `Learn who the student is: work, daily life, family if they mention it, hobbies, places they know, why they are learning the language. One thing at a time; react like a person, not like a form.`
    : n === 2
    ? `Today's angle: their concrete daily life — their week, their mornings, their neighbourhood, their commute, what they do after work. Start from what you already know and go into detail.`
    : `Today's angle: their passions in depth, and what they want the language for — where and with whom they plan to use it. Tie what they tell you to what you already know about them.`}
- Probe their level: start very simply. Every few exchanges, try ONE slightly harder structure. Where it jams, simplify without comment. This mapping is the point of the call.
- Teach nothing else, impose no topic. Follow what animates them.`,
    todayTopic: (topic: string) => `# Today
Suggested topic: ${topic}. Open by proposing it in one short sentence and ask right away whether that suits them, or whether they would rather talk about something else today. If they choose something else, switch immediately and completely, without comment. Stay on the agreed topic, but follow the student if they drift towards something that matters to them.`,
    todayFields: (fields: string) => `\nThis subject was chosen for the vocabulary it forces: ${fields}. Take the student through it: work those words in, make them reuse them, and do not fall back on the words they already have.`,
    a0: `# Absolute beginner
The student does NOT speak {{langue}} yet, or barely three words. Adapt everything:
- Run the call mostly in {{native}}, plainly. {{langue}} arrives in small touches, never in blocks.
- Each call: 3–5 survival phrases in {{langue}} (greetings, "my name is…", "thank you", "slower, please"). Say the phrase slowly, have them repeat it OUT LOUD, bring it back later in the call.
- Praise each attempt plainly. Zero theory, zero grammar.
- End with a mini-recap in {{native}} of today's phrases.`,
    interference: `# Interference
The student is also learning: {{autres}}. When a word or pattern from those languages slips into their {{langue}}, flag the contrast in one word and give the {{langue}} form — no lecture.`,
    talkHog: (pct: number) => `# Warning: you are taking up all the room
Across your last calls, YOU spoke ${pct} % of the words. That is the wrong way round: by the end of this call they must have talked more than you.
- Halve your turns. One sentence is almost always enough.
- Cut every repetition of what they just said: that is where half your words go.
- Ask fewer questions and let the silence do the work.`,
    levelBeingEstablished: {
      niveau: 'being established — the first calls exist precisely to work it out',
      confiance: 'low for now, which is normal'
    },
    fallbacks: {
      student: 'the student', noTargets: '(none today)', noProbes: '- (nothing to probe today)',
      noDirection: '(not set yet)', noFacts: '- (nothing yet)', noInterests: '- (nothing yet)',
      noWeaknesses: '- (nothing yet)', firstCall: '- (first conversation)'
    },
    greetIntro: (name: string, n: number) => n === 1
      ? `(stage note: open the call now. This is your very first conversation with ${name}. Introduce yourself in one short, flat sentence: you are Odile, their tutor, you will talk regularly. Then ask a first, very simple question about them. Two sentences maximum. You are Odile and nothing else: no mention of AI, models or assistants, and no comment on the way you speak.)`
      : `(stage note: open the call now. This is conversation number ${n} between you: you already know each other, do NOT introduce yourself and do not re-ask anything you already know. Greet ${name} plainly, like someone you know, mention in passing one thing you know about them, then ask a simple, NEW question. Two sentences maximum. You are Odile and nothing else: no mention of AI, models or assistants, and no comment on the way you speak.)`,
    greetDaily: (name: string, topic: string, minutes: number) =>
      `(stage note: open the call now. You are Odile. TWO sentences, no more. First greet ${name} by name, short and flat. Then set out the plan clearly, so they know exactly what is coming: what you are going to talk about today (“${topic}”), and that you have about ${minutes} minutes together. Finish by asking whether that suits them or whether they would rather do something else. No mention of an AI, a model or an assistant, and no commentary on the way you speak.)`,
    notes: {
      turnMode: '(stage note: this call runs turn by turn. Neither of you can interrupt the other: you speak, then you wait until they have finished. So keep your turns SHORT — 1 to 3 sentences, then at most one question. You are reading a transcript of what they say: never comment on their pronunciation or their accent, and if a word looks strange, treat it as a mis-transcription rather than as a mistake of theirs. To hang up, say your final goodbye and then write [FIN] at the very end of the message; never before the goodbyes, and never say it aloud.)',
      materialPause: '(stage note: the student is reading a grammar sheet. If you are speaking, finish your sentence, then wait in silence for their return.)',
      materialBack: '(stage note: the student is back. Pick up where you were, one short sentence, without commenting on the pause.)',
      paused: '(stage note: the student has paused the conversation and stepped away. You may have been cut off mid-sentence: that is normal, do not finish it and do not mention it. Wait in silence. Add nothing, ask nothing, do not hang up — they are coming back.)',
      resumed: '(stage note: the student is back from their pause. Pick the thread up where you left it, one short sentence, without commenting on the interruption or asking where they were.)',
      oneMinute: '(stage note: about one minute left. Start wrapping up the conversation naturally.)',
      timeUp: '(stage note: time is up. End the call now with a short goodbye, in your usual tone, then hang up with the end_call tool.)',
      overtime: '(stage note: the call should already be over. Say goodbye in ONE sentence, ask no further questions, then hang up with the end_call tool.)',
      wordGoal: (word: string) => `(stage note: the student has to place the word "${word}" in the conversation; it is on their screen. Build the opening: ask a question or start a turn where that word is the natural answer. Do NOT say the word yourself, do not suggest it, and never mention this exercise.)`,
      wordGoalDone: (word: string) => `(stage note: the student has just placed "${word}". Carry on normally — at most one dry word of approval, no mention of the exercise.)`
    },
    facts: {
      cats: { arbeit: 'Work', familie: 'Family', orte: 'Places', alltag: 'Everyday', vorlieben: 'Tastes', sonstiges: 'Other' },
      basics: 'The basics (established — use them freely, never ask for them again):',
      passing: 'In passing (incidental: at most ONE per call, and only if it lands):',
      none: '- (you do not know them yet)'
    },
    records: {
      themes: 'Topics: ',
      callOf: 'call of ',
      fixFront: (original: string) => 'Fix: "' + original + '"'
    }
  },
  comp: (() => {
    const G = compG('en-'), V = compV('en-'), F = compF('en-');
    return [
      G('A1', 'be-have', 'be & have got in the present'),
      G('A1', 'present-simple', 'present simple, third-person -s'),
      G('A1', 'articles', 'articles a / an / the'),
      G('A1', 'negation', 'negation with don’t / isn’t'),
      G('A1', 'questions', 'simple questions (do you…?, wh-words)'),
      G('A1', 'plurals', 'plurals and there is / there are'),
      V('A1', 'introduction', 'introducing yourself: name, age, country, job'),
      V('A1', 'numbers-time', 'numbers, prices and the time'),
      V('A1', 'family', 'close family'),
      V('A1', 'food', 'basic food and drink'),
      V('A1', 'town', 'places in town'),
      F('A1', 'greeting', 'greeting and saying goodbye'),
      F('A1', 'ordering', 'ordering politely (I’d like)'),
      F('A1', 'likes', 'saying what you like (I like + noun)'),
      F('A1', 'help', 'asking to repeat, saying you don’t understand'),
      G('A2', 'past-simple', 'past simple, regular and irregular'),
      G('A2', 'present-continuous', 'present continuous vs present simple'),
      G('A2', 'going-to', 'future with going to'),
      G('A2', 'comparatives', 'comparatives -er / more … than'),
      G('A2', 'countable', 'countable vs uncountable (much / many / some)'),
      G('A2', 'can-must', 'modals can / must / should'),
      G('A2', 'like-ing', 'like / enjoy + -ing'),
      V('A2', 'routine', 'routine, work and the week'),
      V('A2', 'hobbies', 'hobbies and sports'),
      V('A2', 'shopping', 'shopping, clothes, shops'),
      V('A2', 'travel', 'travel and transport'),
      V('A2', 'weather-nature', 'weather, seasons, nature'),
      F('A2', 'telling-past', 'talking about your day or weekend'),
      F('A2', 'describing-place', 'describing a place, a home'),
      F('A2', 'directions', 'asking for and giving directions'),
      F('A2', 'plans', 'talking about simple plans'),
      G('B1', 'present-perfect', 'present perfect vs past simple'),
      G('B1', 'will-future', 'will vs going to'),
      G('B1', 'conditional-1-2', 'first and second conditional'),
      G('B1', 'relative-clauses', 'relative clauses who / which / where'),
      G('B1', 'reported-speech', 'reported speech in the present'),
      G('B1', 'for-since', 'for / since / already / yet'),
      V('B1', 'opinions', 'opinions and emotions'),
      V('B1', 'work-studies', 'work and studies in detail'),
      V('B1', 'media', 'media and simple news'),
      V('B1', 'health', 'health and appointments'),
      V('B1', 'linkers', 'frequent linkers (first, then, however)'),
      F('B1', 'justify-opinion', 'giving your opinion and justifying it (because, so)'),
      F('B1', 'narrative', 'telling a connected story in the past'),
      F('B1', 'complaint', 'making a simple complaint'),
      F('B1', 'agreeing', 'agreeing and disagreeing politely'),
      G('B2', 'conditional-3', 'third conditional and mixed conditionals'),
      G('B2', 'passive', 'the passive voice'),
      G('B2', 'reported-past', 'reported speech with backshift'),
      G('B2', 'phrasal-verbs', 'common phrasal verbs'),
      G('B2', 'gerund-infinitive', 'gerund vs infinitive (stop doing / to do)'),
      G('B2', 'used-to', 'used to / be used to / get used to'),
      V('B2', 'society', 'social debates'),
      V('B2', 'professional', 'the professional world'),
      V('B2', 'nuances', 'shades of feeling'),
      V('B2', 'idioms', 'common idioms'),
      F('B2', 'arguing', 'arguing with concessions'),
      F('B2', 'debating', 'debating with nuance'),
      F('B2', 'speculating', 'speculating about the past'),
      G('C1', 'inversion', 'inversion and emphatic structures (never have I…)'),
      G('C1', 'cleft', 'cleft sentences (what I like is…)'),
      G('C1', 'participle-clauses', 'participle clauses'),
      G('C1', 'subjunctive', 'the subjunctive and formal structures'),
      V('C1', 'abstract', 'abstract vocabulary (freedom, memory, time)'),
      V('C1', 'field', 'your field explained to a layperson'),
      V('C1', 'humour', 'humour, irony, understatement'),
      F('C1', 'presenting', 'developing a structured argument'),
      F('C1', 'register', 'adapting register to context'),
      F('C1', 'negotiating', 'negotiating, persuading'),
      G('C2', 'figures', 'figures of speech used aptly'),
      G('C2', 'complex-syntax', 'complex, fluid syntax'),
      V('C2', 'rare-idioms', 'rare idioms and wordplay'),
      V('C2', 'slang', 'slang and neologisms understood'),
      F('C2', 'fine-concessions', 'debating with fine concessions'),
      F('C2', 'register-switch', 'switching register on demand')
    ];
  })(),
  sheets: [],   // assigned below
  topics: [
    { lv: 'A2', t: 'Role play: at the bakery', fr: 'role play — you are the baker, the student is the customer; stay in role: ordering, paying, one question', tags: ['politeness', 'numbers', 'shopping'] },
    { lv: 'B1', t: 'Role play: a complaint', fr: 'role play — you are customer service, the student returns a broken item; ask questions, offer solutions, they must argue their case', tags: ['arguing a case', 'past tenses'] },
    { lv: 'B2', t: 'Hidden information: guess it', fr: 'hidden-information game — secretly invent their ideal weekend; they guess through questions, you answer only yes, no or almost', tags: ['questions', 'hypotheticals'] },
    { lv: 'A1', t: 'Introducing yourself', fr: 'introducing yourself: name, city, work, family', tags: ['be & have', 'numbers', 'jobs'] },
    { lv: 'A1', t: 'Ordering at a café', fr: 'ordering at a café: drinks, the bill', tags: ['I’d like', 'quantities', 'politeness'] },
    { lv: 'A1', t: 'My typical day', fr: 'the daily routine: morning, evening, times', tags: ['the time', 'present simple', 'adverbs of frequency'] },
    { lv: 'A1', t: 'My home', fr: 'describing your home and neighbourhood', tags: ['there is / are', 'prepositions', 'furniture'] },
    { lv: 'A2', t: 'Walks and nature', fr: 'walks, nature, trees, the seasons', tags: ['like + -ing', 'describing places', 'the weather'] },
    { lv: 'A2', t: 'Last weekend', fr: 'talking about your weekend', tags: ['past simple', 'time adverbs', 'first, then…'] },
    { lv: 'A2', t: 'Cooking and recipes', fr: 'cooking: favourite dishes, recipes, spices', tags: ['much / many', 'imperatives', 'I like'] },
    { lv: 'A2', t: 'Hobbies', fr: 'hobbies: drawing, music, sport', tags: ['play / do / go', 'for / since', 'pronouns'] },
    { lv: 'B1', t: 'Films and series', fr: 'talking about films and series: opinions, recommendations', tags: ['giving opinions', 'who / which', 'the past'] },
    { lv: 'B1', t: 'Plans and the future', fr: 'plans: travel, work, learning', tags: ['will vs going to', 'when + present', 'conditions'] },
    { lv: 'B1', t: 'Work and daily life', fr: 'work: a typical day, colleagues, meetings', tags: ['present perfect vs past simple', 'frequency', 'reported speech'] },
    { lv: 'B1', t: 'Defending an opinion', fr: 'defending a simple opinion: for or against', tags: ['because / so / however', 'conditionals', 'giving examples'] },
    { lv: 'B2', t: 'The news', fr: 'discussing a current topic', tags: ['the passive', 'phrasal verbs', 'hedging'] },
    { lv: 'B2', t: 'What if… (hypotheses)', fr: 'making hypotheses about your life', tags: ['second and third conditional', 'dreams', 'justifying'] },
    { lv: 'B2', t: 'City or countryside?', fr: 'debating: living in the city or the countryside', tags: ['arguing', 'although / despite', 'comparing'] },
    { lv: 'C1', t: 'Abstract ideas', fr: 'discussing abstract ideas: freedom, memory, time', tags: ['formal vocabulary', 'linkers', 'hypotheses'] },
    { lv: 'C1', t: 'Explaining your field', fr: 'explaining your field to a non-specialist', tags: ['specialist language', 'paraphrasing', 'precision'] },
    { lv: 'C2', t: 'Switching register', fr: 'saying the same thing in casual, neutral and formal register', tags: ['registers', 'idioms', 'subtleties'] }
  ],
  introTopics: [
    { t: 'Getting to know you: who are you?', fr: 'getting to know each other: who you are, what you do', tags: [] },
    { t: 'Your daily life and your week', fr: 'your routine, your week, your neighbourhood', tags: [] },
    { t: 'Your passions in detail', fr: 'your passions and why you are learning English', tags: [] }
  ],
  starter: [
    { t: 'Hello!', de: 'Hallo!', en: 'Hello!' },
    { t: 'Thank you very much.', de: 'Danke schön.', en: 'Thank you very much.' },
    { t: 'My name is…', de: 'Ich heiße…', en: 'My name is…' },
    { t: 'How are you?', de: 'Wie geht’s?', en: 'How are you?' },
    { t: 'Yes. / No.', de: 'Ja. / Nein.', en: 'Yes. / No.' },
    { t: 'I don’t understand.', de: 'Ich verstehe nicht.', en: 'I don’t understand.' },
    { t: 'Slower, please.', de: 'Langsamer, bitte.', en: 'Slower, please.' },
    { t: 'How do you say…?', de: 'Wie sagt man…?', en: 'How do you say…?' },
    { t: 'Goodbye!', de: 'Auf Wiedersehen!', en: 'Goodbye!' },
    { t: 'See you tomorrow!', de: 'Bis morgen!', en: 'See you tomorrow!' }
  ]
};

/* English cheat sheets (German glosses, the default native language). */
const S = (id: string, title: string, match: string[], core: string[], examples: { t: string; gloss: string }[], traps?: string[]): CheatSheet =>
  ({ id, lang: 'en', title, match, core, examples, traps });

en.sheets = [
  S('en-g-present-simple', 'Present simple & third-person -s', ['present simple'],
    ['I / you / we / they work — he / she / it workS',
     'Negation and questions with do/does: "He doesn’t work", "Does she work?"'],
    [{ t: 'She works in Hamburg.', gloss: 'Sie arbeitet in Hamburg.' },
     { t: 'Do you drink coffee?', gloss: 'Trinkst du Kaffee?' }],
    ['"He work" ✗ → "He works" ✓']),
  S('en-g-present-continuous', 'Present continuous vs simple', ['present continuous'],
    ['be + -ing for right now / temporary: "I’m working"',
     'Present simple for habits and facts: "I work every day"',
     'State verbs rarely continuous: know, like, want'],
    [{ t: 'I’m reading a great book at the moment.', gloss: 'Ich lese gerade ein tolles Buch.' },
     { t: 'I read every evening.', gloss: 'Ich lese jeden Abend.' }],
    ['"I’m knowing" ✗ → "I know" ✓']),
  S('en-g-past-simple', 'Past simple', ['past simple'],
    ['Finished past, often with a time: yesterday, in 2020, last week',
     'Regular: -ed (worked); irregular: went, had, made, saw, took',
     'Negation/questions with did: "I didn’t go", "Did you see it?"'],
    [{ t: 'Yesterday I went to the office early.', gloss: 'Gestern bin ich früh ins Büro gegangen.' },
     { t: 'Did you sleep well?', gloss: 'Hast du gut geschlafen?' }],
    ['"Did you went" ✗ → "Did you go" ✓']),
  S('en-g-present-perfect', 'Present perfect vs past simple', ['present perfect'],
    ['have/has + participle for past connected to now: ever, never, already, yet, just',
     'With a finished time (yesterday, in 2020) → past simple',
     '"I’ve lived here for ten years" = still true'],
    [{ t: 'Have you ever been to Rome?', gloss: 'Warst du schon mal in Rom?' },
     { t: 'I saw that film last week.', gloss: 'Ich habe den Film letzte Woche gesehen.' }],
    ['German "Ich habe gestern gearbeitet" → English past simple: "I worked yesterday", NOT present perfect']),
  S('en-g-going-to', 'Future: going to & will', ['going to', 'will'],
    ['going to = plan or visible evidence: "I’m going to visit them"',
     'will = spontaneous decision, prediction, promise: "I’ll help you"',
     'Timetabled events: present simple ("The train leaves at 9")'],
    [{ t: 'Look at those clouds — it’s going to rain.', gloss: 'Schau dir die Wolken an — es wird gleich regnen.' },
     { t: 'I’ll call you tomorrow.', gloss: 'Ich rufe dich morgen an.' }]),
  S('en-g-conditional-1-2', 'First & second conditional', ['conditional', 'if'],
    ['Real: If + present → will: "If it rains, we’ll stay in"',
     'Unreal: If + past → would: "If I had time, I would come"',
     'Never will/would directly after if'],
    [{ t: 'If you came, we would cook together.', gloss: 'Wenn du kämst, würden wir zusammen kochen.' },
     { t: 'If I were rich, I’d travel more.', gloss: 'Wenn ich reich wäre, würde ich mehr reisen.' }],
    ['"If I would have time" ✗ → "If I had time" ✓']),
  S('en-g-conditional-3', 'Third conditional', ['third conditional'],
    ['If + past perfect → would have + participle',
     '"If I had known, I would have come."'],
    [{ t: 'If we had left earlier, we wouldn’t have missed the train.', gloss: 'Wären wir früher los, hätten wir den Zug nicht verpasst.' }]),
  S('en-g-countable', 'Much, many, some, any', ['countable', 'much many'],
    ['many + countable (many friends), much + uncountable (much time)',
     'some in positives, any in negatives/questions',
     'a few / a little'],
    [{ t: 'How much time do we have?', gloss: 'Wie viel Zeit haben wir?' },
     { t: 'There aren’t any biscuits left.', gloss: 'Es sind keine Kekse mehr da.' }],
    ['"Informations" ✗ — information is uncountable']),
  S('en-g-for-since', 'For, since, already, yet', ['for since'],
    ['for + duration: for two years · since + starting point: since 2022',
     'already in positives, yet in negatives/questions',
     'Usually with the present perfect'],
    [{ t: 'I’ve known her since university.', gloss: 'Ich kenne sie seit der Uni.' },
     { t: 'Have you finished yet?', gloss: 'Bist du schon fertig?' }]),
  S('en-g-relative-clauses', 'Relative clauses', ['relative clauses', 'who which'],
    ['who = people, which = things, where = places; that often replaces both',
     'Object pronoun can drop: "the film (that) I saw"'],
    [{ t: 'That’s the word I was looking for.', gloss: 'Das ist das Wort, das ich gesucht habe.' },
     { t: 'The town where I grew up.', gloss: 'Die Stadt, in der ich aufgewachsen bin.' }]),
  S('en-g-passive', 'The passive', ['passive'],
    ['be + participle: "The house was built in 1900"',
     'Agent with by: "by my grandfather"',
     'Keeps the focus on the thing, not the doer'],
    [{ t: 'This book was written in 1950.', gloss: 'Dieses Buch wurde 1950 geschrieben.' },
     { t: 'My bike was stolen.', gloss: 'Mein Rad wurde gestohlen.' }]),
  S('en-g-reported-past', 'Reported speech', ['reported speech'],
    ['Backshift: "I’m tired" → He said he was tired',
     'will → would, can → could, past → past perfect',
     'Questions: He asked if / what…'],
    [{ t: 'She said she was working late.', gloss: 'Sie sagte, dass sie lange arbeitet.' },
     { t: 'He asked me what I did.', gloss: 'Er fragte mich, was ich mache.' }]),
  S('en-g-phrasal-verbs', 'Phrasal verbs', ['phrasal verbs'],
    ['verb + particle changes the meaning: give up, look after, run into',
     'Separable: "turn the light on / turn it on"; inseparable: "look after her"'],
    [{ t: 'I gave up sugar last year.', gloss: 'Ich habe letztes Jahr mit dem Zucker aufgehört.' },
     { t: 'Can you look after the plants?', gloss: 'Kannst du dich um die Pflanzen kümmern?' }]),
  S('en-g-gerund-infinitive', 'Gerund vs infinitive', ['gerund', 'infinitive'],
    ['enjoy / keep / avoid + -ing · want / decide / hope + to do',
     'stop doing (aufhören) vs stop to do (anhalten, um zu)',
     'remember doing (Erinnerung) vs remember to do (nicht vergessen)'],
    [{ t: 'I enjoy drawing in the evening.', gloss: 'Ich zeichne gern abends.' },
     { t: 'Remember to lock the door.', gloss: 'Vergiss nicht abzuschließen.' }],
    ['"I enjoy to draw" ✗ → "I enjoy drawing" ✓'])
];
