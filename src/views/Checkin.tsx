import { useEffect, useState } from 'preact/hooks';
import type { CheckinPeriod, Memory } from '../types';
import { applyCheckin, runCheckin, windowStats, type CheckinData } from '../lib/checkin';
import { ui } from '../lang';
import { saveMem } from '../lib/storage';
import { deepClone, fmtDate } from '../lib/utils';
import { Odile } from '../components/Avatar';
import { I } from '../components/icons';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  period: CheckinPeriod;
  /** `true` when the student answered and it was saved, `false` when they put it off —
   *  the app snoozes the review for the day rather than offering it again on the next open. */
  onDone: (completed: boolean) => void;
  toast: (msg: string, err?: boolean) => void;
}

/** Short, snappy period review: numbers, what moved, what to work on, two taps of
 *  direction for the next period. */
export function Checkin({ mem, setMem, period, onDone, toast }: Props) {
  const S = ui();
  const [data, setData] = useState<CheckinData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const stats = windowStats(mem, period);

  useEffect(() => {
    runCheckin(mem, period).then(setData).catch(e => setErr((e as Error).message));
  }, []);

  const save = () => {
    if (!data) return;
    const m = deepClone(mem);
    const answers = data.questions.map((q, i) => ({ question: q.q, answer: picked[i] || '' })).filter(a => a.answer);
    applyCheckin(m, period, data, answers);
    saveMem(m);
    setMem(m);
    toast(answers.length ? S.checkin.savedDirection : S.checkin.savedPlain);
    onDone(true);
  };

  const levelDelta = stats.levelStart && stats.levelStart !== stats.levelEnd
    ? `${stats.levelStart} → ${stats.levelEnd}`
    : stats.levelEnd;

  return (
    <div class="fadein" style="max-width:560px;margin:0 auto">
      <div class="spread" style="margin-bottom:6px">
        <h2 style="font-size:28px;line-height:1.1">{S.periods[period]}</h2>
        <button class="btn subtle" onClick={() => onDone(false)}>{S.checkin.laterBtn}</button>
      </div>
      <div class="tiny" style="margin-bottom:14px">{fmtDate(stats.start)} → {fmtDate(stats.end)}</div>

      <div class="stats" style="margin-bottom:12px">
        <div class="stat"><div class="v">{stats.calls}</div><div class="l">{S.checkin.calls}</div></div>
        <div class="stat"><div class="v">{stats.minutes}</div><div class="l">{S.checkin.minutes}</div></div>
        <div class="stat"><div class="v">{stats.cardsSues}</div><div class="l">{S.checkin.cardsKnown}</div></div>
        <div class="stat"><div class="v">{levelDelta}</div><div class="l">{S.checkin.level}</div></div>
      </div>

      {!data && !err && (
        <div class="card" style="text-align:center;padding:26px">
          <div style="width:70px;margin:0 auto 8px"><Odile state="thinking" /></div>
          <div class="spinner"></div>
          <div class="muted">{S.checkin.working}</div>
        </div>
      )}
      {err && (
        <div class="card">
          <div class="muted">{S.checkin.unavailable(err)}</div>
          <button class="btn ghost" style="margin-top:10px" onClick={() => { setErr(null); runCheckin(mem, period).then(setData).catch(e => setErr((e as Error).message)); }}>{S.common.retry}</button>
        </div>
      )}

      {data && (
        <div>
          <div class="card" style="background:var(--blue);border-color:var(--blue);color:var(--cream)">
            <div style="font-weight:700;font-size:16.5px;line-height:1.4">{data.titre}</div>
          </div>

          <div class="card" style="margin-top:10px">
            <div class="row" style="color:var(--teal);font-weight:700;font-size:12px;letter-spacing:.1em;margin-bottom:7px">
              <span style="width:15px;display:inline-flex"><I.check /></span>{S.checkin.moved}
            </div>
            {data.progres.map((p, i) => <div key={i} style="font-size:14.5px;line-height:1.55">{p}</div>)}
          </div>

          <div class="card" style="margin-top:10px">
            <div class="row" style="color:var(--amber);font-weight:700;font-size:12px;letter-spacing:.1em;margin-bottom:7px">
              <span style="width:15px;display:inline-flex"><I.spark /></span>{S.checkin.toWork}
            </div>
            {data.motifs.map((p, i) => <div key={i} style="font-size:14.5px;line-height:1.55">{p}</div>)}
            <div class="tiny" style="margin-top:8px">{S.checkin.proposal} {data.cap}</div>
          </div>

          {data.questions.map((q, i) => (
            <div key={i} class="card" style="margin-top:10px">
              <div style="font-weight:650;font-size:14.5px;margin-bottom:9px">{q.q}</div>
              <div class="pills" style="flex-wrap:wrap">
                {q.options.slice(0, 3).map(o => (
                  <button key={o} class={'pill ' + (picked[i] === o ? 'on' : '')}
                    onClick={() => setPicked({ ...picked, [i]: picked[i] === o ? '' : o })}>{o}</button>
                ))}
              </div>
            </div>
          ))}

          <button class="btn primary big" style="margin-top:16px" onClick={save}>{S.checkin.noted}</button>
          <div class="tiny" style="margin-top:8px;text-align:center">{S.checkin.steer}</div>
        </div>
      )}
    </div>
  );
}
