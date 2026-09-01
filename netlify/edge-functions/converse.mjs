import { recordCost, resolveKey } from './lib/supedge.mjs';

/* Odile's thinking, one turn at a time — the text leg of the turn-by-turn call engine
   (src/lib/turncall.ts). An EDGE function for the same reason the analysis proxy is one:
   the reply is STREAMED so the first sentence can reach the speech endpoint while the rest
   is still being written, and a buffered serverless function would hold the whole answer
   back and add a second of silence to every turn.

   Kept apart from /api/analyze on purpose: different model allowlist, different ledger
   kind, and a call's conversation should never be filed under 'analysis'. */

const TURN_ALLOW = ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.4-mini', 'gpt-4o-mini'];
const DEFAULT_MODEL = 'gpt-5.6-terra';

export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const k = await resolveKey(req);
  if (k.error) return new Response(k.error, { status: k.status });
  let body;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const model = TURN_ALLOW.includes(body.model) ? body.model : DEFAULT_MODEL;
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || JSON.stringify(messages).length > 400000) return new Response('bad messages', { status: 400 });
  const payload = { model, messages };
  if (['minimal', 'low', 'medium', 'high'].includes(body.reasoning_effort)) payload.reasoning_effort = body.reasoning_effort;
  const cap = Number(body.max_completion_tokens);
  if (Number.isFinite(cap) && cap > 0) payload.max_completion_tokens = Math.min(2000, Math.round(cap));
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
    kind: 'chat', model, key_source: k.source, session_id: body.session_id || null,
    input_tokens: usage.prompt_tokens || 0, output_tokens: usage.completion_tokens || 0,
    // The briefing is the same two thousand tokens on every turn of a call; without the
    // cached split the ledger would read list price for a prefix billed at a tenth of it.
    cached_input_tokens: usage.prompt_tokens_details?.cached_tokens || 0,
    seconds: Math.round((Date.now() - t0) / 1000)
  });

  const streamed = wantStream && r.ok && r.body && (r.headers.get('content-type') || '').includes('text/event-stream');
  if (!streamed) {
    const text = await r.text();
    if (r.ok) { try { await ledger(JSON.parse(text)?.usage); } catch { /* best-effort */ } }
    return new Response(text, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json' } });
  }

  // Pipe the SSE through untouched; the usage event rides at the tail.
  const dec = new TextDecoder();
  let tail = '';
  const tee = new TransformStream({
    transform(chunk, ctrl) {
      ctrl.enqueue(chunk);
      tail += dec.decode(chunk, { stream: true });
      if (tail.length > 40000) tail = tail.slice(-20000);
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

export const config = { path: '/api/converse' };
