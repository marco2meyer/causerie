import type { Analysis, Card, Correction, Deck, Grade, Memory, VocabItem } from '../types';
import { changedWords, goalCore, norm, todayISO, uid } from './utils';
import { hintLeaks, scrubHint } from './hints';

/** Fluent-Forever-style spaced repetition on SM-2 scheduling.
 *  Cards come from the user's own conversations: cloze cards from corrected mistakes,
 *  bidirectional vocab cards with the sentence they actually heard or said. */

/* Grade order for the grade bar; labels come from the UI language pack (ui().rev.grades). */
export const GRADE_ORDER: Grade[] = ['again', 'hard', 'good', 'easy'];

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function newCard(partial: Omit<Card, 'id' | 'createdAt' | 'state' | 'ease' | 'interval' | 'reps' | 'lapses' | 'due'>): Card {
  const today = todayISO();
  return {
    id: uid('c'), createdAt: today, createdTs: Date.now(),
    state: 'new', ease: 2.5, interval: 0, reps: 0, lapses: 0, due: today,
    ...partial
  };
}

/** SM-2 with Anki-style four grades. Mutates and returns the card.
 *  Lapses keep HALF the previous interval (Anki/FSRS practice) instead of a full
 *  reset to day 1 — a mature card knocked back by one bad evening returns to ~50%,
 *  not to zero. The in-session relearn pass then restores that halved interval. */
export function grade(card: Card, g: Grade, today = todayISO()): Card {
  card.lastGrade = g;
  if (g === 'again') {
    card.lapses += 1;
    card.reps = 0;
    card.interval = Math.floor(card.interval * 0.5); // keep half; 0 for young cards
    card.ease = Math.max(1.3, card.ease - 0.2);
    card.state = 'learning';
    card.due = today; // requeued within the session
    return card;
  }
  const relearn = card.state === 'learning' && card.interval >= 1;
  if (g === 'hard') {
    card.interval = Math.max(1, Math.round(Math.max(1, card.interval) * 1.2));
    card.ease = Math.max(1.3, card.ease - 0.15);
  } else if (g === 'good') {
    card.interval = relearn ? card.interval // back at the kept half-interval
      : card.interval <= 0 ? 1 : card.interval === 1 ? 3 : Math.round(card.interval * card.ease);
  } else {
    card.interval = relearn ? Math.max(2, Math.round(card.interval * 1.5))
      : card.interval <= 0 ? 3 : Math.round(card.interval * card.ease * 1.3);
    card.ease += 0.15;
  }
  card.reps += 1;
  card.state = 'review';
  card.due = addDays(today, card.interval);
  // A pin has done its job once the card sits well; hard keeps it prioritized.
  if (g !== 'hard' && card.starred) card.starred = false;
  return card;
}

/** Days the grade would schedule, for the grade-button previews (0 = right now). */
export function previewDays(card: Card, g: Grade): number {
  if (g === 'again') return 0;
  const c = { ...card };
  grade(c, g);
  return c.interval;
}

export function dueCounts(deck: Deck, today = todayISO()) {
  const active = deck.cards;
  return {
    due: active.filter(c => c.state !== 'new' && c.due <= today).length,
    fresh: active.filter(c => c.state === 'new').length,
    total: active.length
  };
}

/** Builds tonight's queue: overdue reviews first, then new cards, capped at sessionSize.
 *  Starred cards (pinned by the user in the post-call review) always make the session
 *  and come first, regardless of the new-card cap.
 *
 *  `reachAhead` is the sitting beyond the day's plan. The production direction of a vocab
 *  pair is dated ten days behind its recognition twin, so a deck can hold twenty unstarted
 *  cards and still build an empty queue — which read, correctly and uselessly, as "nothing
 *  to review" next to a screen saying twenty-one new cards. When the plan is done and there
 *  is genuinely nothing else, the queue reaches past the stagger and takes the cards
 *  closest to their date. A fallback, never a first choice: a card studied ten days early
 *  is worth less than the same card studied on time, so this only ever fires into a queue
 *  that would otherwise be empty. */
export function buildSession(
  deck: Deck, sessionSize: number, newPerSession: number, today = todayISO(), reachAhead = false,
  /** Reviews this sitting may take, so a day's work can be shared between the day's
   *  sittings instead of the first one swallowing all of it (lib/budget sittingPlan).
   *  Undefined means what it always meant: take everything owed. */
  dueCap?: number
): Card[] {
  const active = deck.cards;
  const due = active
    .filter(c => c.state !== 'new' && c.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
  const byAge = (a: Card, b: Card) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  const ready = active.filter(c => c.state === 'new' && c.due <= today).sort(byAge);
  // Only when the day is otherwise finished: no reviews owed and no new card on its date.
  const waiting = reachAhead && due.length === 0 && ready.length === 0
    ? active.filter(c => c.state === 'new').sort((a, b) => a.due.localeCompare(b.due) || byAge(a, b))
    : [];
  const freshAll = ready.length ? ready : waiting;
  const starredFresh = freshAll.filter(c => c.starred);
  const fresh = [...starredFresh, ...freshAll.filter(c => !c.starred)]
    .slice(0, newPerSession + starredFresh.length); // pins come on top of the cap
  const starred = (l: Card[]) => l.filter(c => c.starred);
  const rest = (l: Card[]) => l.filter(c => !c.starred);
  // This sitting's share of what is owed, oldest first and pinned cards ahead of the rest,
  // so a smaller share is still the most overdue part of the pile rather than a slice of it.
  const share = dueCap == null ? due : [...starred(due), ...rest(due)].slice(0, Math.max(0, dueCap));
  // Backlog autoscaling: the session grows with the due pile (up to 2× the setting),
  // so a travel week does not silently break the spacing schedule.
  const cap = Math.max(sessionSize, Math.min(share.length, sessionSize * 2));
  return [...starred(share), ...starred(fresh), ...rest(share), ...rest(fresh)].slice(0, cap);
}

const cardKey = (c: Pick<Card, 'type' | 'front'>) => c.type + '|' + norm(c.front);

/** Should the reveal show the example line under the answer?
 *
 *  Only when it says something the answer did not. A cloze's example is the corrected
 *  sentence, i.e. the front with the gap filled in — printing it under the answer showed the
 *  same result twice, once large and once small, on nearly every card of a session. Vocab
 *  cards whose "example" is the bare word again fall to the same test. */
export function showExample(c: Pick<Card, 'type' | 'front' | 'back' | 'example'>): boolean {
  const ex = norm(c.example);
  if (!ex) return false;
  if (ex === norm(c.back) || ex === norm(c.front)) return false;
  if (c.front.includes('___') && norm(c.front.replace(/_{2,}/g, ' ' + c.back + ' ')) === ex) return false;
  return true;
}

/** A usable cloze: has a gap, and the gap tests the MISTAKE, not a phrase the student
 *  already had right. Oversized answers, or multi-word answers made almost entirely of
 *  words present in the student's own (wrong) sentence, fall back to fix-the-sentence. */
const validCloze = (c: Correction): boolean => {
  if (!c.cloze_text || !c.cloze_text.includes('___') || !c.cloze_answer) return false;
  const words = c.cloze_answer.trim().split(/\s+/);
  if (words.length > 3 || c.cloze_answer.length > 24) return false;
  if (words.length >= 2 && c.original) {
    const orig = norm(c.original);
    const big = words.filter(w => w.length > 2);
    const known = big.filter(w => orig.includes(norm(w))).length;
    if (big.length >= 2 && known === big.length) return false; // gap swallowed what the student said correctly
  }
  return true;
};
import { pack } from '../lang';
const fixFront = (c: Correction, lang?: string): string => pack(lang).tutor.records.fixFront(c.original);

/** The deck card for one correction: its cloze, or a fix-the-sentence fallback when the
 *  analysis produced no usable gap (used when the user pins a correction by hand). */
/** Coarse lifecycle bucket for filtering: new → learning (in between) → learned.
 *  "Learned" follows the classic mature threshold: an interval of 21+ days. */
export type CardStage = 'new' | 'learning' | 'learned';
export const MATURE_DAYS = 21;

export function cardStage(c: Card): CardStage {
  if (c.state === 'new') return 'new';
  return c.state === 'review' && c.interval >= MATURE_DAYS ? 'learned' : 'learning';
}

/** Was the LAST self-assessment a pass? null before the first review. */
export function lastKnown(c: Card): boolean | null {
  if (!c.lastGrade) return null;
  return c.lastGrade === 'good' || c.lastGrade === 'easy';
}

/** The cards from the latest conversation, plus anything added by hand since it -- the
 *  batch the Cards list shows on top under "new here". Anchored on the session record
 *  rather than on page load, so closing the app does not lose the group, and it clears
 *  by itself once the next call's cards arrive. Seeded cards never count as new. */
export function latestBatchIds(mem: Pick<Memory, 'deck' | 'sessions'>, today = todayISO()): Set<string> {
  const calls = (mem.sessions ?? []).filter(s => s.source === 'causerie');
  const last = calls[calls.length - 1];
  const ids = new Set<string>();
  // Hand-made cards join the batch only if they were made AFTER the last call. Comparing
  // dates could not tell that from "made this morning, before it", so a card built out of
  // an earlier conversation the same day showed up under "this session". Before the first
  // call there is nothing to be after, and today's own cards stand in.
  const cutoff = last
    ? (last.at ? Date.parse(last.at) : null)
    : Date.parse(today + 'T00:00:00');
  for (const c of mem.deck.cards) {
    if (c.sourceKind === 'seed') continue;
    if (last && c.sourceSessionId === last.id) { ids.add(c.id); continue; }
    if (c.sourceSessionId) continue;                       // belongs to some other call
    if (cutoff === null || c.createdTs === undefined) continue; // pre-dates the stamps
    if (c.createdTs >= cutoff) ids.add(c.id);
  }
  return ids;
}

export function cardFromCorrection(c: Correction, sessionId: string, lang?: string): Card {
  const ok = validCloze(c);
  // What the card is asking the learner to produce, which is exactly what its hint may not
  // name. For a gap that is the gap's answer; for the fix-the-sentence shape it is the words
  // the correction actually changed, so an explanation may still quote the rest of the line.
  const asked = ok ? c.cloze_answer : changedWords(c.original || '', c.besser || '').filter(w => w.ch).map(w => w.w).join(' ');
  return newCard({
    type: 'cloze',
    front: ok ? c.cloze_text : fixFront(c, lang),
    back: ok ? c.cloze_answer : c.besser,
    // erklaerung is the fallback it always was, but it is an explanation of the mistake and
    // routinely spells the correct form out. A purpose-written hint can be masked word by
    // word and still read; a sentence with holes punched in it cannot, so the explanation is
    // taken whole or not at all.
    hint: scrubHint(c.hint, asked) ?? (hintLeaks(c.erklaerung, asked) ? undefined : c.erklaerung || undefined),
    example: c.besser,
    audioText: c.besser,
    tag: c.cefr_topic || c.category,
    sourceKind: 'correction',
    sourceSessionId: sessionId
  });
}

/** The target-language word a card is about, whichever way round the card asks it.
 *  fr2de shows the word and asks for the meaning; de2fr asks the other way; a cloze's
 *  answer IS the word. Empty when the card has no word to speak of. */
export function conceptKey(c: Pick<Card, 'type' | 'front' | 'back'>): string {
  // Stripped the way a word goal is stripped (lib/utils goalCore), and for the same reason:
  // a vocabulary card holds a dictionary entry, "la séance", while the cloze made from the
  // same word holds what the learner has to produce, "séance". Nobody would call those two
  // different concepts, and without this the picture drawn on one never reaches the other.
  return goalCore(c.type === 'fr2de' ? c.front : c.back).join(' ');
}

/** Every card in the deck teaching the same word as this one, itself included.
 *
 *  A word is never one card. Vocabulary arrives as a pair — recognition now, production ten
 *  days behind it — and a correction about the same word adds a cloze on top, so the deck
 *  routinely holds three cards for one concept. A picture belongs to the concept, not to
 *  whichever of the three happened to be on screen when it was drawn. */
export function sameConceptCards(deck: Deck, card: Pick<Card, 'id' | 'type' | 'front' | 'back'>): Card[] {
  const k = conceptKey(card);
  if (!k) return deck.cards.filter(c => c.id === card.id);
  return deck.cards.filter(c => c.id === card.id || conceptKey(c) === k);
}

/** Finds the deck card belonging to a correction of this session (either shape). */
export function findCorrectionCard(deck: Deck, sessionId: string, c: Correction): Card | undefined {
  const fronts = new Set([norm(c.cloze_text || ''), norm(fixFront(c)), norm(fixFront(c, 'es')), norm(fixFront(c, 'it')), norm(fixFront(c, 'pt')), norm(fixFront(c, 'en'))]);
  return deck.cards.find(x =>
    x.sourceSessionId === sessionId && x.sourceKind === 'correction' && fronts.has(norm(x.front)));
}

/** Absolute ceiling on the cards one call may add, whatever the budget says. The real gate
 *  is lib/budget's callCardBudget, which sizes the batch against how many cards the learner
 *  actually gets through in a day; this is only the backstop for callers without one. */
export const MAX_SESSION_CARDS = 16;

/** Days the production direction waits behind recognition. */
export const PROD_DELAY_DAYS = 10;

/** LEVELS index of A2. At and above it, recognition cards stop being made.
 *
 *  Reading a word and knowing what it means is the easy half, and by A2 the learner gets
 *  that half for free from every call and every cloze. What they cannot do is summon the
 *  word when they need it, which is the direction that stays hard for years. Below A2 the
 *  recognition card still earns its place: a beginner needs the word to mean something
 *  before being asked to produce it. */
export const PRODUCTION_ONLY_FROM = 2;

/** Does this learner still get recognition (target -> native) cards? */
export function recognitionCards(mem: Pick<Memory, 'cefr'>): boolean {
  return (mem.cefr?.overall ?? 0) < PRODUCTION_ONLY_FROM;
}

/** Cards for one vocabulary item. Below A2 that is the pair, recognition first and
 *  production ten days behind it; from A2 it is production alone, and with nothing to wait
 *  for, it starts today. */
export function vocabCards(v: VocabItem, sessionId?: string, withRecognition = true): Card[] {
  const audioText = v.fr + (v.ex ? '. ' + v.ex : '');
  const common = {
    example: v.ex, audioText, tag: 'vocabulaire',
    sourceKind: 'vocab' as const, ...(sessionId ? { sourceSessionId: sessionId } : {})
  };
  const prod = newCard({ type: 'de2fr', front: v.de, back: v.fr, ...common });
  if (!withRecognition) return [prod];
  const recog = newCard({ type: 'fr2de', front: v.fr, back: v.de, ...common });
  prod.due = addDays(prod.due, PROD_DELAY_DAYS);
  return [recog, prod];
}

/** Retires the recognition cards a learner has outgrown, the first time they are A2 or
 *  above and not before.
 *
 *  These used to be suspended rather than deleted, on the reasoning that the card and its
 *  history survived and one tap in the deck put it back. That reasoning depended on the
 *  paused shelf being somewhere the learner could look, and the shelf is gone: a card
 *  nobody can see, review or restore is not being kept, it is being hidden. So they go.
 *
 *  Latched on the deck rather than fired on an event, because the level can reach A2 by
 *  several routes (a call moved it, a profile was created there, an older profile arrived
 *  from the server) and because a rule that ran twice would retire a second batch made in
 *  the meantime. Returns how many it removed. */
export function retireRecognition(mem: Pick<Memory, 'deck' | 'cefr'>): number {
  if (!mem.deck) return 0;
  if (recognitionCards(mem)) {
    // Back below A2, so recognition cards are being made again: the latch re-arms, and the
    // next crossing retires this batch too. Without this a learner who dipped and climbed
    // back would carry a permanently mixed deck.
    delete mem.deck.recogRetired;
    return 0;
  }
  if (mem.deck.recogRetired) return 0;
  mem.deck.recogRetired = true;
  const before = (mem.deck.cards ?? []).length;
  mem.deck.cards = (mem.deck.cards ?? []).filter(c => c.type !== 'fr2de');
  return before - mem.deck.cards.length;
}

/** The deck card already carrying this word, in whatever shape: its own recognition or
 *  production card, or a correction cloze whose answer is the word. The post-call review
 *  uses this to show which of the listed words actually became cards. */
export function findVocabCard(deck: Deck, fr: string): Card | undefined {
  const n = norm(fr);
  if (!n) return undefined;
  const live = deck.cards;
  return live.find(c => c.type === 'de2fr' && norm(c.back) === n)
    ?? live.find(c => c.type === 'fr2de' && norm(c.front) === n)
    ?? live.find(c => c.type === 'cloze' && norm(c.back) === n);
}

/** Turns one call's analysis into deck cards, spending a budget rather than filling a cap.
 *
 *  The budget is small on purpose (lib/budget explains the arithmetic), which changes what
 *  the selection has to do: under the old cap of sixteen nothing competed, so corrections
 *  could simply come first and vocabulary after. Under a budget of four that ordering spends
 *  the whole call on clozes and the words the learner met never become anything. So the two
 *  kinds ALTERNATE, corrections first — the most instructive mistake, the most useful word,
 *  the next mistake, the next word — and whatever the budget cannot reach is dropped from
 *  the middle of both lists rather than from the end of one.
 *
 *  Below A2 a word's production card rides along free ten days behind its recognition card:
 *  it is the same word coming back the other way, not a second thing to learn, and the
 *  budget counts things to learn. */
export function cardsFromAnalysis(
  deck: Deck, an: Analysis, sessionId: string, lang?: string,
  withRecognition = true, budget = MAX_SESSION_CARDS
): Card[] {
  const existing = new Set(deck.cards.map(cardKey));
  const take = (c: Card): Card | null => {
    if (existing.has(cardKey(c))) return null;
    existing.add(cardKey(c));
    return c;
  };

  const corrs = (an.corrections ?? []).slice()
    .sort((a, b) => (a.category === 'vocab' ? 0 : 1) - (b.category === 'vocab' ? 0 : 1))
    .slice(0, 6);
  const corrAnswers = new Set(corrs.filter(validCloze).map(c => norm(c.cloze_answer)));
  const fromCorrections: Card[] = [];
  for (const c of corrs) {
    if (!validCloze(c)) continue;
    const card = take(cardFromCorrection(c, sessionId, lang));
    if (card) fromCorrections.push(card);
  }

  /** One word: the card that costs a budget slot, and the one that follows it for free. */
  const fromVocab: { core: Card; later?: Card }[] = [];
  for (const v of (an.new_vocab ?? []).slice(0, 5)) {
    if (!v || !norm(v.fr) || !String(v.de ?? '').trim()) continue;
    const made = vocabCards(v, sessionId, withRecognition);
    const recog = made.find(c => c.type === 'fr2de');
    const prod = made.find(c => c.type === 'de2fr')!;
    // A cloze from this same call already makes the student produce this word, so the
    // production card would ask the identical question twice. Recognition still stands.
    // With no recognition card to stand, the word would otherwise leave nothing behind,
    // so from A2 the production card is kept even then.
    const wantProd = !corrAnswers.has(norm(v.fr)) || !withRecognition;
    if (recog) {
      const core = take(recog);
      if (core) fromVocab.push({ core, ...(wantProd ? { later: prod } : {}) });
    } else if (wantProd) {
      const core = take(prod);
      if (core) fromVocab.push({ core });
    }
  }

  const cap = Math.max(0, Math.min(budget, MAX_SESSION_CARDS));
  const core: Card[] = [];
  const later: Card[] = [];
  let i = 0, j = 0;
  let wantCorrection = true;
  while (core.length < cap && (i < fromCorrections.length || j < fromVocab.length)) {
    const takeCorrection = wantCorrection ? i < fromCorrections.length : j >= fromVocab.length;
    if (takeCorrection) core.push(fromCorrections[i++]);
    else {
      const w = fromVocab[j++];
      core.push(w.core);
      if (w.later) later.push(w.later);
    }
    wantCorrection = !wantCorrection;
  }
  return [...core, ...later];
}

/** One graded card during a session; updates deck stats are handled by the caller's log. */
export function applyGrade(mem: Memory, cardId: string, g: Grade): void {
  const c = mem.deck.cards.find(x => x.id === cardId);
  if (c) grade(c, g);
}
