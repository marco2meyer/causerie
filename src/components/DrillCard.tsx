import { useState } from 'preact/hooks';
import type { GrammarDrill } from '../types';
import { checkAnswer } from '../lib/grammar';
import { MAX_OPTIONS } from '../lib/course';
import { gapParts } from '../views/Grammar';
import { ui } from '../lang';

/** One grammar exercise, shown in the middle of a review sitting.
 *
 *  It borrows the sitting's furniture — the same stage, the same card shape, the same single
 *  action button — but it is deliberately NOT a card: nothing here is graded, nothing is
 *  scheduled, and it never touches the deck. A card asks whether you remember something; this
 *  asks whether you can do something, and the answer only feeds the mastery verdict for the
 *  concept it belongs to (lib/grammar).
 *
 *  Its one visual tell is the blue field. Yellow in this app means a card that fell out of a
 *  conversation; blue means the app talking. A student mid-sitting needs to know in one
 *  glance that this one is not going to be re-scheduled by their answer. */
export function DrillCard({ drill, lang, onDone }: {
  drill: GrammarDrill;
  /** The target language the sentence is in, for the speech layer and the typography. */
  lang: string;
  /** Called with whether the answer was right, once the learner moves on. */
  onDone: (right: boolean) => void;
}) {
  const S = ui();
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<'right' | 'accent' | 'wrong' | null>(null);
  const answered = verdict !== null;
  const choice = drill.kind === 'choice' && drill.options.length >= 2;
  const canSubmit = choice ? picked !== null : typed.trim().length > 0;

  const check = () => {
    if (answered || !canSubmit) return;
    setVerdict(choice
      ? (checkAnswer(drill.options[picked!], drill.answer) === 'right' ? 'right' : 'wrong')
      : checkAnswer(typed, drill.answer));
  };

  return (
    <>
      <div class="rev-card drill">
        <div class="rev-type">{S.gram.drill}</div>
        <div class="gr-prompt" style="font-size:clamp(17px,4.4vw,21px)">{drill.prompt}</div>
        <div class="gr-sentence" lang={lang}>
          {gapParts(drill.text).map((p, k) => p === null
            ? <span key={k} class={'gr-slot' + (answered ? ' filled ' + (verdict === 'right' ? 'ok' : verdict === 'accent' ? 'near' : 'no') : '')}>
                {answered ? drill.answer : '      '}
              </span>
            : <span key={k}>{p}</span>)}
        </div>

        {drill.cue && <div class="gr-cue">{S.rev.hint} {drill.cue}</div>}

        {choice ? (
          <div class="gr-opts" style="width:100%;max-width:420px">
            {drill.options.slice(0, MAX_OPTIONS).map((o, k) => {
              const isRight = answered && checkAnswer(o, drill.answer) === 'right';
              const cls = answered ? (isRight ? ' right' : picked === k ? ' wrong' : ' dim') : (picked === k ? ' on' : '');
              return (
                <button key={k} class={'gr-opt' + cls} disabled={answered}
                  aria-pressed={picked === k} onClick={() => setPicked(k)}>{o}</button>
              );
            })}
          </div>
        ) : (
          <input class="gr-input" style="max-width:420px" value={typed} lang={lang} disabled={answered}
            placeholder={S.gram.answerHere} autocapitalize="off" autocomplete="off" spellcheck={false}
            onInput={e => setTyped((e.target as HTMLInputElement).value)}
            onKeyDown={e => { if (e.key === 'Enter') check(); }} />
        )}

        {answered && (
          <div class={'gr-verdict ' + (verdict === 'right' ? 'ok' : verdict === 'accent' ? 'near' : 'no')} style="width:100%;max-width:420px">
            <b>{verdict === 'right' ? S.gram.right : verdict === 'accent' ? S.gram.accent : S.gram.wrong}</b>
            {drill.explain && <span>{drill.explain}</span>}
          </div>
        )}
      </div>

      <div class="rev-actions">
        {answered
          ? <button class="cta solo" onClick={() => onDone(verdict === 'right')}>{S.gram.next}</button>
          : <button class="cta ink solo" disabled={!canSubmit} onClick={check}>{S.gram.check}</button>}
      </div>
    </>
  );
}
