import { useEffect, useRef, useState } from 'preact/hooks';
import type { Memory } from '../types';
import { startRec, type Rec } from '../lib/recorder';
import { saveMem } from '../lib/storage';
import { transcribeVerbatim } from '../lib/transcribe';
import { deepClone, todayISO } from '../lib/utils';
import { I } from '../components/icons';
import { ui } from '../lang';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  topic: string;
  onExit: () => void;
  toast: (msg: string, err?: boolean) => void;
}

/** 4/3/2 fluency retells (Nation): the same story three times against shrinking timers
 *  (60/45/30 s here, scaled to the app's short calls). Recording + transcription only —
 *  no live tutor, so a full run costs cents. */
const ROUNDS = [60, 45, 30];

interface RoundResult { words: number; wpm: number; text: string }

export function Retell({ mem, setMem, topic, onExit, toast }: Props) {
  const S = ui();
  const [phase, setPhase] = useState<'intro' | 'rec' | 'busy' | 'done'>('intro');
  const [round, setRound] = useState(0);
  const [left, setLeft] = useState(ROUNDS[0]);
  const [results, setResults] = useState<RoundResult[]>([]);
  const recRef = useRef<Rec | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startedAt = useRef(0);

  useEffect(() => () => { clearInterval(timerRef.current); recRef.current?.cancel(); }, []);

  const begin = async () => {
    try {
      recRef.current = await startRec();
    } catch {
      toast(S.flu.failMic, true);
      return;
    }
    startedAt.current = Date.now();
    setLeft(ROUNDS[round]);
    setPhase('rec');
    timerRef.current = setInterval(() => {
      const remain = ROUNDS[round] - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, remain));
      if (remain <= 0) void finishRound();
    }, 250);
  };

  const finishRound = async () => {
    clearInterval(timerRef.current);
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    setPhase('busy');
    const seconds = Math.max(5, Math.min(ROUNDS[round], Math.round((Date.now() - startedAt.current) / 1000)));
    const blob = await rec.stop();
    const text = (await transcribeVerbatim(blob, mem.profile.target || 'fr')) ?? '';
    const words = text.split(/\s+/).filter(Boolean).length;
    const res = [...results, { words, wpm: Math.round(words / (seconds / 60)), text }];
    setResults(res);
    if (round + 1 < ROUNDS.length) {
      setRound(round + 1);
      setPhase('intro');
    } else {
      const m = deepClone(mem);
      m.fluency = [...(m.fluency ?? []), { date: todayISO(), topic, words: res.map(r => r.words), wpm: res.map(r => r.wpm) }].slice(-60);
      m.xp += 6;
      saveMem(m);
      setMem(m);
      setPhase('done');
    }
  };

  if (phase === 'done') {
    const up = results.length === 3 && results[2].wpm >= results[0].wpm;
    return (
      <div class="rev-stage fadein">
        <div class="rev-card">
          <div class="rev-type">{S.flu.title}</div>
          <div class="rev-front" style="font-size:19px">{S.flu.results}</div>
          <div class="flu-res">
            {results.map((r, i) => (
              <div key={i} class="flu-row">
                <span class="tiny">{S.flu.round(i + 1, ROUNDS[i])}</span>
                <b>{r.wpm} {S.flu.wpm}</b>
                <span class="tiny">{r.words} {S.flu.mots}</span>
              </div>
            ))}
          </div>
          <div class="rev-ex">{up ? S.flu.praiseUp : S.flu.praiseFlat} · +6 XP</div>
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
        <div class="rev-bar"><i style={{ width: (round / ROUNDS.length) * 100 + '%' }}></i></div>
        <span class="tiny" style="width:52px;text-align:right">{round + 1}/3</span>
      </div>
      <div class="rev-card">
        <div class="rev-type">{S.flu.title} · {S.flu.round(round + 1, ROUNDS[round])}</div>
        <div class="rev-front" style="font-size:18px">{topic}</div>
        {phase === 'intro' && round === 0 && <div class="rev-hint">{S.flu.explain}</div>}
        {phase === 'rec' && (
          <div class="flu-timer" role="timer">
            <b>{left}</b><span class="tiny"> s</span>
            <div class="tiny" style="margin-top:4px">{S.flu.recording}</div>
          </div>
        )}
        {phase === 'busy' && <div class="muted" style="margin-top:10px"><span class="mini-spin"></span> {S.flu.transcribing}</div>}
      </div>
      <div class="rev-actions">
        {phase === 'intro' && (
          <button class="btn primary big" onClick={() => void begin()}><I.mic /> {S.flu.start}</button>
        )}
        {phase === 'rec' && (
          <button class="btn ghost big" onClick={() => void finishRound()}>{S.flu.stopEarly}</button>
        )}
      </div>
    </div>
  );
}
