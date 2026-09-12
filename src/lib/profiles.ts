import type { Memory } from '../types';
import { clearLegacyMem, loadLegacyMem, loadMemFor, saveMemFor, setActiveProfileId, wipeMemFor } from './storage';
import { deleteRemote } from './sync';
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

/** The device half of a deletion: the registry entry and the stored memory. Everything
 *  that lives elsewhere is removeProfile's business — call that one. */
export function deleteProfile(id: string): void {
  const r = readReg();
  r.list = r.list.filter(p => p.id !== id);
  if (r.active === id) r.active = r.list[0]?.id ?? null;
  writeReg(r);
  wipeMemFor(id);
  if (r.active) setActiveProfileId(r.active);
}

/**
 * removeProfile(id, ext?) → { remote, extension }
 *   Deleting a profile is a teardown, not a list edit: the copy on this device goes, the
 *   copy on the server goes, and anything an extension was running for it goes with them.
 *   One function so every caller does all three — a deletion that did only the first left
 *   a teacher writing on a messaging app for a profile that no longer existed, with no
 *   screen left in the app to stop her from.
 *   The two remote halves are best effort: each reports whether it succeeded, and neither
 *   failure keeps the profile on the device.
 */
export async function removeProfile(
  id: string,
  ext?: Forgetful | null
): Promise<{ remote: boolean; extension: boolean }> {
  const out = await forgetProfileElsewhere(id, ext);
  deleteProfile(id);
  return out;
}

/** What an extension has to offer for a profile to be torn down completely; the seam's
 *  CompanionModule satisfies it, and nothing here needs to know more than that. */
export interface Forgetful { forgetProfile?(profileKey: string): Promise<boolean> }

/** The halves of a deletion that live off this device, done without touching the local
 *  copy: the server blob and whatever the extension was running. Split out so a caller
 *  that wants to ASK before wiping the device (the "forget everything" button) can see
 *  what failed first. Each flag is true when that half is done or was never there. */
export async function forgetProfileElsewhere(
  id: string,
  ext?: Forgetful | null
): Promise<{ remote: boolean; extension: boolean }> {
  const pm = loadMemFor(id);
  const token = pm?.sync?.token || null;
  const out = { remote: true, extension: true };
  if (token && pm?.sync?.enabled) out.remote = await deleteRemote(token).catch(() => false);
  // An extension keys its own state by the profile's sync token — or by 'default' for a
  // profile that never had one, which is the same name it would have used itself.
  if (ext?.forgetProfile) out.extension = await ext.forgetProfile(token || 'default').catch(() => false);
  return out;
}
