// Shared preview scaffolding. Not a component preview — imported by the
// <Name>.tsx files next to it.
//
// Causerie is a dark design system (`color-scheme: dark`, `--bg0:#0A0A13`): the
// preview card frame paints itself white, so every cell sits on the DS's own
// ground here. Tokens come from styles.css, which the card already links.
import type { ReactNode } from 'react';

export function Surface({ children, pad = 20, width }: { children: ReactNode; pad?: number; width?: number | string }) {
  return (
    <div
      style={{
        background: 'var(--bg0)',
        color: 'var(--ink)',
        fontFamily: 'var(--body)',
        padding: pad,
        borderRadius: 'var(--r)',
        width: width ?? 'auto',
        maxWidth: '100%',
      }}
    >
      {children}
    </div>
  );
}

/** Small uppercase caption in the DS's display face — used to label a swept axis. */
export function Cap({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink3)', fontWeight: 600, fontFamily: 'var(--disp)' }}>
      {children}
    </div>
  );
}

/** Stage for the overlay components (`.toast`, `.sheetveil`, `.tuto-veil` are all
 *  `position: fixed`). A `transform` on this box makes it the containing block for
 *  fixed descendants, so the overlay lands inside the card instead of escaping to
 *  the viewport. Size it to the space the overlay needs. */
export function Overlay({ children, width = 560, height = 420 }: { children: ReactNode; width?: number; height?: number }) {
  return (
    <div
      style={{
        position: 'relative',
        transform: 'translateZ(0)',
        width,
        height,
        overflow: 'hidden',
        borderRadius: 'var(--r)',
        background: 'var(--bg0)',
        color: 'var(--ink)',
        fontFamily: 'var(--body)',
      }}
    >
      {children}
    </div>
  );
}
