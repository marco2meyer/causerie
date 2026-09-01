import { cfg } from './lib/config.mjs';
import { supaEnabled, SUPA_URL, SUPA_KEY } from './lib/supauth.mjs';

export default async () => {
  const c = cfg();
  const auth = supaEnabled() ? 'supabase' : (c.GOOGLE_CLIENT_ID ? 'google' : (c.ALLOW_OPEN ? 'open' : (c.ACCESS_CODE ? 'code' : 'unconfigured')));
  return Response.json({
    ok: true, auth,
    googleClientId: c.GOOGLE_CLIENT_ID || null,
    keyConfigured: !!c.OPENAI_API_KEY,
    supabaseUrl: supaEnabled() ? SUPA_URL : null,
    supabaseKey: supaEnabled() ? SUPA_KEY : null
  });
};
export const config = { path: '/api/health' };
