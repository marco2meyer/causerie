import { useEffect, useRef, useState } from 'preact/hooks';
import type { Memory } from '../types';
import { forgeExisting, forgeToCards, suggestCards, type ForgedCard } from '../lib/forge';
import { saveMem } from '../lib/storage';
import { deepClone } from '../lib/utils';
import { ui } from '../lang';

interface Props {
  mem: Memory;
  setMem: (m: Memory) => void;
  /** Prefilled input (e.g. a transcript turn); empty for the blank "new card" flow. */
  seed?: string;
  /** Transcript turn the seed came from; stored on the cards so the conversation can
   *  show that this turn produced cards. */
  turnId?: string;
  /** Conversation the seed came from, when there is one. */
  sessionId?: string;
  onClose: () => void;
  toast: (msg: string, err?: boolean) => void;
}

/** "Nouvelle carte": type a term (or arrive with a transcript excerpt), get up to three
 *  complementary proposals (recognition / cloze / production), keep the ones you want. */
export function CardForge({ mem, setMem, seed, turnId, sessionId, onClose, toast }: Props) {
  const S = ui();
  const [input, setInput] = useState(seed ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [props_, setProps] = useState<ForgedCard[] | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>('textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const TYPE_LABEL: Record<ForgedCard['type'], string> = {
    cloze: S.cards.typeCloze,
    fr2de: (mem.profile.target || 'fr').toUpperCase() + '→' + (mem.profile.native || 'de').toUpperCase(),
    de2fr: (mem.profile.native || 'de').toUpperCase() + '→' + (mem.profile.target || 'fr').toUpperCase()
  };

  const run = async () => {
    if (!input.trim() || busy) return;
    setErr('');
    setBusy(true);
    try {
      const cards = await suggestCards(input.trim(), mem);
      if (!cards.length) setErr(S.forge.none);
      setProps(cards);
      // Recognition + cloze on by default, but never a proposal the deck already holds:
      // it would be dropped at add time and the button would look dead.
      const have = forgeExisting(cards, mem.deck);
      setPicked(cards.map((_, i) => i < 2 && !have[i]));
      // Nothing here would be new. Say that now, rather than leaving a disabled button
      // to be read as the sheet being broken.
      if (cards.length && have.every(Boolean)) setErr(S.forge.already);
    } catch {
      setErr(S.forge.fail);
    }
    setBusy(false);
  };

  const add = () => {
    if (!props_) return;
    const chosen = props_.filter((_, i) => picked[i]);
    const m = deepClone(mem);
    const created = forgeToCards(chosen, m.deck, turnId, sessionId);
    // Every pick was already in the deck. Closing on that (with "0 cartes ajoutées")
    // is indistinguishable from the button not working: stay open and say so.
    if (!created.length) { setErr(S.forge.already); return; }
    m.deck.cards.push(...created);
    saveMem(m);
    setMem(m);
    toast(S.forge.added(created.length));
    onClose();
  };

  const have = props_ ? forgeExisting(props_, mem.deck) : [];
  /** Cards that would actually be created — what the button promises. */
  const nNew = picked.filter((p, i) => p && !have[i]).length;

  return (
    <div class="sheetveil" role="dialog" aria-modal="true" aria-label={S.forge.title} ref={rootRef}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="sheet" style="max-width:480px;text-align:left">
        <div class="spread" style="margin-bottom:10px">
          <div style="font-family:var(--disp);font-weight:800;font-size:19px">{S.forge.title}</div>
          <button class="btn subtle" style="padding:6px 11px;font-size:12px" onClick={onClose}>{S.common.close}</button>
        </div>

        <textarea rows={seed ? 3 : 2} placeholder={S.forge.inputPh} value={input}
          onInput={e => setInput((e.target as HTMLTextAreaElement).value)} />
        <button class="btn primary big" style="margin-top:10px" disabled={busy || !input.trim()} onClick={() => void run()}>
          {busy ? S.forge.suggesting : S.forge.suggest}
        </button>

        {err && <div class="tiny" style="color:var(--red);margin-top:8px">{err}</div>}

        {props_ && props_.length > 0 && (
          <div style="margin-top:12px">
            {props_.map((c, i) => (
              <button key={i} class={'forge-prop' + (picked[i] ? ' on' : '') + (have[i] ? ' had' : '')} aria-pressed={picked[i]}
                onClick={() => setPicked(p => p.map((v, k) => (k === i ? !v : v)))}>
                <span class="chip sm" style="flex-shrink:0">{have[i] ? S.forge.exists : TYPE_LABEL[c.type]}</span>
                <span class="fp-main">
                  <b>{c.front}</b>
                  <span style="color:var(--teal)"> → {c.back}</span>
                  {c.example && c.type !== 'cloze' ? <span class="tiny" style="display:block;margin-top:2px">{c.example}</span> : null}
                </span>
                <span class={'fp-tick' + (picked[i] ? ' on' : '')}>{picked[i] ? '✓' : ''}</span>
              </button>
            ))}
            <button class="btn primary big" style="margin-top:10px" disabled={nNew === 0} onClick={add}>
              {S.forge.add(nNew)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
