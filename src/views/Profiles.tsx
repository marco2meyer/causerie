import { useEffect, useState } from 'preact/hooks';
import type { CEFRBand, LangCode, Memory } from '../types';
import { BANDS } from '../lib/cefr';
import { LANGS } from '../lib/langs';
import { activeProfile, deleteProfile, listProfiles, profileLang, renameProfile, switchProfile } from '../lib/profiles';
import { createProfile } from '../lib/profiles';
import { blankMem } from '../lib/storage';
import { deleteRemote, disableSync, enableSync, pull, syncAvailable } from '../lib/sync';
import { loadMemFor, migrate, saveMem } from '../lib/storage';
import { listRemoteProfiles, pullProfile, supaEmail, supaSession, type RemoteProfile } from '../lib/supa';
import { deepClone, fmtDate } from '../lib/utils';
import { ui, uiFor } from '../lang';
import { seedA0 } from '../lib/a0';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  onSwitch: (mem: Memory) => void;
  onNewProfile: () => void;
  go: (view: string) => void;
  toast: (msg: string, err?: boolean) => void;
}

/** User management: local profiles on this device, each with its own memory and deck,
 *  plus optional cross-device sync via a token (server deployments). */
export function Profiles({ mem, setMem, onSwitch, onNewProfile, go, toast }: Props) {
  const S = ui();
  const [syncCode, setSyncCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [remotes, setRemotes] = useState<RemoteProfile[]>([]);
  const [adding, setAdding] = useState(false);
  const [addTarget, setAddTarget] = useState<LangCode>('it');
  const [addLvl, setAddLvl] = useState<CEFRBand>('A1');
  const [addA0, setAddA0] = useState(false);
  const profiles = listProfiles();
  const active = activeProfile();
  const session = supaSession();
  const langOf = (id: string) => (profileLang(id) ?? 'fr') as LangCode;

  /** One person, several languages: a new profile sharing name and native language,
   *  with its own memory, level and deck. */
  const addLanguage = () => {
    const m = blankMem();
    m.profile.name = mem.profile.name;
    m.profile.native = mem.profile.native;
    m.profile.target = addTarget;
    const idx = addA0 ? 0 : Math.max(0, BANDS.indexOf(addLvl) * 2);
    m.cefr.overall = idx;
    (Object.keys(m.cefr.skills) as (keyof typeof m.cefr.skills)[]).forEach(k => (m.cefr.skills[k] = idx));
    if (addA0) seedA0(m, addTarget, m.profile.native ?? 'de');
    createProfile(m.profile.name || S.profiles.profileWord, m);
    if (syncAvailable()) {
      const c = deepClone(m);
      void enableSync(c).then(tok => {
        if (tok) { saveMem(c); onSwitch(c); }
        else toast(S.profiles.syncFailed, true); // never fail a trust-critical toggle silently
      });
    }
    setAdding(false);
    onSwitch(m);
  };

  useEffect(() => {
    if (session) void listRemoteProfiles().then(setRemotes);
  }, []);

  const loadRemote = async (r: RemoteProfile) => {
    setBusy(true);
    const raw = await pullProfile(r.profile_key);
    setBusy(false);
    const m = raw ? migrate(raw) : null;
    if (!m) { toast(S.profiles.loadFailed, true); return; }
    m.sync = { token: r.profile_key, enabled: true };
    createProfile(m.profile.name || r.name || S.profiles.profileWord, m);
    onSwitch(m);
    toast(S.profiles.loaded(m.profile.name || r.name || ''));
  };

  const doSwitch = (id: string) => {
    if (id === active?.id) return;
    const m = switchProfile(id);
    if (m) { onSwitch(m); toast(uiFor(m).profiles.switched); } // toast in the language being switched TO
    else toast(S.profiles.noMemory, true);
  };

  const doEnableSync = async () => {
    setBusy(true);
    const m = deepClone(mem);
    const token = await enableSync(m);
    setBusy(false);
    if (token) { setMem(m); toast(S.profiles.syncActive); }
    else toast(syncAvailable() ? S.profiles.syncFailed : S.profiles.syncUnavailable, true);
  };

  const doJoin = async () => {
    const t = syncCode.trim();
    if (!t) return;
    setBusy(true);
    try {
      const remote = await pull(t);
      if (!remote) { toast(S.profiles.noProfileCode, true); setBusy(false); return; }
      remote.sync = { token: t, enabled: true };
      createProfile(remote.profile.name || S.profiles.profileWord, remote);
      onSwitch(remote);
      toast(S.profiles.loaded(remote.profile.name));
    } catch {
      toast(S.profiles.loadFailed, true);
    }
    setBusy(false);
  };

  return (
    <div class="fadein" style="max-width:560px">
      <div class="spread" style="margin-bottom:14px">
        <h2 style="font-size:28px;line-height:1.1">{S.profiles.title}</h2>
        <button class="btn subtle" onClick={() => go('today')}>{S.common.back}</button>
      </div>
      <p class="muted" style="margin:0 0 14px;font-size:14px;line-height:1.5">
        {S.profiles.intro}
      </p>

      <div class="card" style="margin-bottom:14px">
        <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:8px">{S.profiles.languages}</div>
        <div class="langchips">
          {profiles.map(p => {
            const lg = langOf(p.id);
            return (
              <button key={p.id} class={'pill ' + (p.id === active?.id ? 'on' : '')} onClick={() => doSwitch(p.id)}>
                {LANGS[lg]?.flag} {LANGS[lg]?.name}{profiles.filter(x => langOf(x.id) === lg).length > 1 ? ' · ' + p.name : ''}
              </button>
            );
          })}
          <button class="pill" onClick={() => setAdding(!adding)}>＋ {S.profiles.addLanguage}</button>
        </div>
        {adding && (
          <div class="addlang" style="margin-top:12px">
            <div class="tiny" style="margin-bottom:6px">{S.onboarding.youLearn}</div>
            <div class="pills" style="flex-wrap:wrap">
              {(Object.keys(LANGS) as LangCode[]).map(k => (
                <button key={k} class={'pill ' + (addTarget === k ? 'on' : '')} onClick={() => setAddTarget(k)}>{LANGS[k].flag} {LANGS[k].name}</button>
              ))}
            </div>
            <div class="tiny" style="margin:10px 0 6px">{S.onboarding.yourLevel}</div>
            <div class="pills">
              <button class={'pill ' + (addA0 ? 'on' : '')} onClick={() => { setAddA0(true); setAddLvl('A1'); }}>{S.onboarding.a0Label}</button>
              {BANDS.map(b => <button key={b} class={'pill ' + (!addA0 && addLvl === b ? 'on' : '')} onClick={() => { setAddA0(false); setAddLvl(b); }}>{b}</button>)}
            </div>
            <button class="btn primary" style="margin-top:12px" onClick={addLanguage}>{S.onboarding.go}</button>
          </div>
        )}
      </div>

      {profiles.map(p => (
        <button key={p.id} class={'profilerow ' + (p.id === active?.id ? 'on' : '')} style="margin-bottom:9px" onClick={() => doSwitch(p.id)}>
          <span class="avatar-badge">{(p.name || '?')[0]}</span>
          <div style="min-width:0;flex:1">
            <div style="font-weight:650">{p.name} <span style="font-weight:400">{LANGS[langOf(p.id)]?.flag}</span> {p.id === active?.id ? <span class="tiny">· {S.profiles.active}</span> : null}</div>
            <div class="tiny">{S.profiles.since} {fmtDate(p.createdAt)}</div>
          </div>
          {p.id === active?.id && (
            <span class="row" style="gap:6px">
              <span class="btn subtle" style="padding:6px 10px;font-size:11.5px" onClick={(e: Event) => {
                e.stopPropagation();
                const n = prompt(S.profiles.renamePrompt, p.name);
                if (n) {
                  renameProfile(p.id, n);
                  const m = deepClone(mem); m.profile.name = n; saveMem(m); setMem(m);
                }
              }}>{S.profiles.rename}</span>
              {profiles.length > 1 && (
                <span class="btn subtle" style="padding:6px 10px;font-size:11.5px;color:var(--red)" onClick={(e: Event) => {
                  e.stopPropagation();
                  if (confirm(S.profiles.deleteConfirm(p.name))) {
                    const pm = loadMemFor(p.id);
                    if (pm?.sync?.token && pm.sync.enabled) {
                      void deleteRemote(pm.sync.token).then(ok => { if (!ok) toast(S.memory.serverWipeFailed, true); });
                    }
                    deleteProfile(p.id);
                    const next = switchProfile(listProfiles()[0].id);
                    if (next) onSwitch(next);
                  }
                }}>{S.common.del}</span>
              )}
            </span>
          )}
        </button>
      ))}

      <button class="btn ghost big" style="margin-top:4px" onClick={onNewProfile}>{S.profiles.newProfile}</button>

      <div class="section-t">{S.profiles.backupTitle}</div>
      {session && (
        <div class="card" style="margin-bottom:12px">
          <div style="font-size:14px;line-height:1.5">
            {S.profiles.accountSaved(supaEmail())}
          </div>
          {remotes.filter(r => !profiles.length || r.profile_key !== mem.sync?.token).length > 0 && (
            <div style="margin-top:10px">
              <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:6px;font-size:14px">{S.profiles.onAccount}</div>
              {remotes.map(r => (
                <button key={r.profile_key} class="sess" disabled={busy || r.profile_key === mem.sync?.token}
                  onClick={() => void loadRemote(r)}>
                  <div>
                    <div class="t">{r.name || S.profiles.profileWord}{r.profile_key === mem.sync?.token ? ' ' + S.profiles.thisOne : ''}</div>
                    <div class="tiny">{S.profiles.lastActivity} {fmtDate(r.updated_at.slice(0, 10))}</div>
                  </div>
                  <span style="width:18px;color:var(--ink3);display:inline-flex">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!session && <div class="card">
        {mem.sync?.enabled ? (
          <div>
            <div style="font-size:14px;line-height:1.5">{S.profiles.syncOn}</div>
            <div class="row" style="margin-top:10px">
              <code class="mono" style="background:var(--bg0);border:1px solid var(--line);border-radius:9px;padding:9px 13px;font-size:14px">{mem.sync.token}</code>
              <button class="btn ghost" style="padding:8px 13px" onClick={() => { navigator.clipboard?.writeText(mem.sync!.token); toast(S.common.copied); }}>{S.common.copy}</button>
            </div>
            <button class="btn subtle" style="margin-top:12px;padding:7px 12px;font-size:12.5px" onClick={() => { const m = deepClone(mem); disableSync(m); setMem(m); }}>{S.profiles.syncOff}</button>
          </div>
        ) : (
          <div>
            <div style="font-size:14px;line-height:1.5">{S.profiles.syncDisabled}</div>
            <button class="btn ghost" style="margin-top:10px" disabled={busy || !syncAvailable()} onClick={doEnableSync}>
              {syncAvailable() ? S.profiles.syncEnable : S.profiles.syncNeedsServer}
            </button>
            <div class="hr"></div>
            <div style="font-size:14px;margin-bottom:8px">{S.profiles.loadFrom}</div>
            <div class="row">
              <input placeholder="cz-…" value={syncCode} onInput={e => setSyncCode((e.target as HTMLInputElement).value)} />
              <button class="btn ghost" style="flex-shrink:0" disabled={busy} onClick={doJoin}>{S.common.load}</button>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}
