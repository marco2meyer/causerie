import { recordCost, resolveKey } from './lib/supedge.mjs';

/* Card-image generation (Fluent-Forever memory hooks). Edge, not Lambda: gpt-image-2
   takes ~15-35s, which brushes the buffered-function kill window. The ~1 MB base64
   response passes straight through; the client downscales before storing. */

const IMG_PRICE_PER_M = { 'gpt-image-2': 40, 'gpt-image-1-mini': 8 }; // $ per 1M output image tokens

export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const k = await resolveKey(req);
  if (k.error) return new Response(k.error, { status: k.status });
  let body;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const NO_TEXT = ' — no text, no letters, no numbers, no captions, no watermarks anywhere in the image.';
  let prompt = String(body.prompt || '').trim().slice(0, 700);
  if (!prompt) return new Response('empty prompt', { status: 400 });
  if (!prompt.toLowerCase().includes('no text')) prompt += NO_TEXT; // belt and braces, whatever the client sent
  const model = Object.hasOwn(IMG_PRICE_PER_M, body.model ?? '') ? body.model : 'gpt-image-1-mini';

  const t0 = Date.now();
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + k.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: '1024x1024', quality: 'low', output_format: 'webp' })
  });
  if (!r.ok) return new Response('openai: ' + (await r.text()).slice(0, 300), { status: 502 });
  const j = await r.json();
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) return new Response('no image', { status: 502 });

  const outTok = j.usage?.output_tokens || 0;
  await recordCost(k.user, {
    kind: 'image', model, key_source: k.source, session_id: body.session_id || null,
    output_tokens: outTok,
    cost_usd: Math.round(outTok / 1e6 * IMG_PRICE_PER_M[model] * 1e5) / 1e5,
    seconds: Math.round((Date.now() - t0) / 1000)
  });
  return Response.json({ img: 'data:image/webp;base64,' + b64 });
};

export const config = { path: '/api/image' };
