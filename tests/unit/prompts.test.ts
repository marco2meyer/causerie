import { describe, expect, it } from 'vitest';
import { pack } from '../../src/lang';
import { buildTutorPrompt, greetingPrompt } from '../../src/lib/prompts';
import { focusTargets } from '../../src/lib/focus';
import { seedMem } from '../../src/lib/seed';

describe('buildTutorPrompt', () => {
  const m = seedMem('Marco');
  const p = buildTutorPrompt(m, { topic: 'Les promenades', topicFr: 'les promenades', targets: focusTargets(m, 3), minutes: 4 });

  it('contains persona, the microphone rule and the level', () => {
    expect(p).toContain('Odile');
    expect(p).toContain('A2');
    expect(p).toContain('pince-sans-rire');
    // Recasting used to be the headline instruction, and she recast almost every turn —
    // which is how she came to speak 69% of a conversation lesson. Who holds the
    // microphone now comes first, and the recast is capped and demoted below eliciting.
    expect(p).toContain('micro');
    expect(p.indexOf('micro')).toBeLessThan(p.indexOf('Corriger'));
    expect(p).toMatch(/PLUS COURTS que les siens/);
    expect(p).toMatch(/Ne répète JAMAIS/);
  });
  it('injects focus targets and memory', () => {
    expect(p).toContain('jamais + de');
    expect(p).toContain('réserve naturelle');
    expect(p).toContain('Dessiner des arbres et des chats'); // past call referenced
  });
  it('switches persona wording', () => {
    const warm = seedMem('Marco');
    warm.profile.persona = 'warm';
    expect(buildTutorPrompt(warm, { topic: 'x', targets: [] })).toContain('chaleureux');
    expect(p).toContain('pince-sans-rire');
  });
  it('stays under the server instruction cap', () => {
    expect(p.length).toBeLessThan(16000);
  });
});

describe('greetingPrompt', () => {
  it('mentions name and topic in the daily variant', () => {
    const m = seedMem('Marco');
    const g = greetingPrompt(m, { topic: 'La cuisine', topicFr: 'la cuisine' });
    expect(g).toContain('Marco');
    expect(g).toContain('la cuisine');
  });
  it('introduces herself only on the true first call', () => {
    const m = seedMem('Marco');
    m.sessions = [];
    const g = greetingPrompt(m, { topic: 'x', mode: 'intro' });
    expect(g).toContain('première conversation');
  });
  it('absolute beginners get the native-led A0 block until A2', () => {
    const m = seedMem('Marco');
    m.profile.a0 = true;
    m.cefr.overall = 0;
    const p = buildTutorPrompt(m, { topic: 'x', targets: [], minutes: 5 });
    expect(p).toContain('Débutant absolu');
    expect(p).toContain('allemand'); // resolved {{native}}, not a literal placeholder
    expect(p).not.toContain('{{native}}\n');
    m.cefr.overall = 4; // B1: A0 mode has done its job
    expect(buildTutorPrompt(m, { topic: 'x', targets: [], minutes: 5 })).not.toContain('Débutant absolu');
  });

  it('later intro calls forbid re-introduction and re-asking', () => {
    const m = seedMem('Marco');
    m.sessions = [
      { id: 'a', date: '2026-08-16', topic: 'x', source: 'causerie', minutes: 5 },
      { id: 'b', date: '2026-08-17', topic: 'y', source: 'causerie', minutes: 5 }
    ];
    const g = greetingPrompt(m, { topic: 'x', mode: 'intro' });
    expect(g).not.toContain('première conversation');
    expect(g).toContain('NE te présente PAS');
    const briefing = buildTutorPrompt(m, { topic: 'x', mode: 'intro', targets: [], minutes: 5 });
    expect(briefing).toContain('appel 3 sur 3');
    expect(briefing).toContain('ne repose JAMAIS une question');
  });
});

/* Twice now the question has been "did you delete the facts / the day's focus from the
 * prompt?" — and the only way to answer it was to print the prompt and read it. These pin
 * the sections that carry the app's memory into the call, so the answer is a test run. */
describe('the briefing still carries everything the app knows', () => {
  const m = seedMem('Marco');
  const p = buildTutorPrompt(m, {
    topic: 'Un voisinage à Berlin', targets: focusTargets(m, 3), minutes: 8, topicTags: ['le logement']
  });

  it('names the day’s focus targets, and the targets themselves', () => {
    expect(p).toContain('Objectifs du jour');
    for (const t of focusTargets(m, 3)) expect(p, `target missing: ${t.label}`).toContain(t.label);
  });

  it('carries the silent probes and the topic’s vocabulary fields', () => {
    expect(p).toContain('Sondage discret');
    expect(p).toContain('le logement');
  });

  it('carries what it knows about the student', () => {
    expect(p).toContain('Ce que tu sais de l’élève'.replace('’', "'"));
    // Facts arrive as a portrait now rather than a flat list, but they arrive.
    expect(p).toContain(pack('fr').tutor.facts.basics);
    for (const f of m.facts) expect(p, `fact missing: ${f.text}`).toContain(f.text.replace(/\.$/, ''));
    expect(p).toContain('Centres d’intérêt'.replace('’', "'"));
    for (const i of m.interests.slice(0, 3)) expect(p).toContain(i.label);
  });

  it('carries the open weaknesses and the last conversations', () => {
    for (const w of m.weaknesses.filter(x => x.status !== 'resolved').slice(0, 3)) expect(p).toContain(w.label);
    for (const s of m.sessions.filter(x => x.summary).slice(-3)) expect(p).toContain(s.topic);
  });
})
