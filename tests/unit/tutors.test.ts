/* The tutor carousel on the call side: the registry, the pack rewrite (lang/tutor.ts),
 * and the briefing. The packs are authored for Odile; when Marcel, Solène or Nour takes
 * the calls, every string that comes out of pack()/ui() must be theirs — right name,
 * right gender, no broken elision — while the grammar cheat sheets (full of «Elle a deux
 * chats») stay untouched. */
import { afterAll, describe, expect, it } from 'vitest';
import { pack, PACKS, setTutor, setUiLang, ui } from '../../src/lang';
import { deUi } from '../../src/lang/de';
import { swapTutorString, tutorize } from '../../src/lang/tutor';
import { applyTutor, chooseTutor, handoverActive, HANDOVER_CALLS, switchTutor, TUTORS, tutorOf } from '../../src/lib/tutors';
import { VOICES } from '../../src/lib/langs';
import { buildTutorPrompt, greetingPrompt } from '../../src/lib/prompts';
import { todayISO } from '../../src/lib/utils';
import { focusTargets } from '../../src/lib/focus';
import { seedMem } from '../../src/lib/seed';

const M = TUTORS.marcel, N = TUTORS.nour, SO = TUTORS.solene;

afterAll(() => {
  setTutor(TUTORS.odile);
  setUiLang('fr');
});

/** Every string reachable without calling anything. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out);
  return out;
}

describe('the registry', () => {
  it('offers the same six teachers as the companion, each with a real voice', () => {
    expect(Object.keys(TUTORS)).toEqual(['odile', 'marcel', 'solene', 'nour', 'bakary', 'rosa']);
    for (const t of Object.values(TUTORS)) expect(VOICES).toContain(t.voice);
    expect(TUTORS.nour.gender).toBe('x');
  });
  it('falls back to Odile for unset and unknown keys', () => {
    expect(tutorOf(null).key).toBe('odile');
    const m = seedMem('Marco');
    expect(tutorOf(m).key).toBe('odile');
    m.profile.tutor = 'zorg';
    expect(tutorOf(m).key).toBe('odile');
  });
  it('chooseTutor writes the key and the voice', () => {
    const m = seedMem('Marco');
    chooseTutor(m, 'marcel');
    expect(m.profile.tutor).toBe('marcel');
    expect(m.settings.voice).toBe(TUTORS.marcel.voice);
  });
});

describe('the rewrite, string by string', () => {
  const cases: [string, string, typeof M, string][] = [
    // French: gender pairs, then elision, then the name.
    ['fr', 'Style d’Odile', M, 'Style de Marcel'],
    ['fr', 'Tout ce qu’Odile sait de toi.', M, 'Tout ce que Marcel sait de toi.'],
    ['fr', 'Elle guette ', M, 'Il guette '],
    ['fr', 'Elle guette ', N, 'Iel guette '],
    ['fr', 'Interromps-la quand tu veux', N, 'Interromps Nour quand tu veux'],
    ['fr', 'Style d’Odile', SO, 'Style de Solène'],
    // The cheat sheets must come through untouched: no tutor reference, no rewrite.
    ['fr', 'Elle a deux chats.', M, 'Elle a deux chats.'],
    ['de', 'Sie hat zwei Katzen.', M, 'Sie hat zwei Katzen.'],
    // English pronouns.
    ['en', 'She recasts it', N, 'They recast it'],
    ['en', 'You asked her for this word.', M, 'You asked him for this word.'],
    // Portuguese carries the gender in the article.
    ['pt', 'A Odile relê a vossa conversa…', M, 'O Marcel relê a vossa conversa…'],
    ['pt', 'Liga à Odile', M, 'Liga ao Marcel'],
    ['pt', 'O que contaste à Odile.', N, 'O que contaste a Nour.'],
    // German genitive rides on the name swap.
    ['de', 'Odiles Art', M, 'Marcels Art'],
    ['de', 'Sie wiederholt es', M, 'Er wiederholt es'],
    ['de', 'Sie wiederholt es', N, 'Nour wiederholt es'],
    // Spanish and Italian role words.
    ['es', 'su tutora', M, 'su tutor'],
    ['it', 'Qui ti ha ripreso lei.', M, 'Qui ti ha ripreso lui.'],
    ['it', 'Le hai chiesto questa parola.', N, 'Hai chiesto a Nour questa parola.']
  ];
  it.each(cases)('%s: %s → (%#)', (lang, input, tutor, want) => {
    expect(swapTutorString(input, lang, tutor)).toBe(want);
  });
});

describe('the rewrite, whole packs', () => {
  const worlds: [string, unknown][] = [...Object.values(PACKS).map(p => [p.code, p] as [string, unknown]), ['de', deUi]];
  for (const t of [M, SO, N]) {
    it(`leaves no trace of Odile and no broken elision for ${t.name}`, () => {
      for (const [lang, raw] of worlds) {
        for (const s of strings(tutorize(raw, lang, t))) {
          expect(s, `${lang}: ${s.slice(0, 80)}`).not.toContain('Odile');
          expect(s, `${lang}: ${s.slice(0, 80)}`).not.toMatch(/[dq]u?['’](Marcel|Solène|Nour)/);
        }
      }
    });
  }
  it('keeps the Portuguese articles masculine for Marcel', () => {
    for (const s of strings(tutorize(PACKS.pt, 'pt', M))) {
      expect(s, s.slice(0, 80)).not.toMatch(/(^| )a Marcel\b/);
      expect(s, s.slice(0, 80)).not.toContain('à Marcel');
    }
  });
  it('rewrites what the pack functions return, and caches per tutor', () => {
    setUiLang('fr');
    setTutor(M);
    const g = pack('fr').tutor.greetIntro('X', 1);
    expect(g).toContain('Marcel');
    expect(g).toContain('son tuteur');
    expect(g).not.toContain('Odile');
    expect(ui().settings.odileStyle).toBe('Style de Marcel');
    expect(pack('fr')).toBe(pack('fr'));
    setTutor(TUTORS.odile);
    expect(pack('fr').tutor.greetIntro('X', 1)).toContain('Odile');
  });
});

describe('the briefing', () => {
  it('briefs Marcel as Marcel, identity line included, Odile gone', () => {
    const m = seedMem('Marco');
    chooseTutor(m, 'marcel');
    applyTutor(m);
    const p = buildTutorPrompt(m, { topic: 'x', topicFr: 'x', targets: focusTargets(m, 3), minutes: 4 });
    expect(p).toContain('Tu es Marcel, tuteur de conversation');
    expect(p).toContain('ancien professeur de lettres à Abidjan');
    expect(p).toContain('un bon tuteur humain');
    expect(p).not.toContain('Odile');
    expect(p).not.toContain('tutrice');
    applyTutor(seedMem('Marco'));
  });
  it('resets the relationship on a switch: facts gone, learning file kept, handover set', () => {
    const m = seedMem('Marco');
    m.facts = [{ id: 'f1', text: 'a une fille, Léa', category: 'famille' as never, firstSaid: '2026-09-01', lastSaid: '2026-09-01' }];
    const weaknesses = m.weaknesses.length;
    expect(switchTutor(m, 'marcel')).toBe(true);
    expect(m.facts).toEqual([]);
    expect(m.weaknesses.length).toBe(weaknesses);
    expect(m.interests.length).toBeGreaterThan(0);
    expect(m.handover).toEqual({ from: 'odile', date: todayISO() });
    expect(m.profile.tutor).toBe('marcel');
    // Same key again: nothing happens, no fresh handover.
    expect(switchTutor(m, 'marcel')).toBe(false);
  });
  it('keeps the handover note for the first calls, then drops it', () => {
    const m = seedMem('Marco');
    switchTutor(m, 'marcel');
    expect(handoverActive(m)?.from.key).toBe('odile');
    m.sessions.push(...Array.from({ length: HANDOVER_CALLS }, (_, i) => ({ ...m.sessions[0], id: 'ho' + i, date: todayISO() })));
    expect(handoverActive(m)).toBeNull();
  });
  it('the briefing carries the handover, hides old facts and old conversations, and the first greeting is a first meeting', () => {
    const m = seedMem('Marco');
    switchTutor(m, 'marcel');
    applyTutor(m);
    const p = buildTutorPrompt(m, { topic: 'x', targets: [] });
    expect(p).toContain('# Passation');
    expect(p).toContain('des mains de Odile');
    expect(p).toContain('elle l\'a gardé pour elle');
    // seedMem's past call must not be referenced: the new tutor wasn't there.
    expect(p).not.toContain('Dessiner des arbres et des chats');
    const g = greetingPrompt(m, { topic: 'x', mode: 'daily' as never, minutes: 8 });
    expect(g).toContain('toute première conversation');
    expect(g).toContain('Marcel');
    // After the first call, back to the daily greeting.
    m.sessions.push({ ...m.sessions[0], id: 'ho', date: todayISO() });
    expect(greetingPrompt(m, { topic: 'x', mode: 'daily' as never, minutes: 8 })).not.toContain('toute première');
    applyTutor(seedMem('Marco'));
  });
  it('briefs Nour with their own identity line', () => {
    const m = seedMem('Marco');
    chooseTutor(m, 'nour');
    applyTutor(m);
    const p = buildTutorPrompt(m, { topic: 'x', targets: [] });
    expect(p).toContain('Tu es Nour, tuteur de conversation');
    expect(p).toContain('iel');
    expect(p).not.toContain('Odile');
    applyTutor(seedMem('Marco'));
  });
});
