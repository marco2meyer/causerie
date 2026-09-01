import { Toast } from 'causerie-ds';
import { Overlay } from './_lib/kit';

/** The everyday confirmation: it drops in at the top of the screen and leaves on its own. */
export function Confirmation() {
  return (
    <Overlay width={480} height={110}>
      <Toast t={{ msg: 'Profil enregistré' }} />
    </Overlay>
  );
}

/** `err` switches the border and the text to the error tone. */
export function ErrorTone() {
  return (
    <Overlay width={480} height={110}>
      <Toast t={{ msg: 'Connexion perdue — réessaie', err: true }} />
    </Overlay>
  );
}

/** With an action: the undo affordance that follows a destructive edit. */
export function WithUndo() {
  return (
    <Overlay width={480} height={110}>
      <Toast t={{ msg: 'Carte supprimée', action: { label: 'Annuler', fn: () => {} } }} />
    </Overlay>
  );
}
