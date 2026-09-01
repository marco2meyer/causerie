import { getStore } from '@netlify/blobs';
import { authed } from './lib/auth.mjs';

/** Cross-device profile sync. One JSON blob per sync token; possession of the token
 *  (plus the site's access auth) grants access. Last write wins client-side. */

const TOKEN_RE = /^cz-[a-z0-9]{2,10}-[a-z0-9]{2,10}-[a-z0-9]{2,10}$/;

export default async (req) => {
  if (!(await authed(req))) return new Response('unauthorized', { status: 401 });
  let store;
  try {
    store = getStore('causerie-users');
  } catch (e) {
    return new Response('blobs unavailable: ' + e.message, { status: 501 });
  }

  // Token preferably in a header (never logged like URLs); query kept for old clients.
  const headerToken = req.headers.get('x-sync-token') || '';

  if (req.method === 'GET') {
    const t = headerToken || new URL(req.url).searchParams.get('t') || '';
    if (!TOKEN_RE.test(t)) return new Response('bad token', { status: 400 });
    const data = await store.get(t, { type: 'json' });
    if (!data) return new Response('not found', { status: 404 });
    return Response.json(data);
  }

  if (req.method === 'DELETE') {
    const t = headerToken || new URL(req.url).searchParams.get('t') || '';
    if (!TOKEN_RE.test(t)) return new Response('bad token', { status: 400 });
    await store.delete(t);
    return new Response(null, { status: 204 });
  }

  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
    const t = String(body.token || '');
    if (!TOKEN_RE.test(t)) return new Response('bad token', { status: 400 });
    const payload = JSON.stringify({ data: body.data, storedAt: new Date().toISOString() });
    // Netlify's synchronous function request limit is ~6 MB; years of transcripts fit
    // well below this (~10 KB per call). Shard by year via separate tokens if ever needed.
    if (payload.length > 5_500_000) return new Response('too large', { status: 413 });
    await store.set(t, payload);
    return new Response(null, { status: 204 });
  }

  return new Response('GET, PUT or DELETE', { status: 405 });
};
export const config = { path: '/api/user-data' };
