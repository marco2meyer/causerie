// Preact→React JSX bridge for the design-sync bundle.
//
// The Causerie source is Preact (tsconfig jsxImportSource: "preact") and uses two
// idioms React rejects: the `class` attribute and string-valued `style`. The
// components themselves are shipped untouched — this shim sits at the JSX factory
// and normalizes those two props on the way to react/jsx-runtime, so the real
// components render as true React elements in the claude.ai/design runtime.
import { jsx as rjsx, jsxs as rjsxs, Fragment } from 'react/jsx-runtime';

export { Fragment };

const cache = new Map();

// SVG presentation attributes the Preact source writes hyphenated. React knows them
// only in camelCase and warns ("Invalid DOM property") otherwise. `aria-*`/`data-*`
// stay hyphenated — React wants those exactly as written.
const SVG_ATTR = {
  'clip-path': 'clipPath',
  'clip-rule': 'clipRule',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-opacity': 'strokeOpacity',
  'stroke-width': 'strokeWidth',
  'text-anchor': 'textAnchor',
  'dominant-baseline': 'dominantBaseline',
  'vector-effect': 'vectorEffect',
};

// "margin-top:8px;color:var(--red)" → { marginTop: "8px", color: "var(--red)" }
// Custom properties keep their literal `--name` key (React passes those through).
function parseStyle(s) {
  const hit = cache.get(s);
  if (hit) return hit;
  const out = {};
  for (const decl of s.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop || !val) continue;
    out[prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
  }
  cache.set(s, out);
  return out;
}

function needsWork(props) {
  for (const k in props) {
    if (k === 'class' || k === 'for' || SVG_ATTR[k]) return true;
    if (k === 'style' && typeof props[k] === 'string') return true;
  }
  return false;
}

function normalize(props) {
  if (!props || !needsWork(props)) return props;
  const out = {};
  for (const k in props) {
    if (k === 'class') { if (!('className' in props)) out.className = props[k]; continue; }
    if (k === 'for') { if (!('htmlFor' in props)) out.htmlFor = props[k]; continue; }
    if (k === 'style' && typeof props[k] === 'string') { out.style = parseStyle(props[k]); continue; }
    const svg = SVG_ATTR[k];
    if (svg) { if (!(svg in props)) out[svg] = props[k]; continue; }
    out[k] = props[k];
  }
  return out;
}

export function jsx(type, props, key) {
  return rjsx(type, normalize(props), key);
}
export function jsxs(type, props, key) {
  return rjsxs(type, normalize(props), key);
}
export const jsxDEV = (type, props, key) => rjsx(type, normalize(props), key);
