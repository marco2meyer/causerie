import { useEffect, useState } from 'preact/hooks';

export type AvatarState = 'idle' | 'listening' | 'speaking' | 'thinking';

interface Props {
  /** 0..1 output audio level, drives the mouth while speaking. */
  level?: number;
  state?: AvatarState;
  size?: string;
}

/** Odile: flat-design tutor character (tomato beret, breton shirt, heavy lids), drawn in
 *  the La Troupe palette — ink hair and shoulders, cream stripes, nothing but flat fills.
 *  She is a person rather than a UI element, so her face carries state everywhere: blinks
 *  on a randomized timer, lip-syncs from `level`, drops a brow while listening, looks up
 *  and to the side while thinking. */
export function Odile({ level = 0, state = 'idle', size = '100%' }: Props) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => alive && setBlink(false), 150);
        loop();
      }, 2200 + Math.random() * 3200);
    };
    loop();
    return () => { alive = false; clearTimeout(t); };
  }, []);

  const lv = Math.max(0, Math.min(1, level));
  const mouthH = state === 'speaking' ? 2.5 + lv * 11 : 0;
  const mouthW = state === 'speaking' ? 13 + lv * 7 : 0;
  const browL = state === 'listening' ? -4 : 0;
  const lidH = blink ? 15 : 6.5;
  const pupDx = state === 'thinking' ? -2.5 : 0;
  const pupDy = state === 'thinking' ? -2.5 : 0;

  return (
    <svg viewBox="40 20 160 160" style={{ width: size, height: size, display: 'block' }} aria-label="Odile">
      <defs>
        <clipPath id="odsh"><path d="M46 240 Q48 178 120 176 Q192 178 194 240 Z" /></clipPath>
      </defs>
      <g class="odbob">
        <path d="M46 240 Q48 178 120 176 Q192 178 194 240 Z" fill="#17233D" />
        <g clip-path="url(#odsh)">
          {[186, 200, 214].map(y => <rect key={y} x="40" y={y} width="160" height="7" fill="#FFF3E3" />)}
        </g>
        <rect x="106" y="150" width="28" height="34" rx="10" fill="#E8B48C" />
        <path d="M64 78 Q64 34 120 34 Q176 34 176 78 L176 150 Q176 176 120 176 Q64 176 64 150 Z" fill="#17233D" />
        <rect x="74" y="66" width="92" height="92" rx="26" fill="#F2C29E" />
        <path d="M64 96 Q60 40 120 38 Q180 40 176 96 L176 84 Q168 62 120 60 Q72 62 64 84 Z" fill="#101A2E" />
        <ellipse cx="118" cy="42" rx="52" ry="17" fill="#F0552F" transform="rotate(-6 118 42)" />
        <circle cx="118" cy="27" r="4.5" fill="#C93A20" />
        <rect x="86" y={94 + browL} width="22" height="4.6" rx="2.3" fill="#101A2E" />
        <rect x="132" y="94" width="22" height="4.6" rx="2.3" fill="#101A2E" />
        <ellipse cx="97" cy="112" rx="10.5" ry="8" fill="#FFFFFF" />
        <ellipse cx="143" cy="112" rx="10.5" ry="8" fill="#FFFFFF" />
        <circle cx={98 + pupDx} cy={113 + pupDy} r="4" fill="#101A2E" />
        <circle cx={144 + pupDx} cy={113 + pupDy} r="4" fill="#101A2E" />
        <path d={`M86 ${104 + lidH} q11 ${blink ? 2 : -5} 22 0 l0 -${lidH + 6} q-11 -4 -22 0 Z`} fill="#F2C29E" />
        <path d={`M132 ${104 + lidH} q11 ${blink ? 2 : -5} 22 0 l0 -${lidH + 6} q-11 -4 -22 0 Z`} fill="#F2C29E" />
        <path d={`M86.5 ${104 + lidH} q11 ${blink ? 2 : -5} 21 0`} fill="none" stroke="#101A2E" stroke-width="2.6" stroke-linecap="round" />
        <path d={`M132.5 ${104 + lidH} q11 ${blink ? 2 : -5} 21 0`} fill="none" stroke="#101A2E" stroke-width="2.6" stroke-linecap="round" />
        <path d="M119 118 q4 7 -1 12" fill="none" stroke="#D9A175" stroke-width="3" stroke-linecap="round" />
        {state === 'speaking'
          ? <ellipse cx="120" cy="149" rx={mouthW / 2} ry={mouthH / 2} fill="#5E2B38" />
          : <path d={state === 'thinking' ? 'M110 149 q11 -3 21 1' : 'M109 147 q11 4.5 22 0'}
              fill="none" stroke="#5E2B38" stroke-width="3.4" stroke-linecap="round" />}
      </g>
      <style>{'.odbob{animation:odbob 3.6s ease-in-out infinite;transform-origin:120px 150px}@keyframes odbob{0%,100%{transform:translateY(0)}50%{transform:translateY(2.5px)}}'}</style>
    </svg>
  );
}

interface BustProps {
  state?: AvatarState;
  level?: number;
  /** Diameter in px. */
  d?: number;
  /** The disc behind her — blue on cream, a translucent cream on blue. */
  ring?: string;
}

/** Odile cropped into a small disc: the byline on anything she said. Used wherever a line
 *  of hers appears away from the call — the recast strip, the quiz verdict, a card's scene. */
export function Bust({ state = 'idle', level = 0, d = 32, ring = 'var(--blue)' }: BustProps) {
  return (
    <span style={{ width: d, height: d, borderRadius: '50%', background: ring, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
      <span style={{ width: '100%', height: '100%', marginBottom: -Math.round(d * 0.1), display: 'block' }}>
        <Odile state={state} level={level} />
      </span>
    </span>
  );
}
