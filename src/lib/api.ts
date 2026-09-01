/** Connection layer. The app can talk to OpenAI two ways, chosen by the user:
 *  - key source "server": requests go through the Netlify functions; the OpenAI key
 *    stays server-side, authorized by access code or Google ID token.
 *  - key source "own": the browser talks to OpenAI directly with a key the user pasted
 *    (stored only in this browser). Works everywhere, including the dev server and the
 *    standalone file, and needs no access code.
 */

export type ApiMode = 'unknown' | 'server' | 'local';
export type AuthKind = 'none' | 'code' | 'google' | 'open' | 'supabase' | 'unconfigured';
export type KeySource = 'server' | 'own';

export interface ApiInfo {
  mode: ApiMode;
  auth: AuthKind;
  googleClientId: string | null;
  keyConfigured?: boolean;
  keySource: KeySource;
}

import { supaSession, supaToken } from './supa';
import { appendLocalCost } from './costs';

/** Test hook: e2e runs point this at a local relay. */
export const OAI = (): string => window.CAUSERIE_OAI || 'https://api.openai.com';

const state: ApiInfo = { mode: 'unknown', auth: 'none', googleClientId: null, keySource: 'own' };

function readKeySource(): KeySource {
  // legacy flag from the previous version
  if (localStorage.getItem('causerie.forceLocal') === '1') {
    localStorage.removeItem('causerie.forceLocal');
    localStorage.setItem('causerie.keySource', 'own');
  }
  return (localStorage.getItem('causerie.keySource') as KeySource) || 'own';
}

export const api = {
  get mode() { return state.mode; },
  get auth() { return state.auth; },
  get googleClientId() { return state.googleClientId; },
  get keyConfigured() { return state.keyConfigured; },
  get keySource() { return state.keySource; },

  async detect(): Promise<ApiInfo> {
    state.keySource = readKeySource();
    if (location.protocol !== 'file:') {
      try {
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), 3500);
        const r = await fetch('/api/health', { signal: ctl.signal });
        clearTimeout(to);
        if (r.ok) {
          const j = await r.json();
          state.mode = 'server';
          state.auth = j.auth || 'none';
          state.googleClientId = j.googleClientId || null;
          state.keyConfigured = j.keyConfigured !== false;
          // First run on a server deployment: default to the server key if it exists.
          if (!localStorage.getItem('causerie.keySource') && state.keyConfigured) {
            state.keySource = 'server';
            localStorage.setItem('causerie.keySource', 'server');
          }
          return { ...state };
        }
      } catch { /* fall through */ }
    }
    state.mode = 'local';
    state.keySource = 'own';
    return { ...state };
  },

  setKeySource(s: KeySource): void {
    state.keySource = s;
    localStorage.setItem('causerie.keySource', s);
  },

  /** True when OpenAI calls should go through the Netlify functions. */
  useServer(): boolean {
    return state.mode === 'server' && state.keySource === 'server';
  },
  /** True when the functions API itself is reachable and authorized (sync, server TTS). */
  serverAvailable(): boolean {
    return state.mode === 'server' && (!!supaSession() || state.auth === 'open' || !!api.getCode() || !!api.getGToken());
  },

  getKey: () => localStorage.getItem('causerie.key') || '',
  setKey: (k: string) => localStorage.setItem('causerie.key', (k || '').trim()),
  getCode: () => localStorage.getItem('causerie.access') || '',
  setCode: (c: string) => localStorage.setItem('causerie.access', (c || '').trim()),
  getGToken: () => sessionStorage.getItem('causerie.gtoken') || '',

  authHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    if (supaToken()) h['authorization'] = 'Bearer ' + supaToken();
    if (api.getCode()) h['x-access-code'] = api.getCode();
    if (api.getGToken()) h['x-google-token'] = api.getGToken();
    return h;
  },

  /** Can we start a call right now? */
  ready(): boolean {
    if (api.useServer()) return !!supaSession() || state.auth === 'open' || !!api.getCode() || !!api.getGToken();
    return !!api.getKey();
  },

  /** Reports one call's usage: server ledger when signed in, and ALWAYS the local
   *  estimated ring, so access-code/own-key users see their costs too. */
  postCost(entry: Record<string, unknown>): void {
    appendLocalCost(entry);
    if (state.mode !== 'server' || !supaSession()) return;
    void fetch('/api/cost', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...api.authHeaders() },
      body: JSON.stringify(entry)
    }).catch(() => undefined);
  },

  googleSignIn(el: HTMLElement, onDone?: () => void): void {
    if (!state.googleClientId) return;
    const boot = () => {
      window.google.accounts.id.initialize({
        client_id: state.googleClientId,
        callback: (resp: { credential: string }) => {
          sessionStorage.setItem('causerie.gtoken', resp.credential);
          onDone && onDone();
        }
      });
      window.google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with' });
    };
    if (window.google?.accounts) boot();
    else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = boot;
      document.head.appendChild(s);
    }
  }
};
