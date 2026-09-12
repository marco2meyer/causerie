#!/usr/bin/env node
/* Prove that the tree still publishes clean without its private extensions.
 *
 * The public repository is a snapshot of this one minus the paths in .publicexclude. Two
 * things can go wrong with that, and both are invisible from inside the full tree: a public
 * file grows an import into a private path (the public tree then fails to build), or a
 * private string ends up in the public bundle through a shared file or a build-time env
 * value. This copies the tree to a temporary directory with the excluded paths removed and
 * the personal build variables blanked, type-checks, tests and builds it there, and then
 * greps the built assets for the strings listed in .publicforbidden (a private file; see
 * below) and in PUBLIC_FORBIDDEN.
 *
 *   node scripts/check-public-bundle.mjs               full run (tsc, vitest, vite build, grep)
 *   node scripts/check-public-bundle.mjs --skip-tests  faster: no vitest
 *   node scripts/check-public-bundle.mjs --keep        leave the temporary copy for a look
 *
 * Exit 1 with the reason on any failure. scripts/publish-public.sh runs this before it
 * removes anything or commits, so a red result here is what keeps a leak out of the public
 * history.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));

/** Strings that must not appear in a public build, case-sensitive, matched raw against the
 *  minified JS. They come from .publicforbidden — one per line, `#` comments, and a line
 *  `$NAME` meaning the value of that environment variable (skipped when unset) — plus the
 *  comma-separated PUBLIC_FORBIDDEN variable. The file names what it hunts, so it is private
 *  itself and listed in .publicexclude; it is read from the full tree, before the copy. */
export function parseForbidden(text, env = process.env) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('$')) { if (env[line.slice(1)]) out.push(env[line.slice(1)]); continue; }
    out.push(line);
  }
  return out;
}
function forbiddenStrings() {
  const file = join(root, '.publicforbidden');
  const fromFile = existsSync(file) ? parseForbidden(readFileSync(file, 'utf8')) : null;
  const fromEnv = (process.env.PUBLIC_FORBIDDEN || '').split(',').map(s => s.trim()).filter(Boolean);
  return { list: [...new Set([...(fromFile || []), ...fromEnv])], fileFound: fromFile !== null };
}

/** Never copied: build products, the dependency tree (symlinked instead), and anything
 *  holding local values. `.env.example` is the one env file that belongs in the repo. */
const SKIP_TOP = new Set(['node_modules', 'dist', 'dist-single', '.git', '.netlify', '.design-sync', '.ds-sync', 'ds-bundle', '_to_delete']);
const skipTop = (name) => SKIP_TOP.has(name) || (/^\.env(\..*)?$/.test(name) && name !== '.env.example');

// Thrown rather than exiting on the spot, so the temporary copy is always cleaned up.
class CheckFailed extends Error {}
const die = (msg) => { throw new CheckFailed(msg); };

/** .publicexclude: one path per line, comments and blanks dropped, trailing slash removed. */
export function parseManifest(text) {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.replace(/\/+$/, ''));
}

/** A manifest pattern as a regex over repo-relative paths: `**` spans segments, `*` and `?`
 *  stay inside one, and a match covers the path itself and everything under it. */
export function patternRe(pattern) {
  const src = pattern.split('**').map(part =>
    part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
  ).join('.*');
  return new RegExp('^' + src + '(/.*)?$');
}

/** Every file and directory under dir, repo-relative, not descending into node_modules. */
function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    out.push(relative(base, p));
    if (lstatSync(p).isDirectory()) walk(p, base, out);
  }
  return out;
}

function run(label, cmd, cmdArgs, cwd, env) {
  process.stdout.write('· ' + label + ' … ');
  const t0 = Date.now();
  try {
    execFileSync(cmd, cmdArgs, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    console.log('ok (' + Math.round((Date.now() - t0) / 1000) + 's)');
  } catch (e) {
    console.log('FAILED');
    const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    console.error(out.trim().split('\n').slice(-60).join('\n'));
    die(label + ' failed in the public copy at ' + cwd);
  }
}

function main() {
  const manifestPath = join(root, '.publicexclude');
  if (!existsSync(manifestPath)) die('.publicexclude is missing');
  const patterns = parseManifest(readFileSync(manifestPath, 'utf8'));
  if (!patterns.length) die('.publicexclude lists nothing');

  const tmp = mkdtempSync(join(tmpdir(), 'causerie-public-'));
  console.log('public copy: ' + tmp);
  let ok = false;
  try {
    // 1. Copy the tree, minus what never belongs in a snapshot; borrow node_modules.
    for (const name of readdirSync(root)) {
      if (skipTop(name)) continue;
      execFileSync('cp', ['-R', join(root, name), join(tmp, name)]);
    }
    symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'), 'dir');

    // 2. Remove the private paths, exactly as publish-public.sh does.
    const present = walk(tmp);
    const removed = [];
    for (const pattern of patterns) {
      const re = patternRe(pattern);
      for (const rel of present) {
        if (!re.test(rel)) continue;
        const p = join(tmp, rel);
        if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); removed.push(rel); }
      }
    }
    // Only the top of each removed subtree is worth a line.
    const tops = removed.filter(r => !removed.some(o => o !== r && r.startsWith(o + '/')));
    console.log('removed ' + tops.length + ' private path(s)' + (tops.length ? ': ' + tops.join(', ') : ''));

    // 3. The public build has no personal values: blank them the way the deploy does.
    const env = { ...process.env, VITE_ADMIN_EMAILS: '', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' };
    const bin = (name) => join(tmp, 'node_modules', '.bin', name);
    run('tsc --noEmit', bin('tsc'), ['--noEmit'], tmp, env);
    if (!args.has('--skip-tests')) run('vitest run', bin('vitest'), ['run'], tmp, env);
    run('vite build', bin('vite'), ['build'], tmp, env);

    // 4. Grep the assets.
    const assets = join(tmp, 'dist', 'assets');
    const files = existsSync(assets) ? readdirSync(assets).filter(f => f.endsWith('.js')) : [];
    if (!files.length) die('the build produced no dist/assets/*.js');
    const { list: forbidden, fileFound } = forbiddenStrings();
    if (!forbidden.length) {
      console.log('! no forbidden strings to grep for' + (fileFound ? '' : ' (.publicforbidden not found; PUBLIC_FORBIDDEN unset)'));
    }
    const hits = [];
    for (const f of files) {
      const js = readFileSync(join(assets, f), 'utf8');
      for (const s of forbidden) {
        const i = js.indexOf(s);
        if (i >= 0) hits.push({ f, s, ctx: js.slice(Math.max(0, i - 40), i + s.length + 40).replace(/\s+/g, ' ') });
      }
    }
    if (hits.length) {
      for (const h of hits) console.error('  ' + h.f + ' contains "' + h.s + '": …' + h.ctx + '…');
      die(hits.length + ' forbidden string(s) in the public bundle');
    }
    if (forbidden.length) console.log('bundle clean: ' + files.join(', ') + ' carry none of ' + forbidden.length + ' forbidden strings');
    ok = true;
  } finally {
    if (args.has('--keep')) console.log('kept ' + tmp);
    else rmSync(tmp, { recursive: true, force: true });
  }
  if (ok) console.log('✓ public tree type-checks, ' + (args.has('--skip-tests') ? '' : 'tests, ') + 'builds and leaks nothing');
}

// Run only as a command; the manifest helpers above are also imported by a unit test.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    if (!(e instanceof CheckFailed)) throw e;
    console.error('\n✗ ' + e.message);
    process.exit(1);
  }
}
