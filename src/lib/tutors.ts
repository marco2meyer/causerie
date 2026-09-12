// The tutors on offer for the call: name, gender (for the packs' gendered strings), and
// the voice the realtime API gives them. The face lives in components/Avatar.tsx, keyed
// by the same string. The default is Odile, and every profile from before the carousel
// stays hers. A build with the companion extension keeps `profile.tutor` in step with the
// chosen companion persona; the public app offers the same four in the settings.
import type { Memory } from '../types';
import { setTutor } from '../lang';
import { todayISO } from './utils';

export type TutorKey = 'odile' | 'marcel' | 'solene' | 'nour' | 'bakary' | 'rosa';

export interface Tutor {
  key: TutorKey;
  name: string;
  gender: 'f' | 'm' | 'x';
  /** Realtime voice id (one of langs.VOICES). Written into settings.voice on switch. */
  voice: string;
}

export const TUTORS: Record<TutorKey, Tutor> = {
  odile: { key: 'odile', name: 'Odile', gender: 'f', voice: 'marin' },
  marcel: { key: 'marcel', name: 'Marcel', gender: 'm', voice: 'cedar' },
  solene: { key: 'solene', name: 'Solène', gender: 'f', voice: 'coral' },
  nour: { key: 'nour', name: 'Nour', gender: 'x', voice: 'sage' },
  bakary: { key: 'bakary', name: 'Bakary', gender: 'm', voice: 'ash' },
  rosa: { key: 'rosa', name: 'Rosa', gender: 'f', voice: 'shimmer' }
};

export const isTutorKey = (k: unknown): k is TutorKey =>
  typeof k === 'string' && Object.prototype.hasOwnProperty.call(TUTORS, k);

/** The profile's tutor, Odile when unset or unknown. */
export const tutorOf = (mem: Pick<Memory, 'profile'> | null | undefined): Tutor =>
  TUTORS[isTutorKey(mem?.profile?.tutor) ? mem!.profile.tutor as TutorKey : 'odile'];

/** Write the choice: the key on the profile, the voice into the settings (still a free
 *  setting afterwards — switching tutors is the one moment the voice follows). */
export function chooseTutor(mem: Memory, key: TutorKey): void {
  mem.profile.tutor = key;
  mem.settings.voice = TUTORS[key].voice;
}

/** How many calls the handover note stays in the briefing: after that the new tutor
 *  has met the student, and the note is stale noise. */
export const HANDOVER_CALLS = 3;

/** Change hands. The relationship resets: the personal facts leave with the old tutor,
 *  and only the learning file — level, weaknesses, interests, direction, cards — stays,
 *  because that belongs to the app, not to a person. A handover marker is set so the
 *  briefing carries a bare-bones note for the first few calls and conversations from
 *  before the switch are never referenced again. Returns false when nothing changed. */
export function switchTutor(mem: Memory, key: TutorKey): boolean {
  const from = tutorOf(mem);
  if (from.key === key) return false;
  mem.handover = { from: from.key, date: todayISO() };
  mem.facts = [];
  chooseTutor(mem, key);
  return true;
}

/** The handover while it still matters: who handed over, and how many calls the new
 *  tutor has had since. Null once the note has done its work (HANDOVER_CALLS calls),
 *  or when there was never a switch. */
export function handoverActive(mem: Pick<Memory, 'handover' | 'sessions' | 'profile'>): { from: Tutor; calls: number } | null {
  const h = mem.handover;
  if (!h || !isTutorKey(h.from) || h.from === tutorOf(mem).key) return null;
  const calls = (mem.sessions ?? []).filter(s => s.date >= h.date).length;
  return calls < HANDOVER_CALLS ? { from: TUTORS[h.from], calls } : null;
}

/* The active tutor, module-level like the active UI language: app.tsx applies it on
 * every render from the live profile, so the face, the strings and the briefing all
 * follow a profile switch instantly. */
let active: TutorKey = 'odile';
export const activeTutor = (): Tutor => TUTORS[active];

/** Point the whole app (face + every pack string) at the profile's tutor. */
export function applyTutor(mem: Pick<Memory, 'profile'> | null | undefined): void {
  const t = tutorOf(mem);
  active = t.key;
  setTutor({ key: t.key, name: t.name, gender: t.gender });
}
