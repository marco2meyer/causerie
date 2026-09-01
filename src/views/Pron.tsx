import { useMemo, useRef, useState } from 'preact/hooks';
import type { Memory } from '../types';
import { buildRounds, earDay, earPhase, earStageFor } from '../lib/pron';
import { saveMem } from '../lib/storage';
import { speak } from '../lib/tts';
import { deepClone } from '../lib/utils';
import { I } from '../components/icons';
import { ui } from '../lang';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  onExit: () => void;
  toast: (msg: string, err?: boolean) => void;
}

const N = 10;

/** Minimal-pair perception training: one word plays (rotating voices), pick which of
 *  the pair you heard. HVPT-light — cents per run, ears sharpen fast. */
export function Pron({ mem, setMem, onExit, toast }: Props) {
  const S = ui();
  const stage = earStageFor(mem);
  const rounds = useMemo(() => buildRounds(mem.profile.target, N, stage), []);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<'a' | 'b' | null>(null);
  const [score, setScore] = useState(0);
  const [playing, setPlaying] = useState(false);
  const played = useRef(false);
  const r = rounds[Math.min(i, N - 1)];

  const play = () => {
    setPlaying(true);
    played.current = true;
    void speak(r.say, s => {
      if (s === 'error') { toast(S.common.audioFail, true); setPlaying(false); }
      if (s === 'done') setPlaying(false);
    }, r.voice);
  };

  const pick = (side: 'a' | 'b') => {
    if (picked || !played.current) return;
    setPicked(side);
    if (side === r.heard) setScore(s => s + 1);
  };

  const next = () => {
    setPicked(null);
    played.current = false;
    if (i + 1 >= N) {
      const m = deepClone(mem);
      m.xp += 4;
      saveMem(m);
      setMem(m);
      setI(N); // done screen
    } else setI(i + 1);
  };

  if (i >= N) {
    return (
      <div class="rev-stage fadein">
        <div class="rev-card">
          <div class="rev-type">{S.pron.title}</div>
          <div class="rev-front" style="font-size:22px">{S.pron.score(score, N)}</div>
          <div class="rev-ex">{score >= N * 0.8 ? S.pron.good : S.pron.meh} · +4 XP</div>
        </div>
        <div class="rev-actions">
          <button class="btn primary big" onClick={onExit}>{S.common.done}</button>
        </div>
      </div>
    );
  }

  return (
    <div class="rev-stage fadein">
      <div class="rev-top">
        <button class="btn subtle" style="padding:7px 12px;font-size:12.5px" onClick={onExit}>{S.common.back}</button>
        <div class="rev-bar"><i style={{ width: (i / N) * 100 + '%' }}></i></div>
        <span class="tiny" style="width:44px;text-align:right">{i + 1}/{N}</span>
      </div>
      <div class="rev-card">
        <div class="rev-type">
          {S.pron.title} · {r.pair.tag}{earPhase(mem) ? ' · ' + S.pron.dayOf(Math.min(14, earDay(mem))) : ''}
        </div>
        <button class="speakbtn" style="width:64px;height:64px;margin:10px 0" title={S.pron.replay} onClick={play} disabled={playing}>
          {playing ? <span class="mini-spin"></span> : <I.speaker />}
        </button>
        <div class="rev-hint">{played.current ? S.pron.which : S.pron.start}</div>
        <div class="row" style="margin-top:14px;gap:10px">
          {(['a', 'b'] as const).map(side => {
            const on = picked && side === r.heard;
            const wrong = picked === side && side !== r.heard;
            return (
              <button key={side} lang={mem.profile.target}
                class={'btn ghost big'}
                style={`flex:1;${on ? 'background:var(--jaune);border-color:var(--edge);color:var(--ink)' : ''}${wrong ? 'background:var(--tomato);border-color:var(--tomato);color:var(--cream)' : ''}`}
                onClick={() => pick(side)}>
                {r.pair[side]}
              </button>
            );
          })}
        </div>
      </div>
      <div class="rev-actions">
        {picked && <button class="btn primary big" onClick={next}>{S.tuto.next}</button>}
      </div>
    </div>
  );
}
