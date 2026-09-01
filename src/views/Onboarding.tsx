import { useEffect, useRef, useState } from 'preact/hooks';
import type { Memory, LangCode, CEFRBand } from '../types';
import { api, OAI, type ApiInfo, type KeySource } from '../lib/api';
import { BANDS } from '../lib/cefr';
import { LANGS } from '../lib/langs';
import { blankMem, migrate } from '../lib/storage';
import {
  hasOwnKey, isAllowlisted, listRemoteProfiles, pullProfile, saveOwnKey,
  signInGoogle, signOut, supaEmail, supaSession
} from '../lib/supa';
import { Odile } from '../components/Avatar';
import { setUiLang, ui, uiLangCode, type UiLangCode } from '../lang';
import { seedA0 } from '../lib/a0';

/** Signup runs in a SUPPORT language (browser locale by default, switchable): a German
 *  Spanish-learner must be able to read the form. The immersive target-language UI only
 *  starts after signup (and only from B1 — see uiLangFor). */
const ONB_LANGS: [UiLangCode, string][] = [['de', 'DE'], ['en', 'EN'], ['fr', 'FR'], ['es', 'ES'], ['it', 'IT'], ['pt', 'PT']];
const NATIVE_LABEL: Record<'de' | 'en', string> = { de: '🇩🇪 Deutsch', en: '🇬🇧 English' };

interface Props {
  apiInfo: ApiInfo;
  /** false when adding another profile on a device that already has working access. */
  needsAccess: boolean;
  /** true on a fresh device: after login, jump straight into the last-used profile. */
  autoResume: boolean;
  toast: (msg: string, err?: boolean) => void;
  onDone: (mem: Memory) => void;
  onCancel?: () => void;
}

/** Supabase login flow: Google only. After login, non-allowlisted accounts are asked
 *  for their own OpenAI key once; then the most recently used profile of the account
 *  opens directly (or the new-profile form when the account has none). */
type Phase = 'signedout' | 'checking' | 'needkey' | 'newprofile';

export function Onboarding({ apiInfo, needsAccess, autoResume, toast, onDone, onCancel }: Props) {
  const supa = apiInfo.auth === 'supabase';
  const S = ui();
  const [name, setName] = useState('');
  const [target, setTarget] = useState<LangCode>('fr');
  const [native, setNative] = useState<Memory['profile']['native']>('de');
  const [lvl, setLvl] = useState<CEFRBand>('A1');
  const [a0, setA0] = useState(false); // absolute beginner: knows the language not at all
  const [, bump] = useState(0);
  const switchUi = (code: UiLangCode) => { setUiLang(code); bump(n => n + 1); };
  const [access, setAccess] = useState<KeySource>(apiInfo.mode === 'server' ? apiInfo.keySource : 'own');
  const [key, setKey] = useState(api.getKey());
  const [code, setCode] = useState(api.getCode());
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>('signedout');
  const [acctKey, setAcctKey] = useState('');
  const gref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supa && needsAccess && apiInfo.mode === 'server' && apiInfo.auth === 'google' && gref.current) {
      api.googleSignIn(gref.current, () => toast(S.settings.connected + '.'));
    }
  }, [apiInfo]);

  // Google-only account flow.
  useEffect(() => {
    if (!supa) return;
    if (!supaSession()) { setPhase('signedout'); return; }
    void (async () => {
      setPhase('checking');
      api.setKeySource('server');
      const [allow, own] = await Promise.all([isAllowlisted(), hasOwnKey()]);
      if (!allow && !own) { setPhase('needkey'); return; }
      await afterKeyGate();
    })();
  }, [supa]);

  /** Key gate passed: open the account's last-used profile, else the new-profile form. */
  const afterKeyGate = async () => {
    setPhase('checking');
    if (autoResume) {
      const remotes = await listRemoteProfiles(); // ordered by updated_at desc
      if (remotes.length) {
        const raw = await pullProfile(remotes[0].profile_key);
        const m = raw ? migrate(raw) : null;
        if (m) {
          m.sync = { token: remotes[0].profile_key, enabled: true };
          onDone(m);
          return;
        }
        toast(S.onboarding.loadProfileFailed, true);
      }
    }
    setPhase('newprofile');
  };

  const saveAccountKey = async () => {
    const k = acctKey.trim();
    if (!k) return;
    setBusy(true);
    try {
      const r = await fetch(OAI() + '/v1/models?limit=1', { headers: { Authorization: 'Bearer ' + k } });
      if (!r.ok) { toast(S.settings.keyRefused(r.status), true); setBusy(false); return; }
      const ok = await saveOwnKey(k);
      if (!ok) { toast(S.settings.keySaveFailed, true); setBusy(false); return; }
    } catch {
      toast(S.settings.netError, true);
      setBusy(false);
      return;
    }
    setBusy(false);
    setAcctKey('');
    await afterKeyGate();
  };

  const start = async () => {
    setBusy(true);
    try {
      if (supa) {
        if (!supaSession()) { toast(S.onboarding.signInFirst, true); setBusy(false); return; }
      } else if (needsAccess) {
        if (access === 'own' || apiInfo.mode === 'local') {
          if (!key.trim()) { toast(S.onboarding.enterKey, true); setBusy(false); return; }
          api.setKey(key);
          api.setKeySource('own');
          const r = await fetch(OAI() + '/v1/models?limit=1', { headers: { Authorization: 'Bearer ' + key.trim() } });
          if (!r.ok) { toast(S.settings.keyRefused(r.status), true); setBusy(false); return; }
        } else {
          api.setKeySource('server');
          if (apiInfo.auth === 'code') {
            api.setCode(code);
            const r = await fetch('/api/rt-token', {
              method: 'POST',
              headers: { 'content-type': 'application/json', ...api.authHeaders() },
              body: JSON.stringify({ probe: true })
            });
            if (r.status === 401) { toast(S.settings.codeWrong, true); setBusy(false); return; }
          }
        }
      }
      const mem = blankMem();
      mem.profile.name = name.trim() || S.settings.firstName;
      mem.profile.target = target;
      mem.profile.native = native;
      const idx = a0 ? 0 : Math.max(0, BANDS.indexOf(lvl) * 2);
      mem.cefr.overall = idx;
      (Object.keys(mem.cefr.skills) as (keyof typeof mem.cefr.skills)[]).forEach(k => (mem.cefr.skills[k] = idx));
      if (a0) seedA0(mem, target, native);
      onDone(mem);
    } catch (e) {
      toast(S.onboarding.error((e as Error).message), true);
    }
    setBusy(false);
  };

  const hero = (
    <div>
      <div class="spread">
        <div class="wordmark">
          <span style="width:10px;height:10px;border-radius:50%;background:var(--tomato)"></span>
          Causerie
        </div>
        <div class="row" style="gap:8px;align-items:center">
          <div class="onb-langs" role="group" aria-label="Language">
            {ONB_LANGS.map(([code, label]) => (
              <button key={code} class={'onb-lang' + (uiLangCode() === code ? ' on' : '')}
                aria-pressed={uiLangCode() === code} onClick={() => switchUi(code)}>{label}</button>
            ))}
          </div>
          {onCancel && <button class="btn subtle" onClick={onCancel}>{S.common.cancel}</button>}
        </div>
      </div>
      <div style="display:flex;gap:16px;align-items:flex-end;margin-top:26px">
        <div style="width:108px;flex-shrink:0"><Odile state="idle" /></div>
        <div class="hero-bubble" style="margin-bottom:10px">
          <span class="fr">{S.onboarding.heroLine}</span>
        </div>
      </div>
      <h1>{S.onboarding.title1}<br />{S.onboarding.title2}</h1>
      <p class="muted" style="line-height:1.55;margin:6px 0 0">
        {S.onboarding.sub}
      </p>
      <div class="hr"></div>
    </div>
  );

  /* ---- Supabase (production) : Google only ---- */
  if (supa && phase === 'signedout') {
    return (
      <div class="onb fadein">
        {hero}
        <button class="btn primary big" style="margin-top:8px" onClick={() => void signInGoogle()}>
          {S.onboarding.google}
        </button>
      </div>
    );
  }
  if (supa && phase === 'checking') {
    return (
      <div class="onb fadein">
        {hero}
        <div style="text-align:center;padding:26px 0"><div class="spinner"></div><div class="muted">{S.common.moment}</div></div>
      </div>
    );
  }
  if (supa && phase === 'needkey') {
    return (
      <div class="onb fadein">
        {hero}
        <div class="field">
          <label>{S.onboarding.yourKey}</label>
          <p class="muted" style="margin:0 0 10px;font-size:14px;line-height:1.5">
            {S.onboarding.notOnList(supaEmail())}
          </p>
          <input type="password" placeholder="sk-…" value={acctKey} onInput={e => setAcctKey((e.target as HTMLInputElement).value)} />
          <button class="btn primary big" style="margin-top:12px" disabled={busy || !acctKey.trim()} onClick={() => void saveAccountKey()}>
            {busy ? S.common.moment : S.onboarding.saveContinue}
          </button>
          <button class="btn subtle" style="margin-top:8px" onClick={() => { void signOut().then(() => setPhase('signedout')); }}>
            {S.onboarding.changeAccount}
          </button>
        </div>
      </div>
    );
  }

  /* ---- New-profile form (account without profile, extra profile, or legacy modes) ---- */
  return (
    <div class="onb fadein">
      {hero}

      {supa && <div class="tiny" style="margin:-6px 0 14px">{S.onboarding.connectedAs} {supaEmail()}</div>}

      <div class="field">
        <label>{S.onboarding.yourFirstName}</label>
        <input value={name} onInput={e => setName((e.target as HTMLInputElement).value)} />
      </div>

      <div class="field">
        <label>{S.onboarding.youLearn}</label>
        <div class="pills">
          {(Object.entries(LANGS) as [LangCode, (typeof LANGS)[LangCode]][]).map(([k, v]) => (
            <button key={k} class={'pill ' + (target === k ? 'on' : '')} onClick={() => setTarget(k)}>{v.flag} {v.name}</button>
          ))}
        </div>
      </div>

      <div class="field">
        <label>{S.onboarding.yourMotherTongue}</label>
        <div class="pills">
          {(['de', 'en'] as const).map(k => (
            <button key={k} class={'pill ' + (native === k ? 'on' : '')}
              onClick={() => { setNative(k); switchUi(k === 'de' ? 'de' : 'en'); }}>{NATIVE_LABEL[k]}</button>
          ))}
        </div>
      </div>

      <div class="field">
        <label>{S.onboarding.yourLevel}</label>
        <div class="pills">
          <button class={'pill ' + (a0 ? 'on' : '')} onClick={() => { setA0(true); setLvl('A1'); }}>{S.onboarding.a0Label}</button>
          {BANDS.map(b => <button key={b} class={'pill ' + (!a0 && lvl === b ? 'on' : '')} onClick={() => { setA0(false); setLvl(b); }}>{b}</button>)}
        </div>
        <div class="tiny" style="margin-top:7px">{a0 ? S.onboarding.a0Hint : S.onboarding.levelNote}</div>
      </div>

      {!supa && needsAccess && (
        <div class="field">
          <label>{S.onboarding.accessLabel}</label>
          {apiInfo.mode === 'server' ? (
            <div>
              <div class="accesscards">
                <button class={'accesscard ' + (access === 'server' ? 'on' : '')} onClick={() => setAccess('server')}>
                  <div class="t">{S.onboarding.withCode}</div>
                  <div class="d">{S.onboarding.withCodeNote}
                    {apiInfo.keyConfigured === false ? S.onboarding.serverKeyMissing : ''}</div>
                </button>
                <button class={'accesscard ' + (access === 'own' ? 'on' : '')} onClick={() => setAccess('own')}>
                  <div class="t">{S.onboarding.withOwnKey}</div>
                  <div class="d">{S.onboarding.withOwnKeyNote}</div>
                </button>
              </div>
              {access === 'server' && apiInfo.auth !== 'google' && (
                <input style="margin-top:10px" type="password" placeholder={S.onboarding.codePlaceholder} value={code} onInput={e => setCode((e.target as HTMLInputElement).value)} />
              )}
              {access === 'server' && apiInfo.auth === 'google' && <div ref={gref} style="margin-top:10px"></div>}
              {access === 'own' && (
                <input style="margin-top:10px" type="password" placeholder="sk-…" value={key} onInput={e => setKey((e.target as HTMLInputElement).value)} />
              )}
            </div>
          ) : (
            <input type="password" placeholder={S.onboarding.keyPlaceholder} value={key} onInput={e => setKey((e.target as HTMLInputElement).value)} />
          )}
        </div>
      )}

      <button class="btn primary big" style="margin-top:22px" disabled={busy} onClick={start}>
        {busy ? S.common.moment : S.onboarding.go}
      </button>
    </div>
  );
}
