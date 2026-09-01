import type { Memory } from '../types';
import { api } from './api';
import { migrate, saveMem, setOnSave } from './storage';
import { deleteRemoteProfile, pullProfile, pushProfile, supaSession } from './supa';

/** Cross-device persistence. With a Supabase session, each profile lives as one row in
 *  profiles_data under the account (RLS: owner only) — the sync "token" doubles as the
 *  stable profile_key across devices. Without a session, the legacy token-blob store on
 *  Netlify keeps working (access-code deployments, tests). Last write wins by updatedAt. */

function genToken(): string {
  const a = () => Math.random().toString(36).slice(2, 6);
  return `cz-${a()}-${a()}-${a()}`;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function put(token: string, mem: Memory): Promise<boolean> {
  if (supaSession()) return pushProfile(token, mem);
  const r = await fetch('/api/user-data', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...api.authHeaders() },
    body: JSON.stringify({ token, data: mem })
  });
  return r.ok;
}

/** A blob coming back from the server is whatever schema the device that wrote it was on,
 *  which is not necessarily this one. Everything read from localStorage passes through
 *  migrate(); the sync path did not, so a pull silently reinstated superseded defaults and
 *  the next save wrote them back. Any device on an older build could therefore undo a
 *  migration for every other device, indefinitely. Migrating here closes that loop. */
function migrated(raw: unknown): Memory | null {
  if (!raw) return null;
  return migrate(raw) ?? (raw as Memory);
}

export async function pull(token: string): Promise<Memory | null> {
  if (supaSession()) return migrated(await pullProfile(token));
  // Token travels as a header, not in the URL (URLs end up in logs).
  const r = await fetch('/api/user-data', { headers: { 'x-sync-token': token, ...api.authHeaders() } });
  if (!r.ok) return null;
  const j = await r.json();
  return migrated(j && j.data);
}

/** Deletes the server copy under this token. Best-effort false on any failure. */
export async function deleteRemote(token: string): Promise<boolean> {
  try {
    if (supaSession()) return await deleteRemoteProfile(token);
    if (!api.serverAvailable()) return false;
    const r = await fetch('/api/user-data', {
      method: 'DELETE',
      headers: { 'x-sync-token': token, ...api.authHeaders() }
    });
    return r.ok;
  } catch { return false; }
}

export function syncAvailable(): boolean {
  return !!supaSession() || api.serverAvailable();
}

/** Turns sync on for this memory: mints a token and pushes the current state. */
export async function enableSync(mem: Memory): Promise<string | null> {
  if (!syncAvailable()) return null;
  const token = mem.sync?.token || genToken();
  mem.sync = { token, enabled: true };
  const ok = await put(token, mem);
  if (!ok) { mem.sync.enabled = false; return null; }
  saveMem(mem);
  return token;
}

export function disableSync(mem: Memory): void {
  if (mem.sync) mem.sync.enabled = false;
  saveMem(mem);
}

/** Debounced push after every save; wired once at boot. */
export function wireAutoPush(): void {
  setOnSave(m => {
    if (!m.sync?.enabled || !syncAvailable()) return;
    if (pushTimer) clearTimeout(pushTimer);
    const token = m.sync.token;
    const snapshot = m;
    pushTimer = setTimeout(() => { void put(token, snapshot); }, 2500);
  });
}

/** On boot: if the profile syncs and the remote copy is newer, take it. */
export async function pullIfNewer(mem: Memory): Promise<Memory | null> {
  if (!mem.sync?.enabled || !syncAvailable()) return null;
  try {
    const remote = await pull(mem.sync.token);
    if (remote && remote.updatedAt && (!mem.updatedAt || remote.updatedAt > mem.updatedAt)) {
      return remote;
    }
  } catch { /* offline is fine */ }
  return null;
}
