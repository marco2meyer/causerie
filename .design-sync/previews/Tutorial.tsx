import { Tutorial, setUiLang } from 'causerie-ds';
import { Overlay } from './_lib/kit';

/** The first-login tutorial: four slides in the UI language, Odile on every one.
 *  Only the first slide renders statically — advancing is a click. */
export function FirstSlideFrench() {
  setUiLang('fr');
  return (
    <Overlay width={560} height={470}>
      <Tutorial onDone={() => {}} />
    </Overlay>
  );
}

/** The same slide in German — every string comes from the active UI language pack. */
export function FirstSlideGerman() {
  setUiLang('de');
  return (
    <Overlay width={560} height={470}>
      <Tutorial onDone={() => {}} />
    </Overlay>
  );
}
