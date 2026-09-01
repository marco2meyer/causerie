import { useState } from 'preact/hooks';
import { speak } from '../lib/tts';
import { I } from './icons';

/** Speaker button with visible lifecycle: spinner while the clip loads, brief red
 *  flash + optional toast on failure — never dead air. */
export function SpeakBtn({ text, cls = 'speakbtn', title, onFail }: {
  text: string;
  cls?: string;
  title: string;
  onFail?: () => void;
}) {
  const [st, setSt] = useState<'idle' | 'loading' | 'error'>('idle');
  return (
    <button class={cls + (st === 'loading' ? ' busy' : st === 'error' ? ' failed' : '')} title={title} aria-label={title}
      onClick={e => {
        e.stopPropagation();
        void speak(text, s => {
          if (s === 'loading') setSt('loading');
          else if (s === 'error') {
            setSt('error');
            onFail?.();
            setTimeout(() => setSt('idle'), 1800);
          } else setSt('idle');
        });
      }}>
      {st === 'loading' ? <span class="mini-spin"></span> : <I.speaker />}
    </button>
  );
}
