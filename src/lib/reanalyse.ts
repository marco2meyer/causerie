/* A call analysed after the fact. The analysis runs on the network and the model can refuse
   it, time out, or meet an expired token; when that happened the whole call used to wait in
   page memory behind a retry button and died with the tab — the transcript, its cards, and
   the call itself. Now the call is written down the moment it ends (app.tsx endCall) and
   this is the second attempt, from the record alone: the turn transcript, the verbatim of
   his own microphone if it arrived, the subject and its targets. Nothing here is live —
   it reads a stored record, so it works hours or days later, and on another device. */
import type { Analysis, Memory, SessionRecord } from '../types';
import { runAnalysis } from './analysis';
import { estimateCost } from './costs';
import { applyAnalysis } from './merge';
import { tutorShare } from './talk';
import { deepClone } from './utils';

/** Why an analysis cannot be attempted (the UI only offers it when neither holds). */
export const NO_SESSION = 'NOSESSION';
export const NOTHING_SAID = 'NOTHINGSAID';

/** A call worth analysing: one this app recorded, still without an analysis, with something
 *  of his own in the transcript. An import has no transcript and nothing to analyse. */
export function analysable(rec: SessionRecord | undefined): boolean {
  if (!rec || rec.source !== 'causerie' || rec.analysis) return false;
  return (rec.transcript ?? []).some(t => t.role === 'user' && (t.text || '').trim().length > 3);
}

/**
 * reanalyseSession(mem, id, onProgress?) → { mem, rec }
 *   Analyses the stored call `id` and merges the result the way the call's own analysis
 *   would have: levels, weaknesses, vocabulary, XP, cards, and the record itself — in
 *   place, keeping its date and its hour, so the day it belongs to does not move. `mem` is
 *   cloned, never mutated; the caller saves what comes back. Throws the reason when the
 *   call cannot be analysed, and whatever runAnalysis throws when the model will not.
 */
export async function reanalyseSession(
  mem: Memory,
  id: string,
  onProgress?: (chars: number) => void
): Promise<{ mem: Memory; rec: SessionRecord }> {
  const rec = mem.sessions.find(s => s.id === id);
  if (!rec) throw new Error(NO_SESSION);
  if (!analysable(rec)) throw new Error(NOTHING_SAID);

  const an: Analysis = await runAnalysis(
    mem,
    { topic: rec.topic, targets: rec.targets ?? [] },
    rec.transcript ?? [],
    rec.verbatim ?? null,
    onProgress
  );

  const m = deepClone(mem);
  // The attempt that failed left no leg on the record; this one's is the analysis this
  // record was finally read by, so an earlier leg (a retry) is replaced, not added to.
  const costs = (rec.costs ?? []).filter(l => l.kind !== 'analysis');
  const model = an._model || mem.settings.analysisModel || 'gpt-5.6-sol';
  const usd = an._usage ? estimateCost({ model, ...an._usage }) : 0;
  if (usd > 0) costs.push({ kind: 'analysis', model, usd });

  // Words per minute needs the verbatim; a call whose transcription never arrived keeps
  // whatever it had (nothing), rather than claiming a fluency read from tidied-up ASR.
  const mins = (rec.seconds ?? 0) / 60;
  const wpm = rec.wpm ?? (rec.verbatim && mins > 0.5
    ? Math.round(rec.verbatim.split(/\s+/).filter(Boolean).length / mins)
    : undefined);

  const out = applyAnalysis(m, an, {
    id: rec.id, date: rec.date, topic: rec.topic, targets: rec.targets,
    transcript: rec.transcript, seconds: rec.seconds, wpm, verbatim: rec.verbatim ?? null,
    wordGoals: rec.wordGoals, materials: rec.materials, briefing: rec.briefing,
    tutorShare: rec.tutorShare ?? tutorShare(rec.transcript) ?? undefined,
    costs
  });
  return { mem: m, rec: out };
}
