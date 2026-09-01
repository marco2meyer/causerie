export {};

declare global {
  /** Build stamp injected by vite at build time (see vite.config.ts). */
  const __BUILD__: string;

  /** Vite's env surface, without pulling in all of vite/client. Only VITE_-prefixed
   *  variables exist in the browser bundle. */
  interface ImportMeta {
    readonly env?: Record<string, string | undefined>;
  }

  interface Window {
    /** Test/debug hook: override the OpenAI base URL (used by the e2e relay). */
    CAUSERIE_OAI?: string;
    /** Test hook: HTTP status of the last realtime SDP exchange. */
    __sdpStatus?: number;
    /** Debug/test API exposed by main.tsx. */
    causerie?: Record<string, unknown>;
    /** Google Identity Services, loaded on demand. */
    google?: any;
    webkitAudioContext?: typeof AudioContext;
  }
}
