# What a call costs, and what a cheaper one gives up

The daily conversation is the expensive part of Causerie by a wide margin. This is what the
money is actually spent on, which alternatives exist in August 2026, and why the app now
ships a second engine behind a setting.

All figures are for the app's default **8-minute call**, assuming the student speaks about
3.2 minutes and Odile about 3.2 minutes across roughly twenty exchanges. Rates are the
published OpenAI list prices, short-context tier, checked 21 Aug 2026.

## Where the money goes today

The realtime engine hands the microphone straight to a speech-to-speech model. That is what
makes interruption and half-second answers possible, and it is expensive for two structural
reasons: the model's own speech is billed as **audio output at $64/M tokens** (≈ 1 200
tokens per minute of speech), and every turn re-sends the **whole conversation so far** as
input. Prompt caching softens the second problem — repeat audio bills at $0.40/M instead of
$32/M — but only if the cached prefix never changes, which is why `frozenSession` exists.

| Leg | Model | 8-min call |
|---|---|---|
| Conversation | gpt-realtime-2.1 | **$0.48 – 0.88** |
| Live captions | gpt-transcribe, $0.0045/min | $0.036 |
| Verbatim re-transcription | gpt-transcribe | $0.036 |
| Analysis | gpt-5.6-sol | $0.12 |
| **Total** | | **≈ $0.87** |

One call a day is roughly **$26/month**. Note that the same audio is paid for three times:
the realtime model ingests it, the caption transcriber transcribes it, and the verbatim pass
transcribes it again.

## The options

### 1. gpt-realtime-2.1-mini — already a setting

The cheapest change available, and it needs no code: **Settings → Modèle d'appel →
économique**. Audio bills at $10/$20 per M instead of $32/$64, so the conversation leg drops
to about **$0.16 – 0.40**, and the whole call to roughly **$0.47**.

What it costs: the mini model is measurably weaker at hearing a learner's mistake and
recasting it, which is the pedagogical core of the product. The settings note already says
so. It buys about 2× and gives up the thing the app exists for.

### 2. Turn by turn — the cascade (shipped, opt-in)

Take the call apart and pay the cheap rate for each piece: transcribe what the student said,
think in **text**, speak the answer with the same TTS voice the flashcards already use.

| Leg | Model | 8-min call |
|---|---|---|
| Transcription (student's turns only) | gpt-transcribe | $0.014 |
| Thinking | gpt-5.6-terra, cached briefing | $0.040 |
| Her voice | gpt-4o-mini-tts | $0.049 |
| Live captions | — *(the transcription already is one)* | $0 |
| Verbatim re-transcription | — *(so is this)* | $0 |
| Analysis | gpt-5.6-sol | $0.12 |
| **Total** | | **≈ $0.22** |

The conversation itself goes from ~$0.68 to ~$0.10 — about **7× cheaper**; the whole call
about **4×**, because the analysis does not move. One call a day is roughly **$6.60/month**.

**What it buys beyond the money.** The text model behind her follows the two-thousand-word
briefing considerably better than the speech-to-speech one does: the secret objectives, the
probe list, the word goals, the register calibration. On instruction-following this is an
upgrade, not a compromise.

**What it gives up.**

- *Interruption.* She finishes her sentence. There is a Passer button to cut her short, but
  it is a tap, not a voice.
- *Latency.* Roughly 1.5–2.5 s between the end of your turn and the first word of hers,
  against ~0.5 s today. Four things keep it there: the endpointing window is shorter than
  the realtime engine's (`TURN_SILENCE_MS` — 1.2 s at the most patient setting, against 2 s,
  because here it is dead air rather than a wait the model shares); the first chunk of her
  answer goes to the voice on a much lower character threshold than the rest, since it is
  the one you are sitting in silence for; her answer is streamed and cut into sentences, so
  the first is spoken while the rest is still being written; and every turn prints its own
  breakdown to the console (`transcribe … · think … · voice … → … to her first word`), so
  the next round of tuning can be aimed rather than guessed.
- *Her ears.* **She reads a transcript. She never hears your accent.** No pronunciation
  correction can survive this, and a mis-transcription can read as a learner error — the
  turn-mode briefing tells her to treat a strange-looking word as a bad transcript rather
  than a mistake, which mitigates it but does not remove it.

**What stays identical.** The same voice (`marin` by default — the speech endpoint takes the
realtime voice names), the same speech-rate ramp, the same persona text, the same briefing,
the same word goals and stage directions, the same transcript, the same analysis.

### 3. gpt-audio-mini via Chat Completions — the runner-up, not built

A middle path worth a later experiment: audio in, audio out, one request per turn, no
WebRTC, and the conversation history carried as **text** rather than as re-sent audio. At
$10/M audio in and $20/M audio out that is roughly **$0.11** of conversation — about the
same as the cascade — but she still *hears* the student, so pronunciation feedback survives.

Why not first: it swaps the cascade's biggest win (a strong text model holding the briefing)
for its biggest loss (hearing the accent), at the same price, and the pricing table lists no
cached input rate for these models, so a long call's growing text history bills at full rate
every turn. It is the natural second experiment, not the first.

### 4. Someone else's voice

gpt-4o-mini-tts costs about **$17 per million characters**. Cartesia Sonic is ~$50/M,
ElevenLabs Flash ~$60/M, Deepgram Aura-2 ~$30/M. Cartesia would cut time-to-first-audio from
~300 ms to ~40 ms, which is the single best latency win available — but it adds a vendor, a
key, a French voice that is not Odile's, and it costs three times as much. Not now.

### 5. Cheaper transcription

`gpt-4o-mini-transcribe` is $0.003/min against $0.0045. It saves half a cent per call and
risks the one thing the analysis cannot do without: a verbatim record of the mistakes. No.

The browser's own `SpeechRecognition` is free and silently *corrects* learner errors, which
is precisely backwards for this app. No.

## The other lever

In turn-by-turn mode the **analysis becomes the largest single line on the bill** — $0.12 of
$0.22, over half. Moving `analysisModel` from `gpt-5.6-sol` to `gpt-5.6-terra` costs some
depth in the report and takes the analysis to ~$0.048, and the whole call to **~$0.15** —
about **6× cheaper than today**. That is a separate experiment from the engine, and the
setting is already there.

## Trying it

**Settings → Voix & appel → Moteur d'appel → tour par tour.** The default is unchanged.

Two knobs come with it:

- **Fin de ton tour** — *au silence* (the endpointing ends your turn after a pause) or
  *au bouton* (only your tap ends it). Silence is the default; the button is there for a
  loud room. **Patience d'écoute is the lag knob here**: *petite* gets her answer back
  almost a second sooner, *grande* leaves room to hunt for a word.
- **Réglages → Modèles → Modèle tour par tour** — `gpt-5.6-terra` by default. `luna` is
  eight times cheaper on that leg and saves about four cents a call, which is not where the
  money is; `sol` is the one to try if she feels slow-witted rather than slow.

The cost panel at the foot of every Auswertung breaks the call down leg by leg, so the two
engines can be compared on real calls rather than on this table.

## Correction to the price table (21 Aug 2026)

While checking these numbers, the three `gpt-5.6` rows in the price tables
(`src/lib/costs.ts`, `netlify/functions/lib/supauth.mjs`,
`netlify/edge-functions/lib/supedge.mjs`) turned out to carry **exactly half** the published
rate. Every analysis leg on every call has been reading at half its real cost. Fixed, and
`tests/unit/calcost.test.ts` now pins the published rates so the next drift fails a test
instead of quietly discounting the bill.
