## Causerie — how to build with it

Causerie is a **dark-only** design system: `styles.css` sets `color-scheme: dark` and paints
`html, body` with `--bg0` / `--ink`. There is no theme provider and no light mode — link
`styles.css` and components are styled. Do not add a light background; the palette assumes
the dark ground.

### The shell

Every screen lives inside the app frame: `.shell` (max-width 1160px, centred, column on
mobile / row from 900px) wrapping `.main` (the scrolling content) and `.nav` (bottom tab bar
on mobile, left rail from 900px). `.nav button.on` marks the active tab.

```jsx
<div className="shell">
  <nav className="nav">
    <div className="brand"><span className="dot" />Causerie</div>
    <button className="on"><I.home />Aujourd’hui</button>
    <button><I.phone />Appel</button>
  </nav>
  <main className="main">{/* screen content */}</main>
</div>
```

### Styling idiom: global classes + custom properties

**No utility classes, no CSS-in-JS.** One global stylesheet defines a small vocabulary of
semantic classes; anything it does not cover is written as inline styles that reference the
tokens (`style={{ color: 'var(--ink3)' }}`). Never hard-code a hex value — every colour,
radius and font in the system is a token.

**Tokens** (all defined on `:root`):

| Family | Names |
|---|---|
| Surfaces | `--bg0` (page) `--bg1` (card) `--bg2` (control) `--bg3` (raised) |
| Hairlines | `--line` `--line2` |
| Text | `--ink` (primary) `--ink2` (secondary) `--ink3` (tertiary) |
| Accents | `--rose` (brand/primary action) `--rose-deep` `--blue` `--teal` `--purple` `--amber` `--red`, each with a `--*-soft` tint (`--rose-soft`, `--blue-soft`, `--teal-soft`, `--purple-soft`, `--amber-soft`) |
| Charts | `--chart` (series) `--grid` `--axis` |
| Shape | `--r` (18px, cards) `--r-sm` (12px, controls) `--shadow` |
| Type | `--disp` (Space Grotesk — headings, numerals, labels) `--body` (Inter — everything else) |

**Classes** — the whole public vocabulary:

| Family | Classes |
|---|---|
| Layout | `.shell` `.main` `.nav` `.brand` `.row` (flex, centred, gap 10) `.spread` (flex, space-between) |
| Containers | `.card` `.daycard` `.stat` (with `.v` value / `.l` label children) |
| Type | `.section-t` (uppercase section heading) `.muted` `.tiny` `.mono` |
| Buttons | `.btn` plus `.primary` (rose gradient) `.ghost` `.subtle` `.danger` `.big` (full width); `.iconbtn` (44px round) `.speakbtn` (40px round, `.sm` variant) |
| Tags | `.chip` with `.rose` `.blue` `.teal` `.purple` `.amber` `.sm`; `.lvl` (CEFR level badge) |
| Navigation | `.tabs` + `.tabs button.on` |
| Overlays | `.sheetveil` / `.sheetcard`, `.tuto-veil` / `.tuto-card`, `.toast` (all `position: fixed`) |

Read `_ds/<folder>/styles.css` and the files it `@import`s before styling anything — it is
the complete and current source, and it carries far more than this summary.

### Language

Text-bearing components (`Tutorial`, `SheetView`, `HistoryChart`) read their strings from the
active UI language, **French by default**. Call `setUiLang(code)` once before rendering:
`'fr' | 'es' | 'it' | 'pt' | 'en' | 'de'`. Content is French/target-language; UI chrome
follows the chosen language.

### Icons

`I` is a namespace of zero-prop icon components — render as `<I.mic />`. They inherit
`currentColor` and are sized by their container (`.btn svg` 18px, `.nav button svg` 21px,
`.chip svg` 13px), so set the colour on the parent, not the icon.

`home brain gear mic micoff down cc flame star check x spark chev phone cards speaker
shuffle user image brush pause play speakeroff trash`

### A typical screen

```jsx
<main className="main">
  <div className="section-t">Aujourd’hui</div>
  <div className="card">
    <div className="spread">
      <div style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 23 }}>B1+</div>
      <span className="lvl">B1+</span>
    </div>
    <Ladder idx={5} />
    <div className="tiny" style={{ marginTop: 10 }}>Niveau estimé sur 12 paliers</div>
  </div>
  <div className="row" style={{ marginTop: 14 }}>
    <button className="btn primary big"><I.phone />Commencer l’appel</button>
  </div>
</main>
```
