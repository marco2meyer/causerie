export interface ToastState {
  msg: string;
  err?: boolean;
  /** Optional action button (e.g. undo after a delete). */
  action?: { label: string; fn: () => void };
}

export type ToastFn = (msg: string, err?: boolean, action?: ToastState['action']) => void;

export function Toast({ t, onAction }: { t: ToastState | null; onAction?: () => void }) {
  if (!t) return null;
  return (
    <div class={'toast ' + (t.err ? 'err' : '')} role="status" aria-live="polite">
      <span>{t.msg}</span>
      {t.action && (
        <button class="toast-act" onClick={() => { t.action!.fn(); onAction?.(); }}>{t.action.label}</button>
      )}
    </div>
  );
}
