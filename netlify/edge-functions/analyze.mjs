import { recordCost, resolveKey } from './lib/supedge.mjs';

/* Post-call analysis proxy — an EDGE function on purpose: the model needs ~30-60s to
   write the full report, and buffered serverless functions are killed at ~30s (measured),
   which silently pushed every real call down the model-fallback chain. The edge runtime
   streams the OpenAI SSE body through as bytes arrive, so wall time is no longer capped
   by the function runtime; the usage chunk at the tail feeds the cost ledger. */

const AN_ALLOW = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-4o-mini'];

export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const k = await resolveKey(req);
  if (k.error) return new Response(k.error, { status: k.status });
  let body;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const model = AN_ALLOW.includes(body.model) ? body.model : 'gpt-5.6-sol';
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || JSON.stringify(messages).length > 400000) return new Response('bad messages', { status: 400 });
  const payload = { model, messages };
  if (body.response_format) payload.response_format = body.response_format;
  if (['minimal', 'low', 'medium', 'high'].includes(body.reasoning_effort)) payload.reasoning_effort = body.reasoning_effort;
  const wantStream = body.stream === true;
  if (wantStream) {
    payload.stream = true;
    payload.stream_options = { include_usage: true };
  }
  const t0 = Date.now();
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + k.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const ledger = (usage) => !usage ? Promise.resolve() : recordCost(k.user, {
    kind: 'analysis', model, key_source: k.source, session_id: body.session_id || null,
    input_tokens: usage.prompt_tokens || 0, output_tokens: usage.completion_tokens || 0,
    // Repeat prefixes across a session bill at the cached rate; without this the analysis
    // rows read list price rather than the actual charge.
    cached_input_tokens: usage.prompt_tokens_details?.cached_tokens || 0,
    seconds: Math.round((Date.now() - t0) / 1000)
  });

  const streamed = wantStream && r.ok && r.body && (r.headers.get('content-type') || '').includes('text/event-stream');
  if (!streamed) {
    const text = await r.text();
    if (r.ok) { try { await ledger(JSON.parse(text)?.usage); } catch { /* best-effort */ } }
    return new Response(text, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json' } });
  }

  // Pipe the SSE through untouched; scan the tail for the final usage event at the end.
  const dec = new TextDecoder();
  let tail = '';
  const tee = new TransformStream({
    transform(chunk, ctrl) {
      ctrl.enqueue(chunk);
      tail += dec.decode(chunk, { stream: true });
      if (tail.length > 100000) tail = tail.slice(-50000);
    },
    async flush() {
      let usage = null;
      for (const line of tail.split('\n').reverse()) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          if (j.usage) { usage = j.usage; break; }
        } catch { /* split or malformed line */ }
      }
      await ledger(usage);
    }
  });
  return new Response(r.body.pipeThrough(tee), {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }
  });
};

export const config = { path: '/api/analyze' };
