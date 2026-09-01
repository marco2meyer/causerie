import { describe, expect, it } from 'vitest';
import { PACKS } from '../../src/lang';
import { TEMPLATE_VARS } from '../../src/lib/prompts';
import { BANDS } from '../../src/lib/cefr';

/** Structural guarantees across ALL language packs: TypeScript already enforces UI-key
 *  parity (UIStrings is inferred from the French pack); these tests cover what types
 *  cannot see — template variables, id uniqueness, band coverage, sheet wiring. */

const packs = Object.values(PACKS);

describe('language packs', () => {
  it('ships five languages', () => {
    expect(Object.keys(PACKS).sort()).toEqual(['en', 'es', 'fr', 'it', 'pt']);
  });

  it('every tutor template carries every {{variable}} and the anti-persona guards', () => {
    for (const p of packs) {
      for (const v of TEMPLATE_VARS) {
        expect(p.tutor.template, `${p.code} misses {{${v}}}`).toContain(`{{${v}}}`);
      }
      // The two hard-won conduct rules must survive every translation:
      expect(p.tutor.template.toLowerCase()).toContain('odile');
      // Odile hangs up herself after the goodbyes, in every language:
      expect(p.tutor.template).toContain('end_call');
      expect(p.tutor.notes.timeUp).toContain('end_call');
      expect(p.tutor.notes.overtime).toContain('end_call');
      expect(p.tutor.greetIntro('X', 1)).toContain('Odile');
      // The opening has to tell the student what the call is FOR: the topic and how long
      // they have. A greeting that named neither left them guessing for the first minute.
      const daily = p.tutor.greetDaily('X', 'Y', 8);
      expect(daily).toContain('Y');
      expect(daily, `${p.code} greeting hides the length`).toContain('8');
      // From the second intro call on, Odile must NOT re-introduce herself and must
      // build on what she knows; the first call still introduces her.
      for (const n of [2, 3]) {
        const g = p.tutor.greetIntro('X', n);
        expect(g, `${p.code} intro ${n} lost the no-reintroduction rule`).not.toBe(p.tutor.greetIntro('X', 1));
        expect(g).toContain(String(n));
        expect(p.tutor.todayIntro(n), `${p.code} todayIntro ${n}`).not.toBe(p.tutor.todayIntro(1));
      }
    }
  });

  it('competency maps: unique ids, every band and category covered, own prefix', () => {
    for (const p of packs) {
      const ids = new Set(p.comp.map(c => c.id));
      expect(ids.size, p.code).toBe(p.comp.length);
      for (const b of BANDS) {
        for (const cat of ['grammaire', 'vocabulaire', 'fonctions'] as const) {
          const has = p.comp.some(c => c.band === b && c.cat === cat);
          // C2 vocabulary/functions exist everywhere; grammar C2 may be thin but present in all our packs
          expect(has, `${p.code} ${cat} ${b}`).toBe(true);
        }
      }
      const prefix = p.code === 'fr' ? '' : p.code + '-';
      expect(p.comp.every(c => c.id.startsWith(prefix + 'g-') || c.id.startsWith(prefix + 'v-') || c.id.startsWith(prefix + 'f-')), p.code).toBe(true);
    }
  });

  it('sheets: correct lang tag, globally unique ids, compact content', () => {
    const all = packs.flatMap(p => p.sheets);
    expect(new Set(all.map(s => s.id)).size).toBe(all.length);
    for (const p of packs) {
      expect(p.sheets.length, p.code).toBeGreaterThanOrEqual(10);
      for (const s of p.sheets) {
        expect(s.lang).toBe(p.code);
        expect(s.core.length).toBeGreaterThan(0);
        expect(s.core.length).toBeLessThanOrEqual(6);
        expect(s.examples.length).toBeGreaterThan(0);
        expect(s.examples.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it('topics: catalogue with intro agenda in every language', () => {
    for (const p of packs) {
      expect(p.topics.length, p.code).toBeGreaterThanOrEqual(14);
      expect(p.introTopics).toHaveLength(3);
      expect(p.topics.some(t => t.lv === 'A1'), p.code).toBe(true);
      expect(p.topics.some(t => t.lv === 'C1' || t.lv === 'C2'), p.code).toBe(true);
    }
  });

  it('metadata: locale, names and native labels are set', () => {
    for (const p of packs) {
      expect(p.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(p.self.length).toBeGreaterThan(2);
      expect(p.langName.length).toBeGreaterThan(2);
      expect(p.natives.de.length).toBeGreaterThan(2);
      expect(p.natives.en.length).toBeGreaterThan(2);
    }
  });
});
