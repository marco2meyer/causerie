// Secondary build flavor: everything inlined into one HTML file (dist-single/index.html).
// Useful as a portable copy that runs from disk in browser-key mode. The primary build is vite.config.ts.
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  // No /build.txt to fetch from a file:// copy, so the update check stays inert here.
  define: { __BUILD__: JSON.stringify('single') },
  build: { target: 'es2020', outDir: 'dist-single' }
});
