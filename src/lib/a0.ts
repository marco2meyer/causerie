import type { LangCode, Memory } from '../types';
import { pack } from '../lang';
import { newCard } from './srs';

/** Absolute-beginner start ("0 — starting from zero"): flag the profile (the tutor
 *  then leads in the native language and teaches survival phrases) and seed a small
 *  survival deck so day one is never an empty app. */
export function seedA0(mem: Memory, target: LangCode, native: 'de' | 'en'): void {
  mem.profile.a0 = true;
  mem.deck.cards.push(...pack(target).starter.map(s => newCard({
    type: 'fr2de', front: s.t, back: native === 'en' ? s.en : s.de,
    audioText: s.t, tag: 'A0', sourceKind: 'seed'
  })));
}
