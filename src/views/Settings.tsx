import { useEffect, useRef, useState } from 'preact/hooks';
import type { LangCode, Memory } from '../types';
import { api, OAI, type ApiInfo } from '../lib/api';
import { isAdmin } from '../lib/events';
import { inIntroPhase } from '../lib/gamify';
import { AN_MODELS, LANGS, RT_DEFAULT, RT_MINI, RT_MODELS, TR_MODELS, TURN_DEFAULT, TURN_MODELS, VOICES } from '../lib/langs';
import { saveMem } from '../lib/storage';
import {
  saveOwnKey, signInGoogle, signOut,
  supaEmail, supaSession
} from '../lib/supa';
import { switchTutor, TUTORS, tutorOf } from '../lib/tutors';
import { compById } from '../lib/competencies';
import {
  drillCount, GRAMMAR_SHARE, grammarOf, grammarQueue, grammarState, learningTopics
} from '../lib/grammar';
import { TutorFace } from '../components/Avatar';
import { deepClone, todayISO } from '../lib/utils';
import { BUILD, buildTime, deployedBuild, isStaleBuild, versionLabel } from '../lib/version';
import { dailyReviewCapacity, newPerSession, sessionsPerDay, sustainableNewPerDay } from '../lib/budget';
import { ui, uiLocale } from '../lang';
import type { CompanionModule } from '../lib/companionSeam';

/** Listening patience, most patient first. The value is OpenAI's `eagerness`, which runs the
 *  other way round: 'low' eagerness means the model waits, which is what "patience: high"
 *  should do. Pairing them the obvious way is what made the control do the opposite of its
 *  label. Kept next to the pills so the inversion is impossible to miss. */
export const PATIENCE = [['low', 'patienceHigh'], ['auto', 'patienceMid'], ['high', 'patienceLow']] as const;

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  apiInfo: ApiInfo;
  refreshApi: () => void;
  go: (view: string) => void;
  toast: (msg: string, err?: boolean) => void;
  /** Optional extension module, when this build carries one. */
  ext?: CompanionModule | null;
}

export function Settings({ mem, setMem, apiInfo, refreshApi, go, toast, ext }: Props) {
  const S = ui();
  const upd = (fn: (m: Memory) => void) => {
    const m = deepClone(mem);
    fn(m);
    saveMem(m);
    setMem(m);
  };
  const [key, setKey] = useState(api.getKey());
  const [code, setCode] = useState(api.getCode());
  const gref = useRef<HTMLDivElement>(null);
  // undefined while the answer is outstanding: "unknown" must not read as "up to date".
  const [deployed, setDeployed] = useState<string | null | undefined>(undefined);
  useEffect(() => { void deployedBuild().then(setDeployed); }, []);
  const stale = deployed !== undefined && isStaleBuild(BUILD, deployed ?? null);
  const built = buildTime(BUILD, uiLocale());
  const deployedTime = deployed ? buildTime(deployed, uiLocale()) : null;
  const supa = apiInfo.auth === 'supabase';
  const session = supaSession();
  const [acctKey, setAcctKey] = useState('');
  useEffect(() => {
    if (apiInfo.mode === 'server' && apiInfo.auth === 'google' && apiInfo.keySource === 'server' && gref.current) {
      api.googleSignIn(gref.current, () => toast(S.settings.connected + '.'));
    }
  }, [apiInfo, session]);
  const s = mem.settings;
  // Exact match: the Models card can still hold an older model id, and neither pill should
  // claim to represent it (or silently overwrite it on a tap meant to be a no-op).
  const stdCall = s.rtModel === RT_DEFAULT;
  const miniCall = s.rtModel === RT_MINI;
  const turns = s.callEngine === 'turns';

  return (
    <div class="fadein" style="max-width:640px">
      <div class="spread" style="margin-bottom:16px">
        <h2 style="font-size:28px;line-height:1.1">{S.settings.title}</h2>
        <button class="btn subtle" onClick={() => go('help')}>{S.settings.helpRow}</button>
      </div>

      {supa && (
        <div class="card">
          <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.settings.account}</div>
          {session ? (
            <div>
              <div class="kv"><span class="k">{S.settings.connected}</span>
                <div class="row">
                  <span style="font-size:14px">{supaEmail()}</span>
                  <button class="btn subtle" style="padding:6px 11px;font-size:11.5px"
                    onClick={() => { void signOut().then(refreshApi); toast(S.settings.signedOut); }}>{S.settings.signOut}</button>
                </div>
              </div>
              <div class="kv"><span class="k">{S.settings.openaiKey}</span>
                <div class="pills">
                  <button class={'pill ' + (apiInfo.keySource === 'server' ? 'on' : '')}
                    onClick={() => { api.setKeySource('server'); refreshApi(); }}>{S.settings.viaAccount}</button>
                  <button class={'pill ' + (apiInfo.keySource === 'own' ? 'on' : '')}
                    onClick={() => { api.setKeySource('own'); refreshApi(); }}>{S.settings.ownKeyDirect}</button>
                </div>
              </div>
              {apiInfo.keySource === 'server' && (
                <div>
                  <div class="kv"><span class="k">{S.settings.accountKey}</span>
                    <div class="row" style="max-width:320px">
                      <input type="password" style="padding:7px 11px" placeholder={S.settings.keyIfAsked} value={acctKey}
                        onInput={e => setAcctKey((e.target as HTMLInputElement).value)} />
                      <button class="btn ghost" style="padding:8px 13px;flex-shrink:0" disabled={!acctKey.trim()}
                        onClick={async () => {
                          const ok = await saveOwnKey(acctKey);
                          toast(ok ? S.settings.keySaved : S.settings.keySaveFailed, !ok);
                          if (ok) setAcctKey('');
                        }}>{S.common.save}</button>
                    </div>
                  </div>
                  <div class="tiny" style="line-height:1.5;margin-top:2px">
                    {S.settings.allowlistNote}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div class="tiny" style="margin-bottom:8px">{S.settings.signInHint}</div>
              <button class="btn ghost" onClick={() => void signInGoogle()}>{S.settings.signInGoogle}</button>
            </div>
          )}
        </div>
      )}

      {!supa && <div class="card">
        <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.settings.access}</div>
        {apiInfo.mode === 'server' ? (
          <div>
            <div class="kv"><span class="k">{S.settings.openaiKey}</span>
              <div class="pills">
                <button class={'pill ' + (apiInfo.keySource === 'server' ? 'on' : '')}
                  onClick={() => { api.setKeySource('server'); refreshApi(); }}>{S.settings.serverCode}</button>
                <button class={'pill ' + (apiInfo.keySource === 'own' ? 'on' : '')}
                  onClick={() => { api.setKeySource('own'); refreshApi(); }}>{S.settings.myKey}</button>
              </div>
            </div>
            {apiInfo.keySource === 'server' && apiInfo.keyConfigured === false && (
              <div class="tiny" style="color:var(--red);margin:4px 0 8px">{S.settings.noServerKeySet}</div>
            )}
            {apiInfo.keySource === 'server' && apiInfo.auth === 'code' && (
              <div class="kv"><span class="k">{S.settings.accessCodeLabel}</span>
                <div class="row" style="max-width:280px">
                  <input type="password" style="padding:7px 11px" value={code} onInput={e => setCode((e.target as HTMLInputElement).value)} />
                  <button class="btn ghost" style="padding:8px 13px;flex-shrink:0" onClick={async () => {
                    api.setCode(code);
                    const r = await fetch('/api/rt-token', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json', ...api.authHeaders() },
                      body: JSON.stringify({ probe: true })
                    });
                    toast(r.status === 401 ? S.settings.codeWrong : S.settings.codeOk, r.status === 401);
                  }}>{S.settings.verify}</button>
                </div>
              </div>
            )}
            {apiInfo.keySource === 'server' && apiInfo.auth === 'google' && (
              <div class="kv"><span class="k">Google</span><div ref={gref}></div></div>
            )}
          </div>
        ) : (
          <div class="kv"><span class="k">{S.settings.modeDirect}</span><span>{S.settings.modeDirectValue}</span></div>
        )}
        {(apiInfo.keySource === 'own' || apiInfo.mode === 'local') && (
          <div class="kv"><span class="k">{S.settings.openaiKey}</span>
            <div class="row" style="max-width:300px">
              <input type="password" style="padding:7px 11px" placeholder="sk-…" value={key} onInput={e => setKey((e.target as HTMLInputElement).value)} />
              <button class="btn ghost" style="padding:8px 13px;flex-shrink:0" onClick={async () => {
                api.setKey(key);
                try {
                  const r = await fetch(OAI() + '/v1/models?limit=1', { headers: { Authorization: 'Bearer ' + key.trim() } });
                  toast(r.ok ? S.settings.keyWorks : S.settings.keyRefused(r.status), !r.ok);
                } catch {
                  toast(S.settings.netError, true);
                }
              }}>{S.settings.testKey}</button>
            </div>
          </div>
        )}
      </div>}

      {supa && apiInfo.keySource === 'own' && (
        <div class="card">
          <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.settings.ownKeyTitle}</div>
          <div class="kv"><span class="k">{S.settings.openaiKey}</span>
            <div class="row" style="max-width:300px">
              <input type="password" style="padding:7px 11px" placeholder="sk-…" value={key} onInput={e => setKey((e.target as HTMLInputElement).value)} />
              <button class="btn ghost" style="padding:8px 13px;flex-shrink:0" onClick={async () => {
                api.setKey(key);
                try {
                  const r = await fetch(OAI() + '/v1/models?limit=1', { headers: { Authorization: 'Bearer ' + key.trim() } });
                  toast(r.ok ? S.settings.keyWorks : S.settings.keyRefused(r.status), !r.ok);
                } catch { toast(S.settings.netError, true); }
              }}>{S.settings.testKey}</button>
            </div>
          </div>
          <div class="tiny" style="line-height:1.5">{S.settings.ownKeyNote}</div>
        </div>
      )}

      <div class="card">
        <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.settings.rhythm}</div>
        <div class="kv"><span class="k">{S.settings.callLength}</span>
          <div class="pills">{[5, 8, 10].map(n => (
            <button key={n} class={'pill ' + (s.minutesHint === n ? 'on' : '')} onClick={() => upd(m => (m.settings.minutesHint = n))}>{n} min</button>
          ))}</div>
        </div>
        <div class="kv"><span class="k">{S.settings.cardsPerEvening}</span>
          <div class="pills">{[10, 15, 18, 24].map(n => (
            <button key={n} class={'pill ' + (s.sessionSize === n ? 'on' : '')} onClick={() => upd(m => (m.settings.sessionSize = n))}>{n}</button>
          ))}</div>
        </div>
        <div class="kv"><span class="k">{S.settings.sessionsPerDay}</span>
          <div class="pills">{[1, 2].map(n => (
            <button key={n} class={'pill ' + (sessionsPerDay(s) === n ? 'on' : '')} onClick={() => upd(m => (m.settings.sessionsPerDay = n))}>{n}</button>
          ))}</div>
        </div>
        {/* The intake follows the capacity above unless it is pinned by hand: the two are
            one number, and letting them drift apart is what filled the deck faster than the
            evenings could empty it. */}
        <div class="kv"><span class="k">{S.settings.newOf}</span>
          <div class="pills">
            <button class={'pill ' + (s.newAuto !== false ? 'on' : '')} onClick={() => upd(m => (m.settings.newAuto = true))}>
              {S.settings.auto} · {newPerSession({ ...s, newAuto: true })}
            </button>
            {[2, 4, 8].map(n => (
              <button key={n} class={'pill ' + (s.newAuto === false && s.newPerSession === n ? 'on' : '')}
                onClick={() => upd(m => { m.settings.newAuto = false; m.settings.newPerSession = n; })}>{n}</button>
            ))}
          </div>
        </div>
        <div class="tiny" style="margin:2px 0 6px">{S.settings.rhythmNote(sustainableNewPerDay(s), dailyReviewCapacity(s))}</div>
        <div class="kv"><span class="k">{S.settings.speakAnswers}</span>
          <div class="pills">
            <button class={'pill ' + (s.speakAnswers ? 'on' : '')} onClick={() => upd(m => (m.settings.speakAnswers = true))}>{S.settings.yes}</button>
            <button class={'pill ' + (!s.speakAnswers ? 'on' : '')} onClick={() => upd(m => (m.settings.speakAnswers = false))}>{S.settings.no}</button>
          </div>
        </div>
        <div class="tiny" style="margin:2px 0 6px">{S.settings.speakAnswersNote}</div>
        <div class="kv"><span class="k">{S.settings.retellOpt}</span>
          <div class="pills">
            <button class={'pill ' + (s.retell !== false ? 'on' : '')} onClick={() => upd(m => (m.settings.retell = true))}>{S.settings.yes}</button>
            <button class={'pill ' + (s.retell === false ? 'on' : '')} onClick={() => upd(m => (m.settings.retell = false))}>{S.settings.no}</button>
          </div>
        </div>
        <div class="kv"><span class="k">{S.settings.cardAudio}</span>
          <div class="pills">
            <button class={'pill ' + (s.cardAudio ? 'on' : '')} onClick={() => upd(m => (m.settings.cardAudio = true))}>{S.settings.yes}</button>
            <button class={'pill ' + (!s.cardAudio ? 'on' : '')} onClick={() => upd(m => (m.settings.cardAudio = false))}>{S.settings.no}</button>
          </div>
        </div>
        {inIntroPhase(mem) && (
          <div class="kv"><span class="k">{S.settings.introPhase}</span>
            <button class="btn subtle" style="padding:7px 12px;font-size:12.5px" onClick={() => upd(m => (m.introDone = true))}>{S.settings.skipPhase}</button>
          </div>
        )}
      </div>

      {mem.profile.target === 'fr' && <GrammarSettings mem={mem} upd={upd} />}

      <div class="card">
        <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.settings.profileTitle}</div>
        <div class="kv"><span class="k">{S.settings.firstName}</span>
          <input style="max-width:200px;padding:7px 11px" value={mem.profile.name}
            onChange={e => upd(m => (m.profile.name = (e.target as HTMLInputElement).value))} />
        </div>
        <div class="kv"><span class="k">{S.settings.targetLang}</span>
          <div class="row">
            <span style="font-size:14.5px">{LANGS[mem.profile.target]?.flag} {LANGS[mem.profile.target]?.name}</span>
            <button class="btn subtle" style="padding:6px 11px;font-size:11.5px" onClick={() => go('profiles')}>{S.settings.manage}</button>
          </div>
        </div>
        <div class="kv"><span class="k">{S.settings.motherTongue}</span>
          <select style="max-width:200px;padding:7px 11px" value={mem.profile.native ?? 'de'}
            onChange={e => upd(m => (m.profile.native = (e.target as HTMLSelectElement).value as Memory['profile']['native']))}>
            {(['de', 'en'] as const).map(k => <option key={k} value={k}>{S.settings.natives[k]}</option>)}
          </select>
        </div>
        <div class="kv"><span class="k">{S.settings.tutorPick}</span>
          <div class="pills">
            {Object.values(TUTORS).map(t => (
              <button key={t.key} class={'pill ' + (tutorOf(mem).key === t.key ? 'on' : '')}
                style="display:flex;align-items:center;gap:6px;padding:3px 10px 3px 4px"
                onClick={() => void (async () => {
                  if (tutorOf(mem).key === t.key) return;
                  if (!confirm(S.settings.tutorSwitchWarn(t.name))) return;
                  // The extension, when there is one, gets a say: it may have a thread of
                  // its own tied to the old tutor and asks before letting it go.
                  if (ext?.onTutorSwitch && !(await ext.onTutorSwitch(t.key))) return;
                  upd(m => switchTutor(m, t.key));
                })()}>
                <span style="width:22px;height:22px;border-radius:50%;overflow:hidden;background:var(--cream);display:flex;align-items:flex-end;flex-shrink:0">
                  <span style="width:100%;height:100%;margin-bottom:-2px;display:block"><TutorFace tutor={t.key} /></span>
                </span>
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div class="kv"><span class="k">{S.settings.odileStyle}</span>
          <div class="pills">
            <button class={'pill ' + (mem.profile.persona !== 'warm' ? 'on' : '')} onClick={() => upd(m => (m.profile.persona = 'deadpan'))}>{S.settings.deadpan}</button>
            <button class={'pill ' + (mem.profile.persona === 'warm' ? 'on' : '')} onClick={() => upd(m => (m.profile.persona = 'warm'))}>{S.settings.warm}</button>
          </div>
        </div>
        <div class="kv"><span class="k">{S.settings.uiLang}</span>
          <div class="pills">
            {([['auto', S.settings.uiAuto], ['target', S.settings.uiTargetOpt], ['support', S.settings.uiSupportOpt]] as const).map(([v, label]) => (
              <button key={v} class={'pill ' + ((s.uiLang ?? 'auto') === v ? 'on' : '')} aria-pressed={(s.uiLang ?? 'auto') === v}
                onClick={() => upd(m => (m.settings.uiLang = v))}>{label}</button>
            ))}
          </div>
        </div>
        <div class="tiny" style="margin:2px 0 6px">{S.settings.uiLangNote}</div>
        <div class="kv"><span class="k">{S.settings.profilesSync}</span>
          <button class="btn subtle" style="padding:7px 12px;font-size:12.5px" onClick={() => go('profiles')}>{S.settings.manage}</button>
        </div>
      </div>

      <div class="card">
        <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.settings.voiceCall}</div>
        <div class="kv"><span class="k">{S.settings.voice}</span>
          <select style="max-width:200px;padding:7px 11px" value={s.voice}
            onChange={e => upd(m => (m.settings.voice = (e.target as HTMLSelectElement).value))}>
            {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div class="kv"><span class="k">{S.settings.speed}</span>
          <div class="row" style="max-width:220px">
            <input type="range" min="0.6" max="1.2" step="0.05" value={s.speed} style="padding:0"
              onChange={e => upd(m => (m.settings.speed = Number((e.target as HTMLInputElement).value)))} />
            <span class="tiny" style="width:34px;text-align:right">{Number(s.speed).toFixed(2)}</span>
          </div>
        </div>
        <div class="kv"><span class="k">{S.settings.patience}</span>
          <div class="pills">
            {/* Label -> API value is INVERTED on purpose: OpenAI's `eagerness` measures how
                keen the model is to cut in, so "patience: high" is eagerness "low". The pills
                used to pair "groß" with 'high', which set the SHORTEST wait under the most
                patient-sounding label. */}
            {(PATIENCE.map(([v, key]) => (
              <button key={v} class={'pill ' + (s.eagerness === v ? 'on' : '')} onClick={() => upd(m => (m.settings.eagerness = v))}>{S.settings[key]}</button>
            )))}
          </div>
        </div>
        <div class="kv"><span class="k">{S.settings.callModel}</span>
          <div class="pills">
            <button class={'pill ' + (stdCall ? 'on' : '')} onClick={() => upd(m => (m.settings.rtModel = RT_DEFAULT))}>{S.settings.callModelStd}</button>
            <button class={'pill ' + (miniCall ? 'on' : '')} onClick={() => upd(m => (m.settings.rtModel = RT_MINI))}>{S.settings.callModelMini}</button>
          </div>
        </div>
        <div class="tiny" style="margin:2px 0 8px;line-height:1.5">{S.settings.callModelNote}</div>
        {/* The engine is the bigger lever than the model above it: it decides whether the
            call is speech-to-speech or a cascade, and with it what a call costs. Kept
            beneath the model pills because realtime is still the normal way to call. */}
        <div class="kv"><span class="k">{S.settings.engine}</span>
          <div class="pills">
            <button class={'pill ' + (!turns ? 'on' : '')} onClick={() => upd(m => (m.settings.callEngine = 'realtime'))}>{S.settings.engineRealtime}</button>
            <button class={'pill ' + (turns ? 'on' : '')} onClick={() => upd(m => (m.settings.callEngine = 'turns'))}>{S.settings.engineTurns}</button>
          </div>
        </div>
        <div class="tiny" style="margin:2px 0 8px;line-height:1.5">{S.settings.engineNote}</div>
        {turns && (
          <>
            <div class="kv"><span class="k">{S.settings.turnCommit}</span>
              <div class="pills">
                <button class={'pill ' + ((s.turnCommit ?? 'auto') === 'auto' ? 'on' : '')} onClick={() => upd(m => (m.settings.turnCommit = 'auto'))}>{S.settings.turnCommitAuto}</button>
                <button class={'pill ' + (s.turnCommit === 'button' ? 'on' : '')} onClick={() => upd(m => (m.settings.turnCommit = 'button'))}>{S.settings.turnCommitButton}</button>
              </div>
            </div>
            <div class="tiny" style="margin:2px 0 8px;line-height:1.5">{S.settings.turnCommitNote}</div>
          </>
        )}
        <div class="kv"><span class="k">{S.settings.captions}</span>
          <div class="pills">
            <button class={'pill ' + (s.captions ? 'on' : '')} onClick={() => upd(m => (m.settings.captions = true))}>{S.settings.yes}</button>
            <button class={'pill ' + (!s.captions ? 'on' : '')} onClick={() => upd(m => (m.settings.captions = false))}>{S.settings.no}</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.settings.audioEnv}</div>
        {/* Two settings used to live here: noise reduction, and a "noisy environment" switch
            that chose the acoustic detector over the semantic one. Between them they were
            the cure for a phone on speaker hearing itself — and asking a learner to know
            that, before their first conversation, in a menu, is not a cure. The call now
            notices its own echo and changes both by itself (lib/echo, hardenedInput). */}
        <div class="tiny" style="margin:2px 0 8px;line-height:1.5">{S.settings.audioAutoNote}</div>
        <div class="kv"><span class="k">{S.settings.verbatim}</span>
          <div class="pills">
            <button class={'pill ' + (s.verbatim !== false ? 'on' : '')} onClick={() => upd(m => (m.settings.verbatim = true))}>{S.settings.yes}</button>
            <button class={'pill ' + (s.verbatim === false ? 'on' : '')} onClick={() => upd(m => (m.settings.verbatim = false))}>{S.settings.no}</button>
          </div>
        </div>
        <div class="tiny" style="margin-top:2px;line-height:1.5">{S.settings.verbatimNote}</div>
      </div>

      <div class="card">
        <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.settings.models}</div>
        <div class="kv"><span class="k">{S.settings.modelCall}</span>
          <select style="max-width:230px;padding:7px 11px" value={s.rtModel}
            onChange={e => upd(m => (m.settings.rtModel = (e.target as HTMLSelectElement).value))}>
            {RT_MODELS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div class="kv"><span class="k">{S.settings.modelTurn}</span>
          <select style="max-width:230px;padding:7px 11px" value={s.turnModel ?? TURN_DEFAULT}
            onChange={e => upd(m => (m.settings.turnModel = (e.target as HTMLSelectElement).value))}>
            {TURN_MODELS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div class="kv"><span class="k">{S.settings.modelAnalysis}</span>
          <select style="max-width:230px;padding:7px 11px" value={s.analysisModel}
            onChange={e => upd(m => (m.settings.analysisModel = (e.target as HTMLSelectElement).value))}>
            {AN_MODELS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div class="kv"><span class="k">{S.settings.modelTranscribe}</span>
          <select style="max-width:230px;padding:7px 11px" value={s.transcribeModel ?? 'gpt-transcribe'}
            onChange={e => upd(m => (m.settings.transcribeModel = (e.target as HTMLSelectElement).value))}>
            {TR_MODELS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {ext && <ext.SettingsCard />}

      {/* The entrance is hidden from everyone else; the DATABASE decides whether the rows
          come back (docs/SCHEMA.sql). Hiding a button is not access control. */}
      {isAdmin(supaEmail()) && (
        <div class="card">
          <div class="kv"><span class="k">{S.admin.open}</span>
            <button class="btn subtle" style="padding:7px 12px" onClick={() => go('admin')}>{S.settings.manage}</button>
          </div>
        </div>
      )}

      <div class="card">
        <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.settings.version}</div>
        <div class="kv"><span class="k">{S.settings.versionRunning}</span>
          <span style="font-variant-numeric:tabular-nums">{versionLabel()}</span>
        </div>
        {built && (
          <div class="kv"><span class="k">{S.settings.versionBuilt}</span>
            <span style="font-variant-numeric:tabular-nums">{S.settings.versionBerlin(built)}</span>
          </div>
        )}
        {/* The whole point of this panel is answering "is what I am looking at the current
            build?", so a stale install shows BOTH numbers. Labelling the running build's
            own timestamp "deployed" would answer the question wrongly, and only for the one
            person who needs it. */}
        {stale
          ? <>
              <div class="kv"><span class="k" style="color:var(--tomato)">{S.settings.versionDeployed}</span>
                <span style="font-variant-numeric:tabular-nums">{versionLabel(deployed ?? '')}
                  {deployedTime ? ' · ' + deployedTime : ''}</span>
              </div>
              <div class="kv"><span class="k">{S.settings.versionStale}</span>
                <button class="btn ghost" style="padding:6px 12px" onClick={() => location.reload()}>{S.app.updateReload}</button>
              </div>
            </>
          : <div class="tiny" style="margin-top:6px">
              {deployed === undefined ? S.settings.versionChecking : S.settings.versionCurrent}
            </div>}
        <div class="tiny" style="margin-top:6px;line-height:1.5">{S.settings.versionNote}</div>
      </div>

      <div class="tiny" style="margin:14px 2px;line-height:1.6">
        {S.settings.footer}
      </div>
    </div>
  );
}

/** The grammar strand's controls: what the app is going to teach next, in what order, and
 *  how much of a review sitting the exercises are allowed to take.
 *
 *  The order is the point. The app's own priority — worst gap at or below the learner's band
 *  first — is a good default and a bad rule: a student with an exam in three weeks knows
 *  better than the matrix does which five concepts matter. Anything moved up stays up, in
 *  the order it was put in; everything else keeps falling back to the automatic ranking.
 *
 *  Reordering is arrows rather than dragging. A drag-and-drop list is the wrong bet on a
 *  phone in a warm hand, and there is no such primitive anywhere else in this app to borrow. */
function GrammarSettings({ mem, upd }: { mem: Memory; upd: (fn: (m: Memory) => void) => void }) {
  const S = ui();
  const g = grammarOf(mem);
  const byId = compById(mem.profile.target);
  // Eight is as far as a settings list is worth reading; the ranking behind it is still the
  // whole map, which is what the arrows are disabled against.
  const queueAll = grammarQueue(mem);
  const queue = queueAll.slice(0, 8);
  const learning = learningTopics(mem);
  const mastered = Object.entries(g.topics)
    .filter(([, t]) => t.masteredAt || t.manual)
    .sort((a, b) => String(b[1].masteredAt ?? '').localeCompare(String(a[1].masteredAt ?? '')));
  const cards = Math.max(1, mem.settings.sessionSize);
  const share = mem.settings.grammarShare ?? GRAMMAR_SHARE;

  /** Moves a concept one place within the queue.
   *
   *  The stored order is the queue AS SHOWN, cut off after the moved concept: everything
   *  above it is now pinned, everything below goes on being ranked automatically. Storing
   *  the whole list instead would freeze the tail too, and a gap that opens up next week
   *  would never be able to climb past a concept the student merely scrolled past today. */
  const move = (id: string, by: number) => upd(m => {
    const ranked = grammarQueue(m).map(c => c.id);
    const i = ranked.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ranked.length) return;
    [ranked[i], ranked[j]] = [ranked[j], ranked[i]];
    grammarState(m).order = ranked.slice(0, Math.max(i, j) + 1);
  });

  const setStatus = (id: string, what: 'done' | 'reopen' | 'skip' | 'unskip') => upd(m => {
    const st = grammarState(m);
    if (what === 'done') {
      // An empty `courseAt` is what says "nobody ever taught this, the student simply says
      // they know it". `manual` cannot carry that meaning, because it is also stamped on a
      // concept that WAS taught and drilled and is being retired early — and reopening one
      // of those must give the student their history back, not throw it away.
      st.topics[id] = { ...(st.topics[id] ?? { courseAt: '', days: [] }), masteredAt: todayISO(), manual: 1 };
      st.order = st.order.filter(x => x !== id);
    } else if (what === 'reopen') {
      const t = st.topics[id];
      if (t && !t.courseAt) delete st.topics[id];        // never taught: back onto the queue
      else if (t) {
        // Taught before, and the student is saying it did not stick after all. Everything
        // from the last teaching stops being evidence, exactly as a redo does — otherwise
        // the next sitting re-masters it on the very tallies just contradicted.
        delete t.masteredAt;
        delete t.manual;
        t.redoneAt = todayISO();
      }
      st.skipped = st.skipped.filter(x => x !== id);
    } else if (what === 'skip') {
      st.skipped = [...st.skipped.filter(x => x !== id), id];
      st.order = st.order.filter(x => x !== id);
    } else {
      st.skipped = st.skipped.filter(x => x !== id);
    }
  });

  return (
    <div class="card">
      <div style="font-family:var(--disp);font-weight:800;font-size:17px;margin-bottom:4px">{S.gram.title}</div>

      <div class="kv"><span class="k">{S.gram.share}</span>
        <div class="pills">
          <button class={'pill ' + (share === 0 ? 'on' : '')} onClick={() => upd(m => (m.settings.grammarShare = 0))}>{S.gram.shareOff}</button>
          {[15, 25, 40].map(n => (
            <button key={n} class={'pill ' + (share === n ? 'on' : '')}
              onClick={() => upd(m => (m.settings.grammarShare = n))}>{n} %</button>
          ))}
        </div>
      </div>
      <div class="tiny" style="margin:2px 0 10px">{S.gram.shareNote(drillCount({ grammarShare: share }, cards), cards)}</div>

      {/* What is being worked on and what is queued behind it, in the order they will come. */}
      <div class="kicker" style="margin-top:4px">{S.gram.queue}</div>
      {queue.length === 0 && learning.length === 0
        ? <div class="tiny" style="margin-top:6px">{S.gram.queueEmpty}</div>
        : (
          <div class="gset">
            {/* Being taught right now: it holds its place until it is mastered, so it has
                no arrows — there is nowhere for it to move to. */}
            {learning.map(id => {
              const item = byId[id];
              if (!item) return null;
              return (
                <div key={id} class="gsetrow on">
                  <span class="lvl">{item.band}</span>
                  <span class="gsetlab" lang={mem.profile.target}>{item.label}</span>
                  <div class="gsetacts">
                    <button class="btn subtle" onClick={() => setStatus(id, 'done')}>{S.gram.markDone}</button>
                  </div>
                </div>
              );
            })}
            {/* Queued behind it, in the order they will come. Indices here are the QUEUE's
                own, not the list's, so the arrows are disabled exactly when they would do
                nothing rather than one row out. */}
            {queue.map((item, i) => (
              <div key={item.id} class="gsetrow">
                <span class="lvl">{item.band}</span>
                <span class="gsetlab" lang={mem.profile.target}>{item.label}</span>
                <div class="gsetacts">
                  <button class="btn subtle" title={S.gram.up} aria-label={S.gram.up}
                    disabled={i === 0} onClick={() => move(item.id, -1)}>↑</button>
                  <button class="btn subtle" title={S.gram.down} aria-label={S.gram.down}
                    disabled={i === queueAll.length - 1} onClick={() => move(item.id, 1)}>↓</button>
                  <button class="btn subtle" onClick={() => setStatus(item.id, 'done')}>{S.gram.markDone}</button>
                  <button class="btn subtle" onClick={() => setStatus(item.id, 'skip')}>{S.gram.skip}</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {mastered.length > 0 && (
        <div>
          <div class="kicker" style="margin-top:14px">{S.gram.done}</div>
          <div class="gset">
            {mastered.map(([id, t]) => {
              const item = byId[id];
              if (!item) return null;
              return (
                <div key={id} class="gsetrow">
                  <span class="lvl">{item.band}</span>
                  <span class="gsetlab" lang={mem.profile.target}>
                    {item.label}{t.manual ? ' · ' + S.gram.manual : ''}
                  </span>
                  <div class="gsetacts">
                    <button class="btn subtle" onClick={() => setStatus(id, 'reopen')}>{S.gram.reopen}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {g.skipped.length > 0 && (
        <div>
          <div class="kicker" style="margin-top:14px">{S.gram.skipped}</div>
          <div class="gset">
            {g.skipped.map(id => {
              const item = byId[id];
              if (!item) return null;
              return (
                <div key={id} class="gsetrow">
                  <span class="lvl">{item.band}</span>
                  <span class="gsetlab" lang={mem.profile.target}>{item.label}</span>
                  <div class="gsetacts">
                    <button class="btn subtle" onClick={() => setStatus(id, 'unskip')}>{S.gram.unskip}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
