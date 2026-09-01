import type { CEFRBand, CompCategory, LangCode } from '../types';
import type { UIStrings } from './fr';

/** One file per language: EVERYTHING language-specific lives in src/lang/<code>.ts —
 *  UI strings, the tutor briefing and stage notes, the A1–C2 competency map, the
 *  cheat-sheet library and the topic catalogue. Components and libs stay abstract and
 *  read the active pack. `UIStrings` is inferred from the French pack, so a missing or
 *  extra key in any other pack is a compile error, not a runtime surprise. */

export interface CompItem {
  id: string;
  cat: CompCategory;
  band: CEFRBand;
  label: string;
}

export interface CheatSheet {
  id: string;                    // matches a competency id where possible
  lang: LangCode;
  title: string;
  match: string[];               // keywords matched against target/probe labels
  core: string[];                // the rule in <=6 lines
  examples: { t: string; gloss: string }[];
  traps?: string[];
}

export interface Topic {
  lv: CEFRBand;
  /** Card title shown to the student (target language). */
  t: string;
  /** Topic phrase handed to the tutor. */
  fr: string;
  /** Vocab/grammar goals shown on the card. */
  tags: string[];
}

export interface TutorPack {
  /** Briefing template, entirely in the target language, with {{placeholders}}. */
  template: string;
  persona: { deadpan: string; warm: string };
  /** "# Today" block for the getting-to-know-you calls; n = 1-based number of this intro call (1-3). */
  todayIntro: (n: number) => string;
  /** "# Today" block for a normal call. */
  todayTopic: (topic: string) => string;
  /** Appended to the topic block: the vocabulary fields the subject was chosen to force. */
  todayFields: (fields: string) => string;
  /** Absolute-beginner block ({{langue}}/{{native}} placeholders, resolved separately):
   *  the student knows (almost) none of the target language yet. */
  a0: string;
  /** Cross-language interference note ({{langue}}/{{autres}}), added when the student
   *  learns several related languages in parallel. */
  interference: string;
  /** Added to the briefing when she has been out-talking the student across recent calls
   *  (see lib/talk). `pct` is her share of the words, so the correction is specific rather
   *  than a general plea to talk less. */
  talkHog: (pct: number) => string;
  levelBeingEstablished: { niveau: string; confiance: string };
  fallbacks: { student: string; noTargets: string; noProbes: string; noDirection: string; noFacts: string; noInterests: string; noWeaknesses: string; firstCall: string };
  /** Opening cue for intro calls; n = 1-based number of this intro call. From call 2 on,
   *  Odile must NOT introduce herself again and must build on what she already knows. */
  greetIntro: (name: string, n: number) => string;
  /** Opening cue for a normal call. `minutes` so the student hears the shape of the next
   *  few minutes — the topic alone left them guessing what the call was for. */
  greetDaily: (name: string, topic: string, minutes: number) => string;
  /** Silent stage directions injected mid-call. */
  notes: {
    materialPause: string; materialBack: string; oneMinute: string; timeUp: string; overtime: string;
    /** The pause button: hold everything, say nothing, and do not hang up — and, on
     *  the way back, pick the thread up without turning the interruption into a topic. */
    paused: string; resumed: string;
    /** Appended to the briefing by the turn-by-turn engine only: nobody can interrupt
     *  anybody, she is reading a transcript rather than hearing a voice, and hanging up is
     *  a sentinel at the end of her last message instead of a tool call. */
    turnMode: string;
    /** An active-vocabulary push appeared on the student's screen: build an opening for the
     *  word without ever saying it. */
    wordGoal: (word: string) => string;
    /** They placed it: react as a person, not as a scoreboard. */
    wordGoalDone: (word: string) => string;
  };
  /** Headings and category names for the student's portrait, in the target language
   *  (see lib/portrait). `basics` introduces the settled facts, `passing` the incidental
   *  ones the tutor should use at most one of. */
  facts: {
    cats: Record<string, string>;
    basics: string;
    passing: string;
    none: string;
  };
  /** Session-record phrasing (stored in memory, fed back into later briefings). */
  records: { themes: string; callOf: string; fixFront: (original: string) => string };
}

export interface LangPack {
  code: LangCode;
  /** Date locale, e.g. 'fr-FR'. */
  locale: string;
  /** The language's name in itself ('Français', 'Italiano', …) for language pickers. */
  self: string;
  /** The language's name as used inside sentences of the tutor briefing ('français', 'English'). */
  langName: string;
  flag: string;
  /** English name, used in model instructions (analysis, transcription, image prompts). */
  en: string;
  /** Names of the student's possible native languages, in THIS language. */
  natives: Record<'de' | 'en', string>;
  ui: UIStrings;
  tutor: TutorPack;
  comp: CompItem[];
  sheets: CheatSheet[];
  topics: Topic[];
  introTopics: { t: string; fr: string; tags: string[] }[];
  /** Survival starter deck for absolute beginners (glosses in both support languages). */
  starter: { t: string; de: string; en: string }[];
}

/* Factories keeping the competency lists terse inside packs. */
export const compG = (pre: string) => (band: CEFRBand, id: string, label: string): CompItem =>
  ({ id: `${pre}g-${band.toLowerCase()}-${id}`, cat: 'grammaire', band, label });
export const compV = (pre: string) => (band: CEFRBand, id: string, label: string): CompItem =>
  ({ id: `${pre}v-${band.toLowerCase()}-${id}`, cat: 'vocabulaire', band, label });
export const compF = (pre: string) => (band: CEFRBand, id: string, label: string): CompItem =>
  ({ id: `${pre}f-${band.toLowerCase()}-${id}`, cat: 'fonctions', band, label });
