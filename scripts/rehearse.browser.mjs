/* The rehearsal, run from inside the app instead of from a terminal.
 *
 * scripts/rehearse.mjs needs an OpenAI key. This one needs none: pasted into the console of
 * the signed-in app (or evaluated there by a tool), it mints a short-lived realtime secret
 * through the site's own /api/rt-token, speaks the student's lines through /api/tts, and
 * talks to the voice model directly from the page. The key stays where it always was —
 * server-side — and nothing secret passes through a terminal, a file or a transcript.
 *
 *   await __rehearse.run({ label, instructions, greeting, lines })   // one call
 *   __rehearse.state                                                  // progress, turns
 *
 * `instructions` and `greeting` come from `node scripts/rehearse.mjs --dry`, which builds
 * the real briefing for either variant without spending anything. Scoring stays in
 * scripts/rehearse.mjs (--score), so both paths are judged by the same rules.
 */
(() => {
  const TTS_VOICE = 'ash';
  const TTS_STYLE = 'Parle français avec un accent allemand net, à voix un peu hésitante, comme un élève de niveau A2 qui cherche parfois ses mots. Débit lent.';
  const RATE = 24000;                    // what the realtime input wants: 24 kHz mono PCM16

  const auth = () => {
    const s = JSON.parse(localStorage.getItem('causerie.supa') || '{}');
    return { 'content-type': 'application/json', authorization: 'Bearer ' + s.access_token };
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /** One line of the student, as 24 kHz mono PCM16: the site returns mp3, the page decodes
   *  and resamples it. A learner's pace and accent are asked for in the TTS instructions. */
  async function speak(text) {
    const r = await fetch('/api/tts', {
      method: 'POST', headers: auth(),
      body: JSON.stringify({ text, voice: TTS_VOICE, instructions: TTS_STYLE, speed: 0.95, lang: 'French' })
    });
    if (!r.ok) throw new Error('tts ' + r.status + ' ' + (await r.text()).slice(0, 120));
    const mp3 = await r.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(mp3.slice(0));
    void ctx.close();
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const out = (await off.startRendering()).getChannelData(0);
    const pcm = new Int16Array(out.length);
    for (let i = 0; i < out.length; i++) {
      const s = Math.max(-1, Math.min(1, out[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(pcm.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  /** A realtime secret from the site (ten minutes, minted against the server's own key). */
  async function ephemeral(model) {
    const r = await fetch('/api/rt-token', { method: 'POST', headers: auth(), body: JSON.stringify({ session: { model } }) });
    if (!r.ok) throw new Error('rt-token ' + r.status + ' ' + (await r.text()).slice(0, 120));
    return (await r.json()).value;
  }

  const state = { label: null, status: 'idle', turns: [], errors: [], usage: {}, line: 0, of: 0 };

  async function run({ label, instructions, greeting, lines, model = 'gpt-realtime-2.1', voice = 'marin' }) {
    Object.assign(state, { label, status: 'connecting', turns: [], errors: [], usage: { input: 0, output: 0, audio_in: 0, audio_out: 0 }, line: 0, of: lines.length });
    const secret = await ephemeral(model);
    const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=' + encodeURIComponent(model),
      ['realtime', 'openai-insecure-api-key.' + secret, 'openai-beta.realtime-v1']);
    const send = o => ws.send(JSON.stringify(o));
    let transcript = '';
    let waiting = null;
    let ended = false;

    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('socket failed')), { once: true });
    });
    ws.addEventListener('message', ev => {
      let e; try { e = JSON.parse(ev.data); } catch { return; }
      if (e.type === 'error') { state.errors.push((e.error && (e.error.message || e.error.code)) || 'error'); return; }
      if (typeof e.type === 'string' && e.type.endsWith('audio_transcript.delta') && typeof e.delta === 'string') transcript += e.delta;
      if (e.type === 'response.done') {
        const r = e.response || {};
        const out = Array.isArray(r.output) ? r.output : [];
        const said = transcript.trim() || out.flatMap(i => (i.content || []).map(c => c.transcript || c.text || '')).join(' ').trim();
        if (out.some(i => i.type === 'function_call' && i.name === 'end_call')) ended = true;
        const u = r.usage || {};
        state.usage.input += u.input_tokens || 0;
        state.usage.output += u.output_tokens || 0;
        state.usage.audio_in += (u.input_token_details && u.input_token_details.audio_tokens) || 0;
        state.usage.audio_out += (u.output_token_details && u.output_token_details.audio_tokens) || 0;
        transcript = '';
        state.turns.push({ role: 'assistant', text: said });
        const w = waiting; waiting = null; if (w) w();
      }
    });

    const herTurn = (ms = 60000) => Promise.race([new Promise(r => { waiting = r; }), sleep(ms)]);

    state.status = 'briefing';
    send({
      type: 'session.update',
      session: {
        type: 'realtime', output_modalities: ['audio'], instructions,
        tools: [{ type: 'function', name: 'end_call', description: 'Hang up the call. Use ONLY after the goodbyes have been exchanged.', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } }],
        tool_choice: 'auto',
        audio: { input: { format: { type: 'audio/pcm', rate: RATE }, turn_detection: null }, output: { voice, speed: 0.95 } }
      }
    });
    await sleep(400);

    state.status = 'greeting';
    send({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: greeting }] } });
    send({ type: 'response.create' });
    await herTurn();

    for (const line of lines) {
      state.status = 'speaking'; state.line++;
      const audio = await speak(line.text);
      for (let i = 0; i < audio.length; i += 40000) send({ type: 'input_audio_buffer.append', audio: audio.slice(i, i + 40000) });
      send({ type: 'input_audio_buffer.commit' });
      send({ type: 'response.create' });
      state.turns.push({ role: 'user', text: line.text, expect: line.expect || null });
      state.status = 'listening';
      await herTurn();
      if (ended) { if (!line.goodbye) state.errors.push('hung up mid-conversation'); break; }
    }
    ws.close();
    state.status = 'done';
    return state;
  }

  window.__rehearse = { run, state, get status() { return state.status + ' ' + state.line + '/' + state.of; } };
  return '__rehearse ready';
})();
