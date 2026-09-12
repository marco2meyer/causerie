import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { activeTutor, TUTORS, type TutorKey } from '../lib/tutors';

export type AvatarState = 'idle' | 'listening' | 'speaking' | 'thinking';

interface Props {
  /** 0..1 output audio level, drives the mouth while speaking. */
  level?: number;
  state?: AvatarState;
  size?: string;
  /** Which face; defaults to the profile's tutor. */
  tutor?: TutorKey;
}

/* Flat-design tutor faces in the La Troupe palette — one shared rig (head, level gaze,
 * blink, lip-sync, listening brow, thinking glance), six characters on top of it:
 * Odile (tomato beret, breton shirt), Marcel (grey beard, round glasses, wax shirt),
 * Solène (red curls, freckles, headphones on the collarbone), Nour (asymmetric ink hair,
 * gold hoop, inked work shirt), Bakary (short black hair, goatee, gold-trimmed teal
 * shirt), Rosa (silver chignon, gold hoops, bead necklace on terracotta). The face
 * carries state everywhere; the character layers never move, so the six stay siblings
 * rather than strangers. */

interface Look {
  skin: string;
  neck: string;
  /** Slightly darker skin: the nose stroke. */
  shade: string;
  ink: string; // hair + brows
  mouth: string;
  drawBack?(): JSX.Element; // behind the head (curls, falls)
  drawFront?(): JSX.Element; // over the head (top hair, headwear)
  drawFace?(): JSX.Element; // over the face, under the eyes' overlays (freckles, beard)
  drawGlasses?(): JSX.Element; // last, over lids
  drawShoulders(): JSX.Element;
}

const SHOULDERS = 'M46 240 Q48 178 120 176 Q192 178 194 240 Z';

const LOOKS: Record<TutorKey, Look> = {
  odile: {
    skin: '#F2C29E', neck: '#E8B48C', shade: '#D9A175', ink: '#101A2E', mouth: '#5E2B38',
    drawBack: () => (
      /* A bob: two falls that stop beside the jaw. The hair must never close under the
         chin — a closed ink shape there reads as a beard. */
      <path d="M64 78 Q64 34 120 34 Q176 34 176 78 L176 158 Q176 168 165 168 Q154 168 154 158 L154 126 L86 126 L86 158 Q86 168 75 168 Q64 168 64 158 Z" fill="#17233D" />
    ),
    drawFront: () => (
      <g>
        <path d="M64 96 Q60 40 120 38 Q180 40 176 96 L176 84 Q168 62 120 60 Q72 62 64 84 Z" fill="#101A2E" />
        <ellipse cx="118" cy="42" rx="52" ry="17" fill="#F0552F" transform="rotate(-6 118 42)" />
        <circle cx="118" cy="27" r="4.5" fill="#C93A20" />
      </g>
    ),
    drawShoulders: () => (
      <g>
        <path d={SHOULDERS} fill="#17233D" />
        <g clip-path="url(#tfsh)">
          {[186, 200, 214].map(y => <rect key={y} x="40" y={y} width="160" height="7" fill="#FFF3E3" />)}
        </g>
      </g>
    )
  },
  marcel: {
    skin: '#9C6238', neck: '#8A5432', shade: '#7E4C28', ink: '#3F3F3D', mouth: '#4B2430',
    drawFront: () => (
      /* Short grey hair: a solid cap whose inner edge rests on the face, so no sliver of
         background can open at the temples. */
      <path d="M70 92 Q68 42 120 40 Q172 42 170 92 Q160 68 120 66 Q80 68 70 92 Z" fill="#8F8F8B" />
    ),
    drawFace: () => (
      /* The beard: grey around the jaw, deliberately closing under the chin — with Marcel
         a beard is the point. The mouth is drawn after it, so it stays legible. */
      <path d="M78 126 L78 146 Q78 170 104 170 L136 170 Q162 170 162 146 L162 126 Q162 152 138 156 L102 156 Q78 152 78 126 Z" fill="#8F8F8B" />
    ),
    drawGlasses: () => (
      <g fill="none" stroke="#101A2E" stroke-width="3">
        <circle cx="97" cy="112" r="16" />
        <circle cx="143" cy="112" r="16" />
        <path d="M113 112 L127 112" />
        <path d="M81 110 L74 106" />
        <path d="M159 110 L166 106" />
      </g>
    ),
    drawShoulders: () => (
      <g>
        <path d={SHOULDERS} fill="#E0762F" />
        <g clip-path="url(#tfsh)">
          {/* wax motif: staggered rings on the orange */}
          {[[62, 196], [96, 214], [130, 194], [164, 212], [82, 232], [148, 232]].map(([x, y]) => (
            <circle key={x * 500 + y} cx={x} cy={y} r="7" fill="none" stroke="#B85A1F" stroke-width="4" />
          ))}
        </g>
      </g>
    )
  },
  solene: {
    skin: '#F4C89E', neck: '#E3B183', shade: '#DAA378', ink: '#8A3B22', mouth: '#7C2D3E',
    drawBack: () => (
      /* Curls: a wreath of circles that stays beside the jaw, never under it. */
      <g fill="#B0512E">
        {[[78, 74], [104, 58], [132, 54], [158, 66], [172, 90], [176, 118], [170, 142], [64, 118], [62, 92], [70, 142]].map(([x, y]) => (
          <circle key={x * 500 + y} cx={x} cy={y} r="17" />
        ))}
      </g>
    ),
    drawFront: () => (
      <path d="M68 96 Q64 44 120 42 Q176 44 172 96 L172 86 Q164 64 120 62 Q76 64 68 86 Z" fill="#B0512E" />
    ),
    drawFace: () => (
      <g fill="#D89B6A">
        {[88, 100, 112, 128, 140, 152].map(x => <circle key={x} cx={x} cy={x > 110 && x < 130 ? 138 : 132} r="1.9" />)}
      </g>
    ),
    drawShoulders: () => (
      <g>
        <path d={SHOULDERS} fill="#3E5F8A" />
        {/* hoodie drawstrings + the headphones resting on the collarbone */}
        <path d="M108 178 L106 206" stroke="#FFF3E3" stroke-width="3.5" stroke-linecap="round" />
        <path d="M132 178 L134 206" stroke="#FFF3E3" stroke-width="3.5" stroke-linecap="round" />
        <path d="M66 236 Q120 202 174 236" fill="none" stroke="#101A2E" stroke-width="6" />
        <rect x="58" y="224" width="15" height="22" rx="6" fill="#101A2E" />
        <rect x="167" y="224" width="15" height="22" rx="6" fill="#101A2E" />
      </g>
    )
  },
  bakary: {
    skin: '#6B4023', neck: '#5E3820', shade: '#53301B', ink: '#161310', mouth: '#4B2430',
    drawFront: () => (
      /* Short black hair, the same solid cap as Marcel's so no background opens at the
         temples — just younger and darker. */
      <path d="M70 92 Q68 40 120 38 Q172 40 170 92 Q160 66 120 64 Q80 66 70 92 Z" fill="#161310" />
    ),
    drawFace: () => (
      /* The goatee: a crescent hugging the chin only — never the jaw, or it reads as
         Marcel's beard on the wrong man. */
      <path d="M100 148 Q100 172 120 172 Q140 172 140 148 Q140 160 120 162 Q100 160 100 148 Z" fill="#161310" />
    ),
    drawShoulders: () => (
      <g>
        <path d={SHOULDERS} fill="#1E6E6E" />
        <g clip-path="url(#tfsh)">
          {/* the gold-trimmed collar band and placket of the teal shirt */}
          <path d="M92 178 Q120 196 148 178 L148 190 Q120 208 92 190 Z" fill="#D9A62E" />
          <rect x="116" y="196" width="8" height="52" fill="#D9A62E" />
        </g>
      </g>
    )
  },
  rosa: {
    skin: '#F2C9A4', neck: '#E5B78D', shade: '#D8A87E', ink: '#8C8880', mouth: '#9E3D33',
    drawBack: () => (
      /* The silver chignon, pinned high behind the crown. */
      <g fill="#C9C4BD">
        <circle cx="120" cy="34" r="19" />
        <circle cx="120" cy="34" r="8" fill="#ABA49B" />
      </g>
    ),
    drawFront: () => (
      /* Silver hair swept back into the bun: the same solid cap as the others, silver. */
      <path d="M68 94 Q64 42 120 40 Q176 42 172 94 Q162 66 120 64 Q78 66 68 94 Z" fill="#C9C4BD" />
    ),
    drawFace: () => (
      <g>
        {/* laugh lines, one stroke each — sixty-one years, worn well */}
        <path d="M84 138 Q81 144 84 150" fill="none" stroke="#D8A87E" stroke-width="2.5" stroke-linecap="round" />
        <path d="M156 138 Q159 144 156 150" fill="none" stroke="#D8A87E" stroke-width="2.5" stroke-linecap="round" />
        {/* gold hoops, both sides */}
        <circle cx="73" cy="130" r="6" fill="none" stroke="#C9A227" stroke-width="3" />
        <circle cx="167" cy="130" r="6" fill="none" stroke="#C9A227" stroke-width="3" />
      </g>
    ),
    drawShoulders: () => (
      <g>
        <path d={SHOULDERS} fill="#C4593B" />
        <g clip-path="url(#tfsh)">
          {/* the bead necklace on the terracotta blouse */}
          {[[96, 196], [108, 203], [120, 206], [132, 203], [144, 196]].map(([x, y]) => (
            <circle key={x * 500 + y} cx={x} cy={y} r="5" fill="#3E6E8C" />
          ))}
        </g>
      </g>
    )
  },
  nour: {
    skin: '#C68958', neck: '#B57B4E', shade: '#A26B3E', ink: '#17150F', mouth: '#5E2B38',
    drawFront: () => (
      <g>
        {/* the shaved side first, tucked under the sweep of ink hair falling left */}
        <rect x="148" y="58" width="18" height="38" rx="8" fill="#3A342C" />
        <path d="M66 102 Q62 36 122 34 Q170 38 166 72 Q136 56 104 62 Q76 70 66 102 Z" fill="#17150F" />
        <path d="M66 102 Q70 64 104 58 L96 92 Q78 96 66 118 Z" fill="#17150F" />
      </g>
    ),
    drawFace: () => (
      /* the gold hoop, on the shaved side */
      <circle cx="167" cy="130" r="6" fill="none" stroke="#C9A227" stroke-width="3" />
    ),
    drawShoulders: () => (
      <g>
        <path d={SHOULDERS} fill="#4E6151" />
        <g clip-path="url(#tfsh)">
          <circle cx="90" cy="212" r="6" fill="#23324A" />
          <circle cx="152" cy="226" r="4" fill="#23324A" />
          <circle cx="122" cy="196" r="3" fill="#23324A" />
        </g>
      </g>
    )
  }
};

export function TutorFace({ level = 0, state = 'idle', size = '100%', tutor }: Props) {
  const look = LOOKS[tutor && TUTORS[tutor] ? tutor : activeTutor().key];
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
  const lidH = blink ? 15 : 3.5; // open lids stay above the pupil: nonchalance is not the eyes' job
  const pupDx = state === 'thinking' ? -2.5 : 0;
  const pupDy = state === 'thinking' ? -2.5 : 0;

  return (
    <svg viewBox="40 20 160 160" style={{ width: size, height: size, display: 'block' }} aria-label={TUTORS[tutor && TUTORS[tutor] ? tutor : activeTutor().key].name}>
      <defs>
        <clipPath id="tfsh"><path d={SHOULDERS} /></clipPath>
      </defs>
      <g class="tfbob">
        {look.drawShoulders()}
        <rect x="106" y="150" width="28" height="34" rx="10" fill={look.neck} />
        {look.drawBack?.()}
        <rect x="74" y="66" width="92" height="92" rx="26" fill={look.skin} />
        {look.drawFront?.()}
        {look.drawFace?.()}
        <rect x="86" y={94 + browL} width="22" height="4.6" rx="2.3" fill={look.ink} />
        <rect x="132" y="94" width="22" height="4.6" rx="2.3" fill={look.ink} />
        <ellipse cx="97" cy="112" rx="10.5" ry="8" fill="#FFFFFF" />
        <ellipse cx="143" cy="112" rx="10.5" ry="8" fill="#FFFFFF" />
        <circle cx={98 + pupDx} cy={113 + pupDy} r="4" fill="#101A2E" />
        <circle cx={144 + pupDx} cy={113 + pupDy} r="4" fill="#101A2E" />
        <path d={`M86 ${104 + lidH} q11 ${blink ? 2 : -4} 22 0 l0 -${lidH + 6} q-11 -4 -22 0 Z`} fill={look.skin} />
        <path d={`M132 ${104 + lidH} q11 ${blink ? 2 : -4} 22 0 l0 -${lidH + 6} q-11 -4 -22 0 Z`} fill={look.skin} />
        <path d={`M86.5 ${104 + lidH} q11 ${blink ? 2 : -4} 21 0`} fill="none" stroke="#101A2E" stroke-width="2.6" stroke-linecap="round" />
        <path d={`M132.5 ${104 + lidH} q11 ${blink ? 2 : -4} 21 0`} fill="none" stroke="#101A2E" stroke-width="2.6" stroke-linecap="round" />
        <path d="M119 118 q4 7 -1 12" fill="none" stroke={look.shade} stroke-width="3" stroke-linecap="round" />
        {state === 'speaking'
          ? <ellipse cx="120" cy="149" rx={mouthW / 2} ry={mouthH / 2} fill={look.mouth} />
          : <path d={state === 'thinking' ? 'M110 149 q11 -3 21 1' : 'M109 147 q11 4.5 22 0'}
              fill="none" stroke={look.mouth} stroke-width="3.4" stroke-linecap="round" />}
        {look.drawGlasses?.()}
      </g>
      <style>{'.tfbob{animation:tfbob 3.6s ease-in-out infinite;transform-origin:120px 150px}@keyframes tfbob{0%,100%{transform:translateY(0)}50%{transform:translateY(2.5px)}}'}</style>
    </svg>
  );
}

/** The tutor of record, kept under the historical export name: every view imports Odile,
 *  and the component quietly renders whoever the profile chose. */
export const Odile = TutorFace;

interface BustProps {
  state?: AvatarState;
  level?: number;
  /** Diameter in px. */
  d?: number;
  /** The disc behind the face — blue on cream, a translucent cream on blue. */
  ring?: string;
  tutor?: TutorKey;
}

/** The face cropped into a small disc: the byline on anything the tutor said. Used
 *  wherever a line of theirs appears away from the call — the recast strip, the quiz
 *  verdict, a card's scene. */
export function Bust({ state = 'idle', level = 0, d = 32, ring = 'var(--blue)', tutor }: BustProps) {
  return (
    <span style={{ width: d, height: d, borderRadius: '50%', background: ring, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
      <span style={{ width: '100%', height: '100%', marginBottom: -Math.round(d * 0.1), display: 'block' }}>
        <TutorFace state={state} level={level} tutor={tutor} />
      </span>
    </span>
  );
}
