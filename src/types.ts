/** Shared domain types. The persisted memory schema is versioned via Memory.v — bump and
 *  migrate in lib/storage.ts when it changes. */

export type CEFRBand = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type CEFRLevel =
  | 'A1' | 'A1+' | 'A2' | 'A2+' | 'B1' | 'B1+'
  | 'B2' | 'B2+' | 'C1' | 'C1+' | 'C2' | 'C2+';

export type SkillKey = 'grammar' | 'vocabulary' | 'fluency' | 'comprehension';
export type WeaknessStatus = 'new' | 'persisting' | 'improving' | 'resolved';
export type Persona = 'deadpan' | 'warm';
export type LangCode = 'fr' | 'es' | 'it' | 'en' | 'pt';

export interface Evidence { quote: string; src: string }

export interface Weakness {
  id: string;
  label: string;
  cefr: CEFRBand | '';
  status: WeaknessStatus;
  firstSeen: string;
  lastSeen: string;
  timesWorked: number;
  evidence: Evidence[];
}

export interface Strength { id: string; label: string; lastSeen: string; evidence: Evidence[] }
export interface Interest { label: string; weight: number; lastSeen: string }
/** One vocabulary item the analysis surfaced: the target-language word, its
 *  native-language gloss, and the sentence from the conversation it came up in. */
export interface VocabItem { fr: string; de: string; ex: string }
export interface VocabEntry { fr: string; de: string; ex?: string; date: string }
export interface NextFocus { label: string; cefr: CEFRBand | string; grund?: string }

export interface TranscriptItem { id?: string; role: 'user' | 'assistant'; text: string; final?: boolean }

/** One word the call pushes the learner to actually say (see lib/wordgoal.ts). Shown on the
 *  call screen until it is placed; the tutor is briefed to build an opening for it. */
export interface WordGoal {
  /** The target-language word or short phrase to place in the conversation. */
  word: string;
  /** Its native-language gloss, shown small under the word. */
  gloss: string;
  /** What the deck says about it: recognized but never produced, kept failing, never seen
   *  in the production direction, or met in a conversation and never carded. */
  why: 'passive' | 'lapsed' | 'unused' | 'fresh';
  /** The deck card it came from, when it came from one. */
  cardId?: string;
}

/** A word goal as it ended the call. */
export interface WordGoalResult { word: string; used: boolean }

export interface FocusTarget {
  kind: 'weakness' | 'suggestion' | 'vocab' | 'comp';
  id: string | null;
  label: string;
  cefr: string;
  status: WeaknessStatus;
}

/* ---------- competency map (islands of knowledge across A1–C2) ---------- */

export type CompCategory = 'grammaire' | 'vocabulaire' | 'fonctions';
export type CompStatus = 'ok' | 'ko' | 'partial';
/** One cell of the A1–C2 competency matrix; absence of an entry = no data yet (grey). */
export interface CompEntry { status: CompStatus; lastSeen: string; evidence?: string }

/** Configuration of one upcoming/running call. */
export interface CallSession {
  topic: string;
  topicFr?: string;
  level?: CEFRBand;
  targets: FocusTarget[];
  /** 'intro' = getting-to-know-you call (first three), 'daily' = normal short call. */
  mode?: 'intro' | 'daily';
  /** Target call length in minutes. */
  minutes?: number;
  /** Cheat-sheet ids attached to this call (0-2), reviewable before and during it. */
  materials?: string[];
  /** Words this call asks the learner to place in the conversation (0-2). */
  wordGoals?: WordGoal[];
  /** The 2-3 vocabulary or grammar fields this subject was chosen to force. The tutor is
   *  told to feed words a step above the learner's level; without these she has to guess
   *  which words, and guesses the same safe ones every call. */
  topicTags?: string[];
}

/* ---------- analysis output (mirrors the JSON schema sent to the model) ---------- */

export interface Correction {
  user_turn: number;
  original: string;
  besser: string;
  erklaerung: string;
  category: 'grammar' | 'vocab' | 'phrase' | 'pronunciation' | 'register';
  cefr_topic: string;
  /** Cloze exercise built from the corrected sentence: gap marked with ___. */
  cloze_text: string;
  cloze_answer: string;
  /** Short German cue shown with the gap. */
  hint: string;
}
export interface Highlight { user_turn: number; quote: string; kommentar: string }
export interface AnalysisCefr {
  overall: CEFRLevel; grammar: CEFRLevel; vocabulary: CEFRLevel;
  fluency: CEFRLevel; comprehension: CEFRLevel;
  confidence: number; begruendung: string;
}
export interface AnalysisWeakness { id: string | null; label: string; cefr: CEFRBand; status: WeaknessStatus; evidence: string }
export interface AnalysisStrength { id: string | null; label: string; evidence: string }
export interface TargetResult { label: string; achieved: boolean; evidence: string }

export interface Analysis {
  hauptpunkt: string;
  kommentar: string;
  cefr: AnalysisCefr;
  corrections: Correction[];
  highlights: Highlight[];
  new_vocab: VocabItem[];
  weaknesses: AnalysisWeakness[];
  strengths: AnalysisStrength[];
  interests: string[];
  /** Personal facts the student revealed (French noun phrases, selective). */
  facts: { text: string; category: FactCategory }[];
  /** Memory curation: stored fact ids and interest labels to drop as trivial/outdated. */
  prune: { facts: string[]; interests: string[] };
  /** Observations mapped onto the A1–C2 competency library (islands of knowledge). */
  competencies: {
    id: string | null;
    label: string;
    category: CompCategory;
    cefr: CEFRBand;
    status: 'demonstrated' | 'failed' | 'partial';
    evidence: string;
  }[];
  targets: TargetResult[];
  next_focus: { label: string; cefr: CEFRBand; grund: string }[];
  topics: string[];
  _model?: string;
  /** False when this report came from the schema-less fallback, i.e. its shape was the
   *  model's choice rather than the schema's. Absent on every normal analysis. */
  _schema?: boolean;
  /** Token usage reported by the analysis call, for pricing the leg. */
  _usage?: Record<string, unknown>;
}

/* ---------- persisted memory ---------- */

export type FactCategory = 'arbeit' | 'familie' | 'alltag' | 'vorlieben' | 'orte' | 'sonstiges';
export interface Fact {
  id: string;
  text: string;
  category: FactCategory;
  firstSaid: string;
  lastSaid: string;
}

/* ---------- spaced repetition (Fluent-Forever-style deck) ---------- */

export type CardType = 'cloze' | 'fr2de' | 'de2fr';
export type CardState = 'new' | 'learning' | 'review';
export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface Card {
  id: string;
  type: CardType;
  front: string;
  back: string;
  hint?: string;
  example?: string;
  /** Target-language text spoken by TTS on reveal. */
  audioText?: string;
  tag?: string;
  sourceKind: 'correction' | 'vocab' | 'seed' | 'manual';
  sourceSessionId?: string;
  /** Creation moment (epoch ms). `createdAt` is a date, so it cannot say whether a card
   *  was made before or after a call that happened the same day. Absent on older cards. */
  createdTs?: number;
  /** Transcript turn this card was forged from, so the conversation can show where a
   *  card came from instead of leaving the act of making one invisible. */
  sourceTurnId?: string;
  /** User-pinned in the post-call review: always scheduled, ahead of everything else. */
  starred?: boolean;
  /** A personal image exists for this card (the image itself lives in the image store,
   *  outside the synced memory blob — see lib/imgstore). */
  img?: 1;
  createdAt: string;
  /* SM-2 state */
  state: CardState;
  /** Most recent self-assessment, for the status filter (absent before first review). */
  lastGrade?: Grade;
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  due: string;
}

export interface ReviewLogEntry {
  date: string;
  total: number;
  /** Cards seen for the FIRST time in this sitting. The deck's throughput is not the number
   *  of reviews — it is how many cards actually left the unstarted pile — and nothing was
   *  recording it, so "am I keeping up" could only ever be answered from settings rather
   *  than from what the student did. Absent on sittings logged before this was written. */
  started?: number;
  /** Set on the capped pre-call warm-up (three cards). It earns its XP and counts for the
   *  streak like any review, but three cards are not one of the day's planned sittings. */
  warmup?: 1;
  again: number;
  hard: number;
  good: number;
  easy: number;
  seconds: number;
  xp: number;
}

export interface Deck {
  cards: Card[];
  log: ReviewLogEntry[];
  /** Set the one time the learner's recognition cards are retired on reaching A2, so the
   *  rule cannot re-suspend a card the student has deliberately brought back. */
  recogRetired?: boolean;
  /** Set the one time every stored hint was checked for giving its answer away, so a hint
   *  the learner then rewrote by hand is never rewritten again underneath them. */
  hintsScrubbed?: boolean;
}

export interface SessionRecord {
  id: string;
  date: string;
  /** When the call was recorded (ISO). `date` alone cannot order two calls in one day,
   *  which is what "the cards from this session" needs. Absent on older records. */
  at?: string;
  topic: string;
  source: 'duolingo' | 'causerie';
  minutes: number | null;
  seconds?: number;
  level?: CEFRLevel;
  targets?: FocusTarget[];
  transcript?: TranscriptItem[];
  analysis?: Analysis | null;
  xp?: number;
  summary?: string;
  cardsAdded?: number;
  /** Utterance fluency: words per minute of the learner's own speech (from the verbatim transcript). */
  wpm?: number;
  /** Share of the call's words that were Odile's, 0..1. The tutor talking more than the
   *  student is the commonest failure of a conversation lesson and the app could not see
   *  it happening; see lib/talk. */
  tutorShare?: number;
  /** Continuous re-transcription of the learner's own mic recording, verbatim. The turn
   *  transcript above comes from live ASR on VAD-committed slices and quietly tidies errors
   *  up; this is what the learner actually said, and it is the text to judge mistakes from. */
  verbatim?: string;
  /** What this call cost, leg by leg. Estimated on the client from the same price table the
   *  server bills on, so it reads the same whether the key is the server's or the user's. */
  costs?: CostLeg[];
  /** The active-vocabulary pushes this call carried, and whether they were placed. Kept so
   *  the next calls can pick other words and the review can say what was asked. */
  wordGoals?: WordGoalResult[];
  /** What Odile was actually told, resolved, for THIS call: the briefing template with
   *  every placeholder filled from the memory as it stood that day. The template in the
   *  settings only ever shows what she would be told now, so a change to the prompt — or
   *  to what the memory holds — silently rewrites the past and there is no way to ask what
   *  she was working from when a call went well or badly. Roughly 9 kB a call, alongside
   *  transcripts that are already larger. */
  briefing?: string;
  /** Cheat-sheet ids attached to this call. Kept so the next call can pick sheets the
   *  student has NOT just read — without this the top weakness's sheet came up every day
   *  and the rest of the library was never opened (see lib/sheets sheetsForCall). */
  materials?: string[];
}

/** One billable leg of a call. The speech-to-speech engine has four: the conversation
 *  itself, the captions running beside it, the post-call verbatim pass (one entry per
 *  recorder segment), and the analysis. The turn-by-turn engine takes the conversation
 *  apart instead and bills its three pieces separately — `stt` hears the student, `chat`
 *  is Odile's thinking, `tts` is her voice — and has no captions or verbatim leg at all,
 *  because its one transcription pass already serves all three purposes. */
export interface CostLeg {
  kind: 'realtime' | 'captions' | 'verbatim' | 'analysis' | 'stt' | 'chat' | 'tts';
  model: string;
  usd: number;
}

export interface CefrState {
  /** Index into LEVELS (0 = A1 … 11 = C2+). */
  overall: number;
  skills: Record<SkillKey, number>;
  confidence: number;
  history: { date: string; overall: number; skills: Record<SkillKey, number>; source?: string }[];
}

/** Bumped when a stored DEFAULT changes and existing profiles should follow. Migration
 *  coercions run once per revision, so a value the student later chooses on purpose sticks
 *  instead of being reset on every load. */
/** What a finished week did to the rank. */
export type RankVerdict = 'up' | 'hold' | 'down';

/** One judged week, kept so a check-in can say what actually happened rather than only
 *  where the learner ended up. `level` is the rank the week was LIVED at, before the
 *  verdict moved it. */
export interface JudgedWeek {
  week: string;
  verdict: RankVerdict;
  level: number;
  xp: number;
}

export const PREFS_REV = 4;

/** Which engine carries the call. 'realtime' is the speech-to-speech model (the default:
 *  she hears the student's actual voice and can be interrupted mid-sentence). 'turns' is
 *  the cascade — transcribe, think, speak — one turn at a time, at a fraction of the
 *  price. See lib/turncall.ts for what each one buys and gives up. */
export type CallEngineKind = 'realtime' | 'turns';

export interface Settings {
  voice: string;
  speed: number;
  rtModel: string;
  /** Engine for the daily call. Unset = 'realtime'. */
  callEngine?: CallEngineKind;
  /** Text model that plays Odile in the turn-by-turn engine. */
  turnModel?: string;
  /** Turn-by-turn engine: end the student's turn on a silence (as the call model does),
   *  or only when they tap the button. Unset = 'auto'. */
  turnCommit?: 'auto' | 'button';
  analysisModel: string;
  captions: boolean;
  eagerness: 'low' | 'auto' | 'high';
  /** Target call length in minutes (the daily 3–5 min conversation). */
  minutesHint: number;
  /** Evening review session size (Fluent-Forever style, default 15). */
  sessionSize: number;
  /** Max new cards introduced per review session. Read through lib/budget's newPerSession,
   *  which sizes it from the review capacity unless `newAuto` is explicitly off. */
  newPerSession: number;
  /** Let the app size the new-card intake, and the card factory, from the review rhythm
   *  (lib/budget). Default on; setting the pill by hand turns it off. */
  newAuto?: boolean;
  /** Review sessions the day is planned around (1 or 2). Two short ones beat one long one:
   *  the second sitting is spaced repetition of the first. */
  sessionsPerDay?: number;
  /** Auto-play French audio on card reveal. */
  cardAudio: boolean;
  /** Live in-call transcription model (July 2026: gpt-live-transcribe). */
  transcribeModel: string;
  /** Input noise reduction on the realtime session. */
  noiseReduction: 'off' | 'near' | 'far';
  /** Loud environment: stricter server VAD instead of semantic VAD. */
  noisyEnv: boolean;
  /** Post-call verbatim re-transcription of the raw mic recording (error ground truth). */
  verbatim: boolean;
  /** UI language: 'auto' = target language from B1, support language below. */
  uiLang?: 'auto' | 'target' | 'support';
  /** Review session: record the spoken answer before the reveal (self-comparison). */
  speakAnswers?: boolean;
  /** Offer the 4/3/2 fluency retell after the daily call (optional exercise). */
  retell?: boolean;
}

export interface Profile {
  name: string;
  target: LangCode;
  support: 'de' | 'en';
  /** Native language, used inside the tutor briefing and analysis. */
  native: 'de' | 'en';
  persona: Persona;
  /** Started as an absolute beginner ("0"): the tutor leads in the native language
   *  and teaches survival phrases until the level clears A1. */
  a0?: boolean;
}

/* ---------- periodic check-ins (weekly / monthly / quarterly) ---------- */

export type CheckinPeriod = 'week' | 'month' | 'quarter';
export interface CheckinAnswer { question: string; answer: string }
export interface CheckinRecord {
  id: string;
  date: string;
  period: CheckinPeriod;
  titre: string;
  progres: string[];
  motifs: string[];
  cap: string;
  answers: CheckinAnswer[];
}
export interface CheckinState {
  lastWeekly?: string;
  lastMonthly?: string;
  lastQuarterly?: string;
  /** Direction the student chose at the last check-in; fed into the tutor briefing. */
  direction?: string;
  /** Put off on this date. The review comes back tomorrow rather than on the next open. */
  snoozedOn?: string;
  history: CheckinRecord[];
}

export interface Memory {
  v: 2;
  /** Which round of default-preference migrations this memory has already been through. */
  prefsRev?: number;
  createdAt: string;
  updatedAt?: string;
  profile: Profile;
  cefr: CefrState;
  weaknesses: Weakness[];
  strengths: Strength[];
  interests: Interest[];
  facts: Fact[];
  vocab: VocabEntry[];
  deck: Deck;
  sessions: SessionRecord[];
  nextFocus: NextFocus[];
  /** Competency matrix data: library id → observed status (missing id = no data). */
  comp: Record<string, CompEntry>;
  /** Library ids the user pinned as content of the next call (cleared after it). */
  pinned: string[];
  checkins: CheckinState;
  xp: number;
  /** `repairs` are banked missed days (max RANK/streak cap): one earned per five
   *  uninterrupted days, spent automatically to bridge a gap. */
  streak: { count: number; last: string | null; repairs?: number };
  /** Weekly rank. `settled` is the Monday of the last week that has been judged, so a
   *  week is counted exactly once however often the app is opened. */
  rank?: { level: number; settled: string; history?: JudgedWeek[] };
  /** Set when the getting-to-know-you phase is finished or skipped. */
  introDone?: boolean;
  /** 4/3/2 fluency retells: one entry per run (words + wpm per shrinking round). */
  fluency?: { date: string; topic: string; words: number[]; wpm: number[] }[];
  /** User-edited tutor briefing template ({{placeholder}} syntax); unset = built-in default. */
  tutorTemplate?: string;
  sync?: { token: string; enabled: boolean };
  settings: Settings;
}
