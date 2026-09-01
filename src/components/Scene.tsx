import type { JSX } from 'preact';
import { changedWords } from '../lib/utils';
import { Bust } from './Avatar';
import { ui } from '../lang';

/** A cloze front with its gap drawn the way La Troupe draws a missing word: a tomato rule
 *  the sentence runs over, rather than a row of underscores. Pass `fill` to close the gap
 *  on reveal — the answer lands in the sentence, in tomato, where the rule was. */
export function ClozeText({ text, fill }: { text: string; fill?: string }): JSX.Element {
  const parts = String(text ?? '').split(/(_{2,})/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!/^_{2,}$/.test(p)) return <span key={i}>{p}</span>;
        return fill
          ? <span key={i} style="color:var(--tomato-deep)">{fill}</span>
          : <span key={i} class="gapline">&nbsp;</span>;
      })}
    </>
  );
}

/** Her recast, with the words she changed marked in yellow — the system's one convention
 *  for "this is what moved". */
export function Recast({ before, after }: { before: string; after: string }): JSX.Element {
  return (
    <>
      {changedWords(before, after).map((t, i) => (
        <span key={i}>{t.ch ? <mark class="diffm">{t.w}</mark> : t.w}{' '}</span>
      ))}
    </>
  );
}

/** What you said, with only the words she replaced struck through. Striking the whole
 *  line would say the whole sentence was wrong, and it almost never is — the point of a
 *  recast is that most of it survived. */
export function Said({ text, fixed }: { text: string; fixed?: string }): JSX.Element {
  if (!fixed) return <>{text}</>;
  return (
    <>
      {changedWords(fixed, text).map((t, i) => (
        <span key={i}>{t.ch ? <span class="struck">{t.w}</span> : t.w}{' '}</span>
      ))}
    </>
  );
}

interface StripProps {
  /** What you said. Struck through where she changed it. */
  you: string;
  /** What she said back. */
  her: string;
  /** What fell out of the exchange — usually the card. Omitted while there isn't one. */
  out?: JSX.Element | string;
  compact?: boolean;
  /** Target language, for hyphenation and screen readers. */
  lang?: string;
}

/** The three-panel strip: your line, her recast laid over it, then the card that fell out.
 *  This is the debrief's whole shape in La Troupe — a wrong sentence is a panel in a comic
 *  strip, not a red error state, and the correction is something she says rather than
 *  something the app scores. */
export function Strip({ you, her, out, compact, lang }: StripProps): JSX.Element {
  const S = ui();
  const pad = compact ? '12px 15px' : undefined;
  const fs = compact ? '16.5px' : undefined;
  const txt = (extra?: string) => `${fs ? `font-size:${fs};` : ''}${extra ?? ''}`;
  return (
    <div class="strip">
      <div class="p-you" style={pad ? `padding:${pad}` : undefined}>
        <div class="kicker">{S.review.panelYou}</div>
        <div class="txt" style={txt()} lang={lang}><Said text={you} fixed={her} /></div>
      </div>
      <div class="p-her" style={pad ? `padding:${pad}` : undefined}>
        <Bust state="speaking" level={0.7} d={30} ring="rgba(255,243,227,.22)" />
        <div style="min-width:0">
          <div class="kicker">{S.review.panelHer}</div>
          <div class="txt" style={txt()} lang={lang}><Recast before={you} after={her} /></div>
        </div>
      </div>
      {out && (
        <div class="p-out" style={pad ? `padding:${pad}` : undefined}>
          <div class="kicker">{S.review.panelOut}</div>
          <div class="txt" style={txt()} lang={lang}>{out}</div>
        </div>
      )}
    </div>
  );
}
