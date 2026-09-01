import { SHEETS, SheetView } from 'causerie-ds';
import { Overlay } from './_lib/kit';

// Real sheets from the French pack — the same objects sheetsForCall() hands the
// overlay during a call.
const fr = SHEETS.filter((s: any) => s.lang === 'fr');
const first = fr[0];
const second = fr[1] ?? fr[0];

/** One sheet: the formation, the rules that matter, examples with a native gloss, the traps. */
export function OneSheet() {
  return (
    <Overlay width={600} height={540}>
      <SheetView sheets={[first]} closeLabel="Fermer" onClose={() => {}} />
    </Overlay>
  );
}

/** A call carries at most two sheets — the tab row appears only then. */
export function TwoSheetsTabbed() {
  return (
    <Overlay width={600} height={540}>
      <SheetView sheets={[first, second]} closeLabel="Fermer" onClose={() => {}} />
    </Overlay>
  );
}
