import type { CallSession, LangCode, Memory } from '../types';
import { pack, PACKS, ui } from '../lang';
import { handoverActive, tutorOf } from './tutors';
import { band, idxLvl } from './cefr';
import { probeTargets } from './competencies';
import { inIntroPhase, introCallsDone } from './gamify';
import { LANGS } from './langs';
import { portrait, portraitText } from './portrait';
import { recall, recallText } from './recall';
import { talkAlert } from './talk';
import { listProfiles, profileLang } from './profiles';

/** 1-based number of the current intro call, clamped to 3. */
const introN = (mem: Memory): number => Math.min(introCallsDone(mem) + 1, 3);

/** The tutor briefing is a user-editable template (Memory → Briefing → edit), written
 *  ENTIRELY in the target language: it comes from the language pack, so a Spanish
 *  profile briefs Odile in Spanish, an Italian one in Italian, and so on. Every
 *  {{placeholder}} is filled from the app's live state at call time; nothing
 *  student-specific is hardcoded. */

export const TEMPLATE_VARS = [
  'name', 'native', 'langue', 'niveau', 'competences', 'confiance', 'bande',
  'identite', 'persona', 'aujourdhui', 'minutes', 'objectifs', 'sondages', 'cap', 'faits', 'interets',
  'faiblesses', 'passe'
] as const;

/* Back-compat export (tests, editor reset for French profiles). */
export const DEFAULT_TUTOR_TEMPLATE = PACKS.fr.tutor.template;

export function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key: string) => (key in vars ? vars[key] : m));
}

/** The previous call, as the day's opening — daily calls only. The getting-to-know-you
 *  calls have their own shape and, on the first of them, nothing to come back to. */
const recallFor = (mem: Memory, sess: Pick<CallSession, 'mode' | 'wordGoals'>) =>
  sess.mode === 'intro' || inIntroPhase(mem)
    ? null
    : recall(mem, { skip: (sess.wordGoals ?? []).map(g => g.word) });

export function buildTutorPrompt(mem: Memory, sess: Pick<CallSession, 'topic' | 'topicFr' | 'targets' | 'mode' | 'minutes' | 'topicTags' | 'wordGoals'>): string {
  const p = mem.profile;
  const P = pack(p.target);
  const tp = P.tutor;
  const est = inIntroPhase(mem);
  const native = P.natives[p.native ?? 'de'] ?? P.natives.de;
  const langue = P.langName;
  // Absolute-beginner mode: the tutor leads in the native language and teaches
  // survival phrases, until the level clears A1+.
  const a0 = !!p.a0 && mem.cefr.overall < 2
    ? resolveTemplate(tp.a0, { langue, native }) + '\n\n'
    : '';
  // Parallel Romance profiles: brief the tutor to flag cross-language slips.
  const ROMANCE: string[] = ['fr', 'es', 'it', 'pt'];
  const clash = ROMANCE.includes(p.target)
    ? [...new Set(listProfiles().map(pr => profileLang(pr.id)).filter((l): l is LangCode => !!l && l !== p.target && ROMANCE.includes(l)))]
    : [];
  const interf = clash.length
    ? resolveTemplate(tp.interference, { langue, autres: clash.map(l => LANGS[l].name).join(', ') }) + '\n\n'
    : '';
  // She out-talked the student — last call, or across the last few. Injected here rather than written
  // into the template so a student who has edited their own briefing still gets it, and so
  // it disappears again the moment the ratio comes back — a standing rule nobody is
  // breaking any more is just noise in a two-thousand-word prompt.
  const share = talkAlert(mem);
  const hog = share !== null ? tp.talkHog(Math.round(share * 100)) + '\n\n' : '';
  // The tutor changed hands recently: a bare-bones handover note opens the day block for
  // the first few calls. Read off the RAW pack — the tutor rewrite would rename the old
  // tutor into the new one mid-note.
  const ho = handoverActive(mem);
  const passation = ho ? PACKS[p.target]?.tutor.handover({ name: ho.from.name, gender: ho.from.gender }) + '\n\n' : '';
  // Yesterday, before today. Injected into the day block rather than given its own
  // {{placeholder}} for the same reason the talk alert is: a student who has edited their
  // own briefing would never see a variable added after they saved it.
  const rec = recallFor(mem, sess);
  const reprise = rec ? recallText(rec, tp.recall) + '\n\n' : '';
  const vars: Record<string, string> = {
    name: p.name || tp.fallbacks.student,
    native,
    langue,
    niveau: est ? tp.levelBeingEstablished.niveau : idxLvl(mem.cefr.overall),
    confiance: est ? tp.levelBeingEstablished.confiance : Math.round((mem.cefr.confidence || 0.4) * 100) + ' %',
    bande: band(mem.cefr.overall),
    // Who takes the call: the identity line of the profile's tutor, in the target
    // language. The pack itself is already rewritten for that tutor by lang/index.
    identite: tp.identities[tutorOf(mem).key] || tp.identities.odile || '',
    competences: (['grammar', 'vocabulary', 'fluency', 'comprehension'] as const)
      .map(k => `${P.ui.skills[k]} : ${idxLvl(mem.cefr.skills[k])}`).join(', '),
    persona: tp.persona[p.persona === 'warm' ? 'warm' : 'deadpan'],
    aujourdhui: passation + a0 + interf + hog + reprise + (sess.mode === 'intro'
      ? tp.todayIntro(introN(mem))
      : tp.todayTopic(sess.topicFr || sess.topic) + (sess.topicTags?.length ? tp.todayFields(sess.topicTags.join(', ')) : '')),
    minutes: String(sess.minutes ?? mem.settings.minutesHint ?? 4),
    objectifs: (sess.targets ?? []).map((t, i) => `${i + 1}. ${t.label}`).join('\n') || tp.fallbacks.noTargets,
    sondages: probeTargets(mem, 2).map(c => `- ${c.label} (${c.band})`).join('\n') || tp.fallbacks.noProbes,
    cap: mem.checkins?.direction || tp.fallbacks.noDirection,
    // A portrait, not the last eight things he happened to say: the settled facts grouped
    // so they read as a person, then a rotating few incidentals she is told to use at most
    // one of. See lib/portrait for why the two are separable without asking a model.
    faits: portraitText(portrait(mem), tp.facts),
    interets: (mem.interests ?? []).slice().sort((a, b) => b.weight - a.weight).slice(0, 5).map(i => '- ' + i.label).join('\n') || tp.fallbacks.noInterests,
    faiblesses: (mem.weaknesses ?? []).filter(w => w.status !== 'resolved').slice(0, 8).map(w => '- ' + w.label).join('\n') || tp.fallbacks.noWeaknesses,
    // Conversations from before a handover belong to the old tutor and are never
    // referenced again — the new one wasn't there.
    passe: (mem.sessions ?? []).filter(s => s.summary && (!mem.handover || s.date >= mem.handover.date))
      .slice(-3).map(s => `- ${s.date} « ${s.topic} » : ${s.summary}`).join('\n') || tp.fallbacks.firstCall
  };
  return resolveTemplate(mem.tutorTemplate || tp.template, vars);
}

/** Opening cue. Injected as a SYSTEM conversation item followed by a bare
 *  response.create — never as response-level instructions, which would REPLACE the
 *  session briefing for that response and let the model open with its default persona
 *  ("Je m'appelle ChatGPT…"). The cue names Odile anyway, as a second safety net. */
export function greetingPrompt(mem: Memory, sess: Pick<CallSession, 'topic' | 'topicFr' | 'mode' | 'minutes' | 'wordGoals'>): string {
  const tp = pack(mem.profile.target).tutor;
  const name = mem.profile.name || tp.fallbacks.student;
  if (sess.mode === 'intro') return tp.greetIntro(name, introN(mem));
  // A new tutor's very first call opens like a first meeting — they introduce
  // themselves — because for these two people it is one.
  const ho = handoverActive(mem);
  if (ho && ho.calls === 0) return tp.greetIntro(name, 1);
  // When there is a call to come back to, that is what she opens on: the subject of the
  // day and the length are announced after the reprise, not over the top of it.
  const rec = recallFor(mem, sess);
  if (rec) return tp.greetRecall(name, tp.recall.ago(rec.days), rec.topic);
  return tp.greetDaily(name, sess.topicFr || sess.topic, sess.minutes ?? mem.settings.minutesHint ?? 8);
}

/** Glosses of the template variables for the briefing editor. */
export const varGloss = (): Record<string, string> => ui().memory.varGloss;
