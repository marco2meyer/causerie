import type { Memory } from '../types';
import { PREFS_REV } from '../types';
import { normalizeAnalysis } from './anshape';
import { directionFrom } from './steer';
import { retireRecognition } from './srs';
import { scrubDeckHints } from './hints';

const LEGACY_KEY = 'causerie.mem.v1';
const memKey = (profileId: string) => 'causerie.mem:' + profileId;

/** Hook invoked after every save (used by sync for debounced pushes). */
let onSaveHook: ((m: Memory) => void) | null = null;
export function setOnSave(fn: ((m: Memory) => void) | null): void { onSaveHook = fn; }

let activeProfileId = 'default';
export function setActiveProfileId(id: string): void { activeProfileId = id; }
export function getActiveProfileId(): string { return activeProfileId; }

export function blankMem(): Memory {
  return {
    v: 2,
    prefsRev: PREFS_REV,
    createdAt: new Date().toISOString(),
    profile: { name: '', target: 'fr', support: 'de', native: 'de', persona: 'deadpan' },
    cefr: {
      overall: 2,
      skills: { grammar: 2, vocabulary: 2, fluency: 2, comprehension: 2 },
      confidence: 0.35,
      history: []
    },
    weaknesses: [],
    strengths: [],
    interests: [],
    facts: [],
    vocab: [],
    deck: { cards: [], log: [] },
    sessions: [],
    nextFocus: [],
    comp: {},
    pinned: [],
    checkins: { history: [] },
    xp: 0,
    streak: { count: 0, last: null },
    settings: {
      voice: 'marin', speed: 0.9,
      rtModel: 'gpt-realtime-2.1', analysisModel: 'gpt-5.6-sol',
      captions: false, eagerness: 'low',
      // Two sittings of eighteen is the review capacity the card factory is sized against;
      // see lib/budget for the arithmetic that ties the two halves of the day together.
      minutesHint: 8, sessionSize: 18, sessionsPerDay: 2, newPerSession: 4, newAuto: true, cardAudio: true,
      transcribeModel: 'gpt-transcribe', noiseReduction: 'near', noisyEnv: false, verbatim: true
    }
  };
}

/** Schema migrations. v1 (single-profile, no deck/facts) → v2. Newly added settings
 *  get their defaults filled in for any stored version. */
export function migrate(raw: unknown): Memory | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown> & Memory;
  const v = (raw as { v?: unknown }).v;
  if ((v === 1 || v === 2) && m.profile) {
    const base = blankMem();
    const settings = { ...base.settings, ...(m.settings as object) };
    // Superseded defaults move to the current ones — ONCE, guarded by prefsRev. Without the
    // guard these run on every load (migrate() is the read path, not a one-shot upgrade) and
    // a student who deliberately picks the old value can never make it stick.
    if ((m.prefsRev ?? 0) < 1) {
      if (settings.analysisModel === 'gpt-5.4-mini') settings.analysisModel = base.settings.analysisModel;
      // former 3/4-minute defaults → the 8-minute format
      if (settings.minutesHint === 3 || settings.minutesHint === 4) settings.minutesHint = base.settings.minutesHint;
      // 'auto' eagerness cut learners off mid-sentence while they searched for a word
      if (settings.eagerness === 'auto') settings.eagerness = base.settings.eagerness;
    }
    if ((m.prefsRev ?? 0) < 4) {
      // Captions stopped being a mode and became a gesture: nothing is shown until the
      // student asks for her line, and it fades once she has finished saying it. Standing
      // subtitles are still available for anyone who needs them, but they are no longer
      // what a call starts as, so the superseded default is flipped.
      if (settings.captions === true) settings.captions = base.settings.captions;
    }
    if ((m.prefsRev ?? 0) < 3) {
      // The day was creating up to sixteen cards against one fifteen-card evening, which is
      // a queue growing by ten a day. The rhythm moves to two slightly longer sittings and
      // the intake is handed to lib/budget, which sizes it from that capacity.
      if (settings.sessionSize === 15) settings.sessionSize = base.settings.sessionSize;
      if (settings.sessionsPerDay === undefined) settings.sessionsPerDay = base.settings.sessionsPerDay;
      if (settings.newPerSession === 8) settings.newAuto = true; // the superseded default
      if (settings.newAuto === undefined) settings.newAuto = true;
    }
    if ((m.prefsRev ?? 0) < 2) {
      // The streaming transcriber costs 3.8x the committed-turn one and its output is worse,
      // and nothing in this app displays the student's captions while the call is running.
      if (settings.transcribeModel === 'gpt-live-transcribe') settings.transcribeModel = base.settings.transcribeModel;
    }

    const out: Memory = {
      ...base,
      ...m,
      v: 2,
      profile: { ...base.profile, ...(m.profile as object) },
      facts: (m as Partial<Memory>).facts ?? [],
      deck: (m as Partial<Memory>).deck ?? { cards: [], log: [] },
      comp: (m as Partial<Memory>).comp ?? {},
      pinned: (m as Partial<Memory>).pinned ?? [],
      checkins: (m as Partial<Memory>).checkins ?? { history: [] },
      prefsRev: PREFS_REV,
      settings
    };
    // Analyses written before the shape was enforced at the door (lib/anshape) are still in
    // here, and a debrief is read months after the call that produced it. One correction
    // with no `original` threw out of the review's render and left a blank page where a
    // conversation was, so every stored report is put through the same door on the way out.
    for (const sess of out.sessions ?? []) {
      if (sess.analysis && typeof sess.analysis === 'object') sess.analysis = normalizeAnalysis(sess.analysis);
    }
    // The same call left a wordless entry in the vocabulary — applyAnalysis reads v.fr, and
    // the analysis had spelled it `term`, so it stored a date and nothing else. It is not
    // inert: the briefing and the word goals are both drawn from this list.
    out.vocab = (out.vocab ?? []).filter(v => v && String(v.fr ?? '').trim());
    // A direction written before the questions were kept with the answers reads as half a
    // sentence — "Alterne les deux" alternates what? The pairs are still in the record it
    // came from, so it can be rebuilt rather than waiting a week for the next check-in to
    // overwrite it. Only ever touched when it is EXACTLY the old bare-answers join, so a
    // direction already in the new shape is left alone.
    const last = out.checkins?.history?.[out.checkins.history.length - 1];
    if (last?.answers?.length && out.checkins?.direction) {
      const bare = last.answers.map(a => a.answer).filter(Boolean).join(' ; ');
      if (out.checkins.direction === bare) out.checkins.direction = directionFrom(last.answers);
    }
    // The paused shelf is gone from the deck screen, and with nowhere to see or restore
    // them a suspended card is not kept, only hidden. Whatever is still sitting there from
    // the A2 retirement goes on the way out. (Cards this deck holds are cheap to re-make
    // and the words themselves are still in the memory.)
    if (out.deck?.cards) {
      out.deck.cards = out.deck.cards.filter(c => (c as { state?: string }).state !== 'suspended');
    }
    // A learner who was already past A2 when this rule arrived should not have to wait for
    // their next call to stop being asked what words mean. Latched on the deck, so this is
    // a no-op from the second load on, and it never fights a card brought back by hand.
    retireRecognition(out);
    // Hints written before the no-giving-it-away rule existed: a cloze whose hint spelled
    // its own answer was a copying exercise the schedule kept rewarding as recall. Latched
    // on the deck like the retirement above, so it runs once and never fights a hand edit.
    if (out.deck && !out.deck.hintsScrubbed) {
      out.deck.hintsScrubbed = true;
      scrubDeckHints(out.deck.cards ?? []);
    }
    return out;
  }
  return null;
}

function read(key: string): Memory | null {
  try {
    const r = localStorage.getItem(key);
    return r ? migrate(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}

export function loadMemFor(profileId: string): Memory | null {
  return read(memKey(profileId));
}

/** Legacy single-profile memory, if this browser used the pre-profile version. */
export function loadLegacyMem(): Memory | null {
  return read(LEGACY_KEY);
}
export function clearLegacyMem(): void {
  localStorage.removeItem(LEGACY_KEY);
}

export function loadMem(): Memory | null {
  return loadMemFor(activeProfileId);
}

export function saveMemFor(profileId: string, m: Memory): void {
  try {
    m.updatedAt = new Date().toISOString();
    localStorage.setItem(memKey(profileId), JSON.stringify(m));
    onSaveHook?.(m);
  } catch (e) {
    console.warn('mem save failed', e);
  }
}

export function saveMem(m: Memory): void {
  saveMemFor(activeProfileId, m);
}

export function wipeMemFor(profileId: string): void {
  localStorage.removeItem(memKey(profileId));
}
export function wipeMem(): void {
  wipeMemFor(activeProfileId);
}
