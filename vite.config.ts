import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

/** Build stamp: written into the bundle AND emitted as /build.txt, so a running client
 *  can tell whether it is the deployed one. An installed web app on iOS can hold a
 *  bundle for days, and every fix then looks like it never shipped. */
const BUILD_ID = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

export default defineConfig({
  plugins: [
    preact(),
    {
      name: 'causerie-build-stamp',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'build.txt', source: BUILD_ID });
      }
    }
  ],
  define: { __BUILD__: JSON.stringify(BUILD_ID) },
  build: { target: 'es2020', sourcemap: true },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts']
  }
});
