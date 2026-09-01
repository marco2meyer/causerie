import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Memory } from '../types';

/** Supabase backing: accounts (Google / e-mail code), per-user profile storage and the
 *  per-conversation cost ledger. OPT-IN: configured via VITE_SUPABASE_URL and
 *  VITE_SUPABASE_ANON_KEY at build time (.env.local), and OFF without them — a build
 *  of this repo must never send its users to somebody else's database. URL and
 *  publishable key are public by design (RLS guards every row); tests can override via
 *  window.CAUSERIE_SUPA = { url, key } or disable with window.CAUSERIE_SUPA = null. */

declare global {
  interface Window { CAUSERIE_SUPA?: { url: string; key: string } | null }
}

function conf(): { url: string; key: string } | null {
  if (typeof window !== 'undefined' && 'CAUSERIE_SUPA' in window) return window.CAUSERIE_SUPA ?? null;
  const url = import.meta.env?.VITE_SUPABASE_URL || '';
  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
  return url && key ? { url, key } : null;
}

let client: SupabaseClient | null = null;
let session: Session | null = null;
const listeners = new Set<(s: Session | null) => void>();

export function supaEnabled(): boolean {
  return conf() !== null;
}

function getClient(): SupabaseClient | null {
  const c = conf();
  if (!c) return null;
  if (!client) {
    client = createClient(c.url, c.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'causerie.supa' }
    });
    client.auth.onAuthStateChange((_e, s) => {
      session = s;
      listeners.forEach(fn => fn(s));
    });
  }
  return client;
}

/** Hydrates the stored session (and completes an OAuth redirect). Call once at boot. */
export async function supaInit(): Promise<Session | null> {
  const c = getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  session = data.session;
  return session;
}

/** The live client, for the few places that read a table directly rather than through a
 *  helper here (lib/events). Null when Supabase is disabled, which tests rely on. */
export function supaClient(): SupabaseClient | null { return getClient(); }

export function supaSession(): Session | null { return session; }
export function supaEmail(): string { return session?.user?.email?.toLowerCase() || ''; }
export function supaToken(): string { return session?.access_token || ''; }
export function onSupaChange(fn: (s: Session | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Which login buttons to show (reads the project's enabled providers). */
export async function enabledProviders(): Promise<{ google: boolean; email: boolean }> {
  const c = conf();
  if (!c) return { google: false, email: false };
  try {
    const r = await fetch(c.url + '/auth/v1/settings', { headers: { apikey: c.key } });
    const j = await r.json();
    return { google: !!j?.external?.google, email: j?.external?.email !== false };
  } catch {
    return { google: false, email: true };
  }
}

export async function signInGoogle(): Promise<void> {
  const c = getClient();
  if (!c) return;
  await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } });
}

export async function sendEmailCode(email: string): Promise<string | null> {
  const c = getClient();
  if (!c) return 'indisponible';
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return error ? error.message : null;
}

export async function verifyEmailCode(email: string, code: string): Promise<string | null> {
  const c = getClient();
  if (!c) return 'indisponible';
  const { error } = await c.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  await getClient()?.auth.signOut();
}

/* ---- data (all through PostgREST under the user's own JWT) --------------- */

function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const c = conf()!;
  return fetch(c.url + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: c.key,
      authorization: 'Bearer ' + supaToken(),
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined)
    }
  });
}

/** Upserts the full memory blob for one profile. */
export async function pushProfile(profileKey: string, mem: Memory): Promise<boolean> {
  if (!session) return false;
  try {
    const r = await rest('profiles_data?on_conflict=user_id,profile_key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: session.user.id,
        profile_key: profileKey,
        name: mem.profile.name || null,
        mem,
        updated_at: new Date().toISOString()
      })
    });
    return r.ok;
  } catch { return false; }
}

export interface RemoteProfile { profile_key: string; name: string | null; updated_at: string }

export async function listRemoteProfiles(): Promise<RemoteProfile[]> {
  if (!session) return [];
  try {
    const r = await rest('profiles_data?select=profile_key,name,updated_at&order=updated_at.desc');
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

export async function pullProfile(profileKey: string): Promise<Memory | null> {
  if (!session) return null;
  try {
    const r = await rest('profiles_data?select=mem&profile_key=eq.' + encodeURIComponent(profileKey) + '&limit=1');
    if (!r.ok) return null;
    const j = await r.json();
    return (j?.[0]?.mem as Memory) ?? null;
  } catch { return null; }
}

/** Deletes the server copy of one profile ("forget everything" must reach the server). */
export async function deleteRemoteProfile(profileKey: string): Promise<boolean> {
  if (!session) return false;
  try {
    const r = await rest('profiles_data?profile_key=eq.' + encodeURIComponent(profileKey), { method: 'DELETE' });
    return r.ok;
  } catch { return false; }
}

/* Card images: personal memory hooks, stored per card OUTSIDE the profile blob so the
 * frequent profile pushes stay small. Own-row RLS. */

export async function pushCardImg(cardId: string, img: string): Promise<boolean> {
  if (!session) return false;
  try {
    const r = await rest('card_images?on_conflict=user_id,card_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: session.user.id, card_id: cardId, img, updated_at: new Date().toISOString() })
    });
    return r.ok;
  } catch { return false; }
}

export async function pullCardImg(cardId: string): Promise<string | null> {
  if (!session) return null;
  try {
    const r = await rest('card_images?select=img&card_id=eq.' + encodeURIComponent(cardId) + '&limit=1');
    if (!r.ok) return null;
    const j = await r.json();
    return (j?.[0]?.img as string) ?? null;
  } catch { return null; }
}

export async function delCardImg(cardId: string): Promise<void> {
  if (!session) return;
  try { await rest('card_images?card_id=eq.' + encodeURIComponent(cardId), { method: 'DELETE' }); } catch { /* best effort */ }
}

/** Whether this account's e-mail is on the server-key allowlist (RLS lets each user
 *  see only their own row, so this leaks nothing about the list itself). */
export async function isAllowlisted(): Promise<boolean> {
  if (!session) return false;
  try {
    const r = await rest('server_key_allowlist?select=email&email=eq.' + encodeURIComponent(supaEmail()));
    if (!r.ok) return false;
    return ((await r.json()) as unknown[]).length > 0;
  } catch { return false; }
}

/** The user's own OpenAI key (used when their e-mail is not on the server allowlist). */
export async function saveOwnKey(key: string): Promise<boolean> {
  if (!session) return false;
  try {
    const r = await rest('user_keys?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: session.user.id, openai_key: key.trim(), updated_at: new Date().toISOString() })
    });
    return r.ok;
  } catch { return false; }
}

export async function hasOwnKey(): Promise<boolean> {
  if (!session) return false;
  try {
    const r = await rest('user_keys?select=user_id&user_id=eq.' + session.user.id);
    if (!r.ok) return false;
    return ((await r.json()) as unknown[]).length > 0;
  } catch { return false; }
}

export interface CostRow {
  created_at: string; kind: string; model: string | null;
  cost_usd: number; seconds: number | null; key_source: string | null;
}

export async function listCosts(limit = 60): Promise<CostRow[]> {
  if (!session) return [];
  try {
    const r = await rest('conversation_costs?select=created_at,kind,model,cost_usd,seconds,key_source&order=created_at.desc&limit=' + limit);
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}
