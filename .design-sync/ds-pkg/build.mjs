// Builds the Causerie DS package dist consumed by design-sync's converter.
//
//   dist/ds.js            ESM bundle, react/react-dom external (→ window.React)
//   dist/types/**         declaration tree, entry at dist/types/.design-sync/ds-pkg/index.d.ts
//
// Preact is aliased to React: the hooks the components use (useState/useEffect/
// useRef/useMemo) are API-identical, and ./jsx-shim.js normalizes the two Preact
// JSX idioms React rejects (`class`, string `style`). Component source is untouched.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');

const preactToReact = {
  name: 'preact-to-react',
  setup(b) {
    b.onResolve({ filter: /^preact\/jsx-(dev-)?runtime$/ }, () => ({ path: resolve(HERE, 'jsx-shim.js') }));
    b.onResolve({ filter: /^preact\/hooks$/ }, () => ({ path: 'react', external: true }));
    b.onResolve({ filter: /^preact\/compat$/ }, () => ({ path: 'react', external: true }));
    b.onResolve({ filter: /^preact$/ }, () => ({ path: 'react', external: true }));
  },
};

await build({
  entryPoints: [resolve(HERE, 'index.tsx')],
  outfile: resolve(HERE, 'dist/ds.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2021',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
  plugins: [preactToReact],
  absWorkingDir: REPO,
  logLevel: 'info',
});

// The DS stylesheet is the app's own src/styles/global.css. cfg.cssEntry is bounded
// to the package dir, so it is copied in on every build — regenerated, never edited,
// so it cannot drift from the source.
mkdirSync(resolve(HERE, 'dist'), { recursive: true });
copyFileSync(resolve(REPO, 'src/styles/global.css'), resolve(HERE, 'dist/styles.css'));

// The token font stacks name the variable families first and the plain names as
// fallbacks: --body is `"Inter Variable","Inter",…`. @fontsource ships @font-face for
// the "… Variable" names only, so a design that asks for plain `Inter` would fall
// through to a system face. Re-declare the same woff2 files under the bare names —
// same fonts, no substitutes. url()s are rewritten relative to dist/.
{
  const alias = [];
  for (const [pkg, family] of [['inter', 'Inter'], ['space-grotesk', 'Space Grotesk']]) {
    const css = readFileSync(resolve(REPO, `node_modules/@fontsource-variable/${pkg}/index.css`), 'utf8');
    alias.push(
      css
        .replace(new RegExp(`'${family} Variable'`, 'g'), `'${family}'`)
        .replace(/url\(\.\/files\//g, `url(../../../node_modules/@fontsource-variable/${pkg}/files/`),
    );
  }
  writeFileSync(resolve(HERE, 'dist/fonts-alias.css'), alias.join('\n'));
}

execFileSync(
  resolve(REPO, 'node_modules/.bin/tsc'),
  ['-p', resolve(HERE, 'tsconfig.json')],
  { stdio: 'inherit', cwd: REPO },
);
console.error('» dist/ds.js + dist/types written');
