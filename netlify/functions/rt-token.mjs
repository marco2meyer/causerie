import { resolveKey } from './lib/supauth.mjs';

const RT_ALLOW = ['gpt-realtime-2.1', 'gpt-realtime', 'gpt-realtime-2', 'gpt-realtime-1.5', 'gpt-realtime-2.1-mini', 'gpt-realtime-mini'];

export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const k = await resolveKey(req);
  if (k.error) return new Response(k.error, { status: k.status });
  let body = {};
  try { body = await req.json(); } catch {}
  if (body.probe) return new Response(null, { status: 204 });
  const session = body.session || {};
  session.type = 'realtime';
  if (!RT_ALLOW.includes(session.model)) session.model = 'gpt-realtime-2.1';
  if (typeof session.instructions === 'string' && session.instructions.length > 16000)
    session.instructions = session.instructions.slice(0, 16000);
  const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + k.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: 600 }, session })
  });
  const text = await r.text();
  if (!r.ok) return new Response('openai: ' + text.slice(0, 400), { status: 502 });
  let j = {};
  try { j = JSON.parse(text); } catch {}
  return Response.json({ value: j.value, expires_at: j.expires_at, model: session.model, key_source: k.source });
};
export const config = { path: '/api/rt-token' };
