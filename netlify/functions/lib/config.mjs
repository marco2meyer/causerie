/* Server-side config. This directory is bundled into functions only — it is never served to browsers.
   Everything lives ONLY in Netlify environment variables (Site configuration → Environment
   variables) — nothing is embedded in the code, so the auth gate FAILS CLOSED until
   ACCESS_CODE (or Google auth, or ALLOW_OPEN) is configured. */
export function cfg() {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    ACCESS_CODE: process.env.ACCESS_CODE || '',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS || '',
    ALLOW_OPEN: process.env.ALLOW_OPEN === 'true'
  };
}
