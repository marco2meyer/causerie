import type { Memory } from '../types';
import { clearLegacyMem, loadLegacyMem, loadMemFor, saveMemFor, setActiveProfileId, wipeMemFor } from './storage';
import { uid } from './utils';

export interface ProfileEntry { id: string; name: string; createdAt: string; lastUsed: string }
interface Registry { v: 1; active: string | null; list: ProfileEntry[] }

const RKEY = 'causerie.profiles.v1';

function readReg(): Registry {
  try {
    const r = localStorage.getItem(RKEY);
    if (r) {
      const j = JSON.parse(r) as Registry;
      if (j.v === 1 && Array.isArray(j.list)) return j;
    }
  } catch { /* fall through */ }
  return { v: 1, active: null, list: [] };
}
function writeReg(r: Registry): void {
  localStorage.setItem(RKEY, JSON.stringify(r));
}

export function listProfiles(): ProfileEntry[] {
  return readReg().list;
}

/** Target language of a stored profile (for the language chips), null if unreadable. */
export function profileLang(id: string): string | null {
  try { return loadMemFor(id)?.profile.target ?? null; } catch { return null; }
}
export function activeProfile(): ProfileEntry | null {
  const r = readReg();
  return r.list.find(p => p.id === r.active) ?? null;
}

/** Boot: migrates a legacy single-profile memory into the registry, activates the last
 *  used profile, and returns its memory (null → onboarding). */
export function initProfiles(): { entry: ProfileEntry | null; mem: Memory | null } {
  const r = readReg();
  const legacy = loadLegacyMem();
  if (legacy && !r.list.length) {
    const entry: ProfileEntry = {
      id: uid('p'), name: legacy.profile.name || 'Profil 1',
      createdAt: new Date().toISOString(), lastUsed: new Date().toISOString()
    };
    r.list.push(entry);
    r.active = entry.id;
    writeReg(r);
    saveMemFor(entry.id, legacy);
    clearLegacyMem();
  }
  const rr = readReg();
  const entry = rr.list.find(p => p.id === rr.active) ?? rr.list[0] ?? null;
  if (!entry) return { entry: null, mem: null };
  setActiveProfileId(entry.id);
  return { entry, mem: loadMemFor(entry.id) };
}

export function createProfile(name: string, mem: Memory): ProfileEntry {
  const r = readReg();
  const entry: ProfileEntry = { id: uid('p'), name: name || 'Profil', createdAt: new Date().toISOString(), lastUsed: new Date().toISOString() };
  r.list.push(entry);
  r.active = entry.id;
  writeReg(r);
  setActiveProfileId(entry.id);
  saveMemFor(entry.id, mem);
  return entry;
}

export function switchProfile(id: string): Memory | null {
  const r = readReg();
  const entry = r.list.find(p => p.id === id);
  if (!entry) return null;
  r.active = id;
  entry.lastUsed = new Date().toISOString();
  writeReg(r);
  setActiveProfileId(id);
  return loadMemFor(id);
}

export function renameProfile(id: string, name: string): void {
  const r = readReg();
  const e = r.list.find(p => p.id === id);
  if (e) { e.name = name; writeReg(r); }
}

export function deleteProfile(id: string): void {
  const r = readReg();
  r.list = r.list.filter(p => p.id !== id);
  if (r.active === id) r.active = r.list[0]?.id ?? null;
  writeReg(r);
  wipeMemFor(id);
  if (r.active) setActiveProfileId(r.active);
}
