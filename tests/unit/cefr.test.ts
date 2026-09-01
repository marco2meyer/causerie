import { describe, expect, it } from 'vitest';
import { band, idxLvl, LEVELS, lvlIdx } from '../../src/lib/cefr';

describe('cefr scale', () => {
  it('roundtrips every level', () => {
    LEVELS.forEach((l, i) => {
      expect(lvlIdx(l)).toBe(i);
      expect(idxLvl(i)).toBe(l);
    });
  });

  it('tolerates bare bands and junk', () => {
    expect(lvlIdx('B1')).toBe(4);
    expect(lvlIdx('b2+')).toBe(LEVELS.indexOf('B2')); // falls back to the band
    expect(lvlIdx('nonsense')).toBe(-1);
    expect(lvlIdx(undefined)).toBe(-1);
  });

  it('clamps indexes', () => {
    expect(idxLvl(-5)).toBe('A1');
    expect(idxLvl(99)).toBe('C2+');
  });

  it('maps indexes to bands', () => {
    expect(band(0)).toBe('A1');
    expect(band(1)).toBe('A1');
    expect(band(2)).toBe('A2');
    expect(band(3)).toBe('A2');
    expect(band(11)).toBe('C2');
  });
});
