# design-sync notes — causerie

Repo-specific gotchas for future syncs. Read this before touching anything.

## This repo is an app, not a component library

Causerie is a Preact application. There is no published package, no `dist/`, no Storybook.
The design system is real (`src/styles/global.css` — 222 custom properties plus a semantic
class vocabulary) but it ships as part of the app.

- `.design-sync/ds-pkg/` is a **synthetic DS package** built for the sync. It re-exports the
  app's real components from `src/components/` — it never copies or reimplements them. Its
  `build.mjs` produces `dist/ds.js` (the bundle entry), `dist/types/**` (declarations),
  `dist/styles.css` (a build-time copy of `src/styles/global.css`) and `dist/fonts-alias.css`.
- `cfg.buildCmd` = `node .design-sync/ds-pkg/build.mjs`. **Always run it before the converter**
  — the converter reads its output, not `src/`.
- The scoped surface is the presentational components only (the user's choice on the first
  sync). App views (`src/views/*`) and app-state components (`CardForge`, `Personalize`,
  `StoryPlayer`, `CardImg`) are deliberately out of scope. `CardImg` in particular cannot
  render statically — it resolves an image from IndexedDB/Supabase and returns `null` until
  it does.

## Preact → React interop

The claude.ai/design runtime is React; the source is Preact. `ds-pkg/build.mjs` aliases
`preact`, `preact/hooks` and `preact/compat` to `react`, and points `preact/jsx-runtime` at
`ds-pkg/jsx-shim.js`. The shim normalizes the three Preact idioms React rejects:

- `class` → `className`, `for` → `htmlFor`
- string `style="a:b;c:d"` → a style object (custom properties keep their `--name` key)
- hyphenated SVG presentation attributes (`stroke-width`, `clip-path`, `stop-color`, …) →
  React's camelCase names. **If a new SVG attribute shows up in the source, add it to
  `SVG_ATTR` in `jsx-shim.js`** — React logs "Invalid DOM property" and drops it otherwise.

Hooks are API-identical, so nothing else needs adapting. Component source is untouched.

## Preview files need their own tsconfig

`.design-sync/previews/tsconfig.json` pins `jsxImportSource: "react"`. Without it esbuild
walks up to the repo tsconfig (`jsxImportSource: "preact"`), the previews emit Preact vnodes,
and every card dies with *"Objects are not valid as a React child"*. **Preview files use React
idioms** (`className`, object `style`) — the opposite of the app source. Don't delete that file.

- `.design-sync/previews/_lib/kit.tsx` holds `Surface` / `Cap` / `Overlay`. It lives in a
  subdirectory on purpose: a `.tsx` directly in `previews/` that isn't a component name gets
  logged as a stale preview on every build.
- `Overlay` exists because `.toast`, `.sheetveil` and `.tuto-veil` are `position: fixed`. Its
  `transform: translateZ(0)` makes the wrapper the containing block, so the overlay lands
  inside the card. Card frames are painted white by the harness, so **every cell wraps in
  `Surface` or `Overlay`** — Causerie is dark-only and reads as broken on white.

## Playwright

The repo pins playwright 1.62.1 (chromium build 1234), which is **not** in the local cache.
`.ds-sync/` therefore installs `playwright@1.61.0`, which pins build 1228 — already cached at
`~/Library/Caches/ms-playwright`. That avoids a ~150 MB download. If the cache changes, match
the version to a cached `chromium-<build>` rather than downloading.

## Fonts

`--body` and `--disp` name the variable families first and the plain names as fallbacks:
`"Inter Variable","Inter",…`. @fontsource only ships `@font-face` for the *Variable* names, so
validate reported `[FONT_MISSING]` for `Inter` / `Space Grotesk`. Fixed properly, not waived:
`ds-pkg/build.mjs` generates `dist/fonts-alias.css`, re-declaring the **same** woff2 files
under the bare family names. No substitutes were accepted.

## `I` (the icon namespace) is exported but is not a card

`I` is an object of 24 zero-prop icon components (`<I.mic />`). The converter's `.d.ts`
emitter would type it as `React.ComponentType<IProps>` — a contract that invites
`<I name="mic" />`, which crashes. The namespace-only `.d.ts` branch in `lib/emit.mjs`
requires a `Root` member and PascalCase keys, and Causerie's keys are lowercase.

So `componentSrcMap: {"I": null}` excludes it from the component list. **It is still in the
bundle** (`window.Causerie.I`) and the full icon list plus the `<I.mic />` usage is enumerated
in `conventions.md`, which the design agent reads inline. If a future converter handles
lowercase compound members, re-adding `I` as a component would also restore its gallery card
(the authored preview was deleted; it rendered a 24-icon grid, a tone/size sweep and a nav bar).

## Grouping

Components have no per-component docs. `.design-sync/docs/<Name>.md` are frontmatter-only
stubs whose sole job is `category:` — Brand / Controls / Overlays / Progress. Without them
everything lands in `general`. The `.prompt.md` files stay synthesized from the real `.d.ts`,
JSDoc and previews, so they cannot drift.

## Known render warns

None — the final validate exits 0 with zero warnings. Two that were resolved rather than
recorded: `[FONT_MISSING]` (see Fonts) and `[GRID_OVERFLOW]` on the three fixed-position
overlays (fixed with `cardMode: "single"` + `primaryStory`). If `[GRID_OVERFLOW]` returns for
a new overlay component, that is the remedy.

## Re-sync risks

- **`src/styles/global.css` is copied at build time.** A change there ships automatically —
  but a change to the *class vocabulary* silently invalidates `conventions.md`, which
  enumerates class and token names by hand. Re-run the validation pass in the base skill's
  conventions step on every sync; it greps the built artifacts for every name claimed.
- **`ds-pkg/index.tsx` is a hand-maintained barrel.** A component renamed or moved in
  `src/components/` breaks the build loudly (good), but a *new* presentational component is
  simply never synced. Check `src/components/` against the barrel each time.
- **`componentSrcMap` pins four src paths** (`Odile`→Avatar.tsx, `Ladder`/`HistoryChart`→
  charts.tsx) because the file names don't match the export names. Renaming those files
  silently drops JSDoc and grouping enrichment.
- **Preview data is inlined.** `HistoryChart.tsx` carries a hand-written `Memory`-shaped
  literal cast through `as any`; if `mem.cefr.history` changes shape the preview keeps
  rendering but stops being truthful. `SheetView.tsx` and `Tutorial.tsx` read real content
  from the bundle (`SHEETS`, `setUiLang`) and do not have this problem.
- **Not verified:** interaction states. `SpeakBtn`'s `loading` (spinner) and `error` (red
  flash) states are driven by the TTS lifecycle and cannot render statically; `Tutorial`
  slides 2–4 need a click. Only the first slide and the idle button are graded.
- **Toolchain assumed:** node 22, TypeScript 7 (`node_modules/.bin/tsc`, used for declaration
  emit only). `.design-sync/node_modules` is a gitignored symlink to `.ds-sync/node_modules`
  — recreate it on a fresh clone with
  `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` before running `ds-pkg/build.mjs`.
