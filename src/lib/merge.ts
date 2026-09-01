import type { Analysis, CostLeg, FocusTarget, Memory, SessionRecord, TranscriptItem, WordGoalResult } from '../types';
import { idxLvl, LEVELS } from './cefr';
import { compById } from './competencies';
import { sessionXp, touchStreak } from './gamify';
import { pack } from '../lang';
import { cardsFromAnalysis, recognitionCards, retireRecognition } from './srs';
import { callCardBudget } from './budget';
import { fmtDate, norm, todayISO, uid } from './utils';

/** Move `oldIdx` toward `newIdx`; higher analysis confidence moves further (25–60%). */
export function smooth(oldIdx: number, newIdx: number, conf: number | undefined): number {
  const w = 0.25 + 0.35 * Math.max(0, Math.min(1, conf ?? 0.5));
  return Math.max(0, Math.min(LEVELS.length - 1, Math.round(oldIdx + (newIdx - oldIdx) * w)));
}

export interface SessionMeta {
  topic: string;
  targets?: FocusTarget[];
  transcript?: TranscriptItem[];
  seconds?: number;
  /** Learner's words per minute, computed from the verbatim transcript at analyze time. */
  wpm?: number;
  /** Share of the call's words that were the tutor's (see lib/talk). */
  tutorShare?: number;
  /** Verbatim re-transcription of the learner's mic audio (error ground truth). */
  verbatim?: string | null;
  /** What the call cost, leg by leg. */
  costs?: CostLeg[];
  /** The active-vocabulary pushes the call carried, and whether they were placed. */
  wordGoals?: WordGoalResult[];
  /** Cheat-sheet ids the call carried, so the next one can rotate past them. */
  materials?: string[];
  /** The resolved briefing this call ran on, archived with it. */
  briefing?: string;
}

/** Merges one analysis into memory (mutates `mem`) and returns the stored session record.
 *  This is the gap-closing core: weakness statuses evolve, levels smooth toward the new
 *  estimate, interests/vocab accumulate, XP and streak update. */
export function applyAnalysis(mem: Memory, an: Analysis, sessMeta: SessionMeta): SessionRecord {
  const d = todayISO();
  const RS = pack(mem.profile.target).tutor.records;
  const ci = (s: string) => {
    const i = LEVELS.indexOf(s as (typeof LEVELS)[number]);
    return i >= 0 ? i : mem.cefr.overall;
  };

  const hadSpeech = (sessMeta.transcript ?? []).some(t => t.role === 'user' && (t.text || '').trim().length > 3);
  if (hadSpeech && an.cefr) {
    // First few real conversations ESTABLISH the level instead of nudging an assumption:
    // the analysis estimate gets a fixed strong weight, later calls smooth normally.
    const priorSpeech = mem.sessions.filter(s =>
      s.source === 'causerie' && (s.transcript ?? []).some(t => t.role === 'user' && (t.text || '').trim().length > 3)
    ).length;
    const early = priorSpeech < 3;
    const mv = (oldIdx: number, lvl: string) =>
      early
        ? Math.max(0, Math.min(LEVELS.length - 1, Math.round(oldIdx + (ci(lvl) - oldIdx) * 0.6)))
        : smooth(oldIdx, ci(lvl), an.cefr.confidence);
    const sk = mem.cefr.skills;
    sk.grammar = mv(sk.grammar, an.cefr.grammar);
    sk.vocabulary = mv(sk.vocabulary, an.cefr.vocabulary);
    sk.fluency = mv(sk.fluency, an.cefr.fluency);
    sk.comprehension = mv(sk.comprehension, an.cefr.comprehension);
    mem.cefr.overall = mv(mem.cefr.overall, an.cefr.overall);
    mem.cefr.confidence = Math.min(0.95, (mem.cefr.confidence || 0.4) * 0.7 + (an.cefr.confidence || 0.5) * (early ? 0.55 : 0.4));
    mem.cefr.history.push({ date: d, overall: mem.cefr.overall, skills: { ...sk } });
    if (mem.cefr.history.length > 60) mem.cefr.history = mem.cefr.history.slice(-60);
  }

  for (const w of an.weaknesses ?? []) {
    let ex = w.id ? mem.weaknesses.find(x => x.id === w.id) : undefined;
    if (!ex) {
      ex = mem.weaknesses.find(x =>
        norm(x.label) === norm(w.label) ||
        (norm(x.label).length > 8 && norm(w.label).includes(norm(x.label).slice(0, 18)))
      );
    }
    if (ex) {
      const wasOpen = ex.status !== 'resolved';
      ex.status = w.status === 'new' && wasOpen ? 'persisting' : w.status;
      ex.lastSeen = d;
      ex.timesWorked = (ex.timesWorked || 0) + 1;
      if (w.evidence) ex.evidence = (ex.evidence ?? []).concat([{ quote: w.evidence, src: RS.callOf + fmtDate(d) }]).slice(-5);
      if (w.cefr) ex.cefr = w.cefr;
    } else {
      mem.weaknesses.push({
        id: uid('w'), label: w.label, cefr: w.cefr ?? '',
        status: w.status === 'resolved' ? 'resolved' : 'new',
        firstSeen: d, lastSeen: d, timesWorked: 0,
        evidence: w.evidence ? [{ quote: w.evidence, src: RS.callOf + fmtDate(d) }] : []
      });
    }
  }

  for (const s of an.strengths ?? []) {
    let ex = s.id ? mem.strengths.find(x => x.id === s.id) : undefined;
    if (!ex) ex = mem.strengths.find(x => norm(x.label) === norm(s.label));
    if (ex) {
      ex.lastSeen = d;
      if (s.evidence) ex.evidence = (ex.evidence ?? []).concat([{ quote: s.evidence, src: RS.callOf + fmtDate(d) }]).slice(-4);
    } else {
      mem.strengths.push({ id: uid('s'), label: s.label, lastSeen: d, evidence: s.evidence ? [{ quote: s.evidence, src: RS.callOf + fmtDate(d) }] : [] });
    }
  }

  /* Interests: reinforce what came up, decay what didn't, keep the list short. */
  const mentioned = new Set((an.interests ?? []).map(norm));
  for (const lab of an.interests ?? []) {
    const ex = mem.interests.find(i => norm(i.label) === norm(lab));
    if (ex) { ex.weight = Math.min(9, (ex.weight || 1) + 1); ex.lastSeen = d; }
    else mem.interests.push({ label: lab, weight: 1.5, lastSeen: d });
  }
  if (hadSpeech) {
    for (const i of mem.interests) {
      if (!mentioned.has(norm(i.label))) i.weight = Math.round(i.weight * 0.95 * 100) / 100;
    }
  }
  mem.interests = mem.interests.filter(i => i.weight >= 0.6)
    .sort((a, b) => b.weight - a.weight).slice(0, 12);

  for (const v of an.new_vocab ?? []) {
    if (!mem.vocab.find(x => norm(x.fr) === norm(v.fr))) mem.vocab.push({ fr: v.fr, de: v.de, ex: v.ex, date: d });
  }

  for (const f of an.facts ?? []) {
    const ex = mem.facts.find(x => norm(x.text) === norm(f.text));
    if (ex) ex.lastSaid = d;
    else mem.facts.push({ id: uid('f'), text: f.text, category: f.category, firstSaid: d, lastSaid: d });
  }
  /* Model-driven curation: drop stored facts/interests flagged as trivial or outdated. */
  for (const id of an.prune?.facts ?? []) mem.facts = mem.facts.filter(f => f.id !== id);
  for (const lab of an.prune?.interests ?? []) mem.interests = mem.interests.filter(i => norm(i.label) !== norm(lab));
  if (mem.facts.length > 40) {
    mem.facts.sort((a, b) => b.lastSaid.localeCompare(a.lastSaid));
    mem.facts = mem.facts.slice(0, 40);
  }

  mem.nextFocus = (an.next_focus ?? []).slice(0, 5).map(f => ({ label: f.label, cefr: f.cefr, grund: f.grund }));

  /* Competency matrix: fill cells from evidence. Latest observation wins per cell. */
  mem.comp = mem.comp ?? {};
  for (const c of an.competencies ?? []) {
    const lib = compById(mem.profile.target);
    if (!c.id || !lib[c.id]) continue; // free-text observations don't get cells
    mem.comp[c.id] = {
      status: c.status === 'demonstrated' ? 'ok' : c.status === 'failed' ? 'ko' : 'partial',
      lastSeen: d,
      evidence: (c.evidence || '').slice(0, 160) || undefined
    };
  }
  // Pinned cells had their call; the matrix now shows the result. Unpin.
  mem.pinned = [];

  const mins = Math.max(1, Math.round((sessMeta.seconds ?? 60) / 60));
  // One formula, in lib/gamify: the review screen shows this same arithmetic back.
  const goals = sessMeta.wordGoals ?? [];
  const xp = sessionXp({
    minutes: mins,
    targets: (an.targets ?? []).filter(t => t.achieved).length,
    praise: (an.highlights ?? []).length,
    tips: (an.corrections ?? []).length,
    words: goals.filter(g => g.used).length
  });
  mem.xp = (mem.xp || 0) + xp;
  touchStreak(mem, d);

  const sessId = uid('sess');
  // Runs after the level has smoothed: the call that lifts the learner to A2 is the call
  // that retires the recognition half of their deck. Latched, so this is a no-op after that.
  retireRecognition(mem);
  // Sized against what the learner reviews in a day, and against how much of the last batch
  // they have not started yet — a call that adds more than the evenings can absorb is not
  // teaching anything, it is building a queue.
  const cards = cardsFromAnalysis(mem.deck, an, sessId, mem.profile.target, recognitionCards(mem), callCardBudget(mem));
  mem.deck.cards.push(...cards);

  const rec: SessionRecord = {
    id: sessId, date: d, at: new Date().toISOString(), topic: sessMeta.topic, source: 'causerie',
    minutes: mins, seconds: Math.round(sessMeta.seconds ?? 0),
    level: idxLvl(mem.cefr.overall),
    targets: sessMeta.targets ?? [], transcript: sessMeta.transcript ?? [],
    analysis: an, xp, cardsAdded: cards.length, ...(sessMeta.wpm ? { wpm: sessMeta.wpm } : {}),
    ...(typeof sessMeta.tutorShare === 'number' ? { tutorShare: sessMeta.tutorShare } : {}),
    ...(goals.length ? { wordGoals: goals } : {}),
    ...(sessMeta.verbatim ? { verbatim: sessMeta.verbatim } : {}),
    ...(sessMeta.costs?.length ? { costs: sessMeta.costs } : {}),
    ...(sessMeta.materials?.length ? { materials: sessMeta.materials } : {}),
    ...(sessMeta.briefing ? { briefing: sessMeta.briefing } : {}),
    summary: an.topics?.length ? RS.themes + an.topics.join(', ') + '. ' + (an.hauptpunkt || '') : (an.hauptpunkt || '')
  };
  mem.sessions.push(rec);
  return rec;
}
