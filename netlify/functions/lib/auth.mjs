import { timingSafeEqual } from 'node:crypto';
import { cfg } from './config.mjs';

export async function authed(req) {
  const c = cfg();
  if (c.GOOGLE_CLIENT_ID) {
    const tok = req.headers.get('x-google-token') || '';
    if (!tok) return false;
    try {
      const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tok));
      if (!r.ok) return false;
      const j = await r.json();
      if (j.aud !== c.GOOGLE_CLIENT_ID) return false;
      if (String(j.email_verified) !== 'true') return false;
      const allowed = c.ALLOWED_EMAILS.toLowerCase().split(/[,\s]+/).filter(Boolean);
      if (allowed.length && !allowed.includes((j.email || '').toLowerCase())) return false;
      return true;
    } catch { return false; }
  }
  if (c.ALLOW_OPEN) return true;
  if (c.ACCESS_CODE) {
    const given = Buffer.from(req.headers.get('x-access-code') || '');
    const want = Buffer.from(c.ACCESS_CODE);
    return given.length === want.length && timingSafeEqual(given, want);
  }
  return false;
}
