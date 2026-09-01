/** Causerie design system — the presentational surface of the app.
 *
 *  This barrel is the design-system entry point: it re-exports the app's real
 *  components unchanged. Nothing here is a reimplementation — every export is the
 *  same function `src/` ships to production. */

export { Odile, type AvatarState } from '../../src/components/Avatar';
export { RankMark } from '../../src/components/RankMark';
export { I } from '../../src/components/icons';
export { Toast, type ToastState, type ToastFn } from '../../src/components/Toast';
export { SpeakBtn } from '../../src/components/SpeakBtn';
export { SheetView } from '../../src/components/SheetView';
export { Tutorial } from '../../src/components/Tutorial';
export { Ladder, HistoryChart } from '../../src/components/charts';

/** Real grammar cheat-sheet content from the language packs — the data SheetView renders. */
export { SHEETS, SHEET_BY_ID, type CheatSheet } from '../../src/lib/sheets';

/** Language control. Every text-bearing component reads its strings from the active UI
 *  language (French by default) — call setUiLang() before rendering to switch. */
export { setUiLang, ui, uiLangCode } from '../../src/lang';
