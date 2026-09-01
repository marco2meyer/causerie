import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Read off the disk rather than imported: vitest stubs CSS imports to an empty string, and
// `?raw` does not survive that, so an import here would assert against nothing at all.
const css = readFileSync(fileURLToPath(new URL('../../src/styles/global.css', import.meta.url)), 'utf8');

/* The call screen is the one place in the app that paints itself cream on blue
 * (`.stage.call{color:var(--cream)}`). Anything laid over it that brings its own light
 * background must bring its own text colour too, or it inherits the field's — which is
 * how the grammar cheat sheet came to render cream on cream. The sheet was on screen the
 * whole time, in the one colour that made it invisible, and it looked like the sheets
 * "weren't showing up".
 *
 * These are the surfaces that can appear over the call field. Every one of them has to
 * state both halves. */

/** The declaration block of a top-level rule, by exact selector. */
function ruleBody(selector: string): string {
  const re = new RegExp('(^|[\\n};])\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^{}]*)\\}');
  const m = re.exec(css);
  expect(m, `no rule for ${selector}`).not.toBeNull();
  return m![2];
}

describe('surfaces that can sit on the call screen', () => {
  // .card is the sheet's inner panels, .sheetcard the overlay itself, .sheet its
  // full-screen cousin.
  for (const sel of ['.card', '.sheetcard', '.sheet']) {
    it(`${sel} states its own text colour, not just its background`, () => {
      const body = ruleBody(sel);
      expect(body, `${sel} sets no background`).toMatch(/background:/);
      expect(body, `${sel} sets a background but inherits its text colour`).toMatch(/(^|;)\s*color:/);
    });
  }

  it('the call screen really does repaint the text, which is what makes this bite', () => {
    expect(ruleBody('.stage.call')).toMatch(/color:\s*var\(--cream\)/);
  });
});
