import type { FocusTarget, Memory } from '../types';
import { COMP_BY_ID } from './competencies';
import { norm } from './utils';

const RANK: Record<string, number> = { persisting: 0, new: 1, improving: 2 };

/** Gap-closing selection: user-pinned matrix cells first, then open weaknesses
 *  (persisting > new > improving, oldest first), then analysis suggestions, then a
 *  vocab-reuse filler. */
export function focusTargets(mem: Memory, n = 3): FocusTarget[] {
  const pinned: FocusTarget[] = (mem.pinned ?? [])
    .map(id => COMP_BY_ID[id])
    .filter(Boolean)
    .slice(0, n)
    .map(c => ({ kind: 'comp', id: c.id, label: c.label, cefr: c.band, status: 'new' as const }));
  const open = (mem.weaknesses ?? []).filter(w => w.status !== 'resolved');
  open.sort((a, b) =>
    (RANK[a.status] ?? 3) - (RANK[b.status] ?? 3) ||
    String(a.lastSeen).localeCompare(String(b.lastSeen))
  );
  const t: FocusTarget[] = [
    ...pinned,
    ...open.slice(0, Math.max(0, n - pinned.length)).map(w => ({
      kind: 'weakness' as const, id: w.id, label: w.label, cefr: w.cefr as string, status: w.status
    }))
  ];

  if (t.length < n && (mem.nextFocus ?? []).length) {
    for (const f of mem.nextFocus) {
      if (t.length >= n) break;
      if (!t.find(x => norm(x.label) === norm(f.label))) {
        t.push({ kind: 'suggestion', id: null, label: f.label, cefr: String(f.cefr ?? ''), status: 'new' });
      }
    }
  }

  if (t.length < n && (mem.vocab ?? []).length >= 4) {
    const last = mem.vocab.slice(-4).map(v => v.fr.replace(/^l[ae]s? /, '').replace(/^l’/, ''));
    t.push({
      kind: 'vocab', id: null,
      label: 'Utiliser 2 mots de ton carnet de vocabulaire : ' + last.slice(0, 3).join(', ') + '…',
      cefr: '', status: 'new'
    });
  }
  return t.slice(0, n);
}
