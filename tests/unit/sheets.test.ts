import { describe, expect, it, vi } from 'vitest';
import { SHEET_BY_ID, SHEETS, sheetsById, sheetsForCall } from '../../src/lib/sheets';
import { COMP_LIB } from '../../src/lib/competencies';
import { focusTargets } from '../../src/lib/focus';
import { seedMem } from '../../src/lib/seed';
import { blankMem } from '../../src/lib/storage';

describe('cheat-sheet library', () => {
  it('has unique ids, both languages, and stays compact', () => {
    expect(new Set(SHEETS.map(s => s.id)).size).toBe(SHEETS.length);
    expect(SHEETS.some(s => s.lang === 'fr')).toBe(true);
    expect(SHEETS.some(s => s.lang === 'es')).toBe(true);
    for (const s of SHEETS) {
      expect(s.core.length).toBeGreaterThan(0);
      expect(s.core.length).toBeLessThanOrEqual(6);
      expect(s.examples.length).toBeGreaterThan(0);
      expect(s.examples.length).toBeLessThanOrEqual(4);
    }
  });

  it('covers the classics in both languages', () => {
    expect(SHEET_BY_ID['g-b1-conditionnel']).toBeDefined();
    expect(SHEET_BY_ID['g-a2-passe-compose']).toBeDefined();
    expect(SHEET_BY_ID['es-g-condicional']).toBeDefined();
    expect(SHEET_BY_ID['es-g-ser-estar']).toBeDefined();
  });
});

describe('sheetsForCall', () => {
  it('finds sheets for the seeded weaknesses via keywords, max 2', () => {
    // One slot goes to what the call is about, the other to whatever has gone longest
    // unread — so a weakness that matches SECOND arrives on the second or third call
    // rather than riding along with the first. It still arrives, which is the claim here.
    const m = seedMem('X'); // weaknesses include pronoms objets + verbes pronominaux
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const sheets = sheetsForCall(m, focusTargets(m, 3));
      expect(sheets.length).toBeGreaterThan(0);
      expect(sheets.length).toBeLessThanOrEqual(2);
      expect(new Set(sheets.map(s => s.id)).size).toBe(sheets.length);
      sheets.forEach(x => seen.add(x.id));
      m.sessions.push({
        id: 's' + i, date: '2026-08-0' + i, topic: 't', source: 'causerie',
        minutes: 8, materials: sheets.map(x => x.id)
      });
    }
    expect([...seen]).toContain('g-a2-cod-coi');
  });

  it('a pinned matrix cell brings its exact sheet', () => {
    const m = seedMem('X');
    m.weaknesses = []; // no keyword matches left
    m.pinned = ['g-b1-conditionnel'];
    const sheets = sheetsForCall(m, focusTargets(m, 3));
    expect(sheets[0]?.id).toBe('g-b1-conditionnel');
  });

  it('filters by target language', () => {
    const m = blankMem();
    m.profile.target = 'es';
    m.introDone = true;
    m.weaknesses.push({
      id: 'w1', label: 'ser vs estar', cefr: 'A1', status: 'persisting',
      firstSeen: '2026-08-01', lastSeen: '2026-08-17', timesWorked: 2, evidence: []
    });
    const sheets = sheetsForCall(m, focusTargets(m, 3));
    expect(sheets.every(s => s.lang === 'es')).toBe(true);
    expect(sheets.map(s => s.id)).toContain('es-g-ser-estar');
  });

  it('silent probes bring their sheets even without explicit targets', () => {
    // probeTargets rotates which grey cells it picks by calendar day, and only the
    // grammar cells carry a sheet: on a day whose two probes are both vocabulary there
    // is legitimately nothing to bring (the next test is that case on purpose). Reading
    // one day made this pass or fail on the date it happened to run, so the claim is
    // made over a full rotation instead: the mechanism does bring sheets, and never
    // brings more than the two a call can carry.
    const m = blankMem();
    m.introDone = true;
    vi.useFakeTimers();
    try {
      let most = 0;
      for (let d = 0; d < 40; d++) {
        vi.setSystemTime(new Date(Date.UTC(2026, 0, 1 + d)));
        const sheets = sheetsForCall(m, []);
        expect(sheets.length).toBeLessThanOrEqual(2);
        most = Math.max(most, sheets.length);
      }
      expect(most).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still brings something to read when nothing is relevant', () => {
    // Used to return nothing at all here. A call with no matching target left the student
    // with no grammar in front of them, while the forty sheets nobody had read sat in the
    // pack — so the second slot is now a rotation slot and always fills.
    const m = blankMem();
    m.introDone = true;
    for (const c of COMP_LIB) {
      if (c.cat === 'grammaire' && (c.band === 'A1' || c.band === 'A2' || c.band === 'B1')) {
        m.comp[c.id] = { status: 'ok', lastSeen: '2026-08-17' };
      }
    }
    const sheets = sheetsForCall(m, []);
    expect(sheets.length).toBeGreaterThan(0);
    expect(sheets.length).toBeLessThanOrEqual(2);
    expect(sheetsById(undefined)).toHaveLength(0);
  });

  it('moves on instead of handing over the same sheet every day', () => {
    // The whole complaint: "accord de genre" came up call after call, because the top
    // weakness is stable BY DESIGN and relevance alone always picked it. Walk ten calls,
    // recording what each one carried, and count how much of the library gets seen.
    const m = seedMem('X');
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const picked = sheetsForCall(m, focusTargets(m, 3));
      expect(picked.length).toBeGreaterThan(0);
      picked.forEach(s => seen.add(s.id));
      m.sessions.push({
        id: 's' + i, date: '2026-08-0' + (i % 9), topic: 't', source: 'causerie',
        minutes: 8, materials: picked.map(s => s.id)
      });
    }
    expect(seen.size, 'ten calls should not keep showing the same two sheets').toBeGreaterThan(6);
  });

  it('a sheet the student pinned keeps coming back, however often they have read it', () => {
    const m = seedMem('X');
    m.pinned = ['g-b1-conditionnel'];
    for (let i = 0; i < 5; i++) {
      const picked = sheetsForCall(m, focusTargets(m, 3));
      expect(picked.map(s => s.id)).toContain('g-b1-conditionnel');
      m.sessions.push({
        id: 's' + i, date: '2026-08-0' + i, topic: 't', source: 'causerie',
        minutes: 8, materials: picked.map(s => s.id)
      });
    }
  });
});
