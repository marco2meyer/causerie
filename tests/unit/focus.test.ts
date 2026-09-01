import { describe, expect, it } from 'vitest';
import { blankMem } from '../../src/lib/storage';
import { seedMem } from '../../src/lib/seed';
import { focusTargets } from '../../src/lib/focus';
import type { Weakness } from '../../src/types';

const W = (id: string, status: Weakness['status'], lastSeen: string): Weakness => ({
  id, label: 'w-' + id, cefr: 'A2', status, firstSeen: lastSeen, lastSeen, timesWorked: 0, evidence: []
});

describe('focusTargets', () => {
  it('ranks persisting > new > improving and never picks resolved', () => {
    const m = blankMem();
    m.weaknesses = [
      W('a', 'improving', '2026-01-01'),
      W('b', 'new', '2026-01-02'),
      W('c', 'persisting', '2026-01-03'),
      W('d', 'resolved', '2026-01-04')
    ];
    const t = focusTargets(m, 3);
    expect(t.map(x => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('prefers older lastSeen within the same status', () => {
    const m = blankMem();
    m.weaknesses = [W('newer', 'new', '2026-02-01'), W('older', 'new', '2026-01-01')];
    const t = focusTargets(m, 2);
    expect(t[0].id).toBe('older');
  });

  it('fills with next_focus suggestions and a vocab reminder', () => {
    const m = seedMem('Test');
    m.weaknesses = []; // no gaps left
    m.nextFocus = [{ label: 'Subjonctif ausprobieren', cefr: 'B1', grund: 'x' }];
    const t = focusTargets(m, 3);
    expect(t[0].kind).toBe('suggestion');
    expect(t[1].kind).toBe('vocab'); // seed has ≥4 vocab entries
    expect(t.length).toBeLessThanOrEqual(3);
  });

  it('caps at n', () => {
    const m = seedMem('Test'); // six open weaknesses
    expect(focusTargets(m, 3)).toHaveLength(3);
  });
});
