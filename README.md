# Causerie

Learn a language by actually speaking it, five minutes a day.

Causerie is a voice conversation tutor built around one daily loop: a short 3–5 minute
call with Odile (deadpan, red beret) on a topic she proposes and you can change
mid-greeting, then two short spaced-repetition sessions (18 cards each).
The cards come from your own conversations: your corrected mistakes become cloze
exercises, new words become bidirectional vocab cards with the sentence you actually
heard, all with French TTS audio. Once or twice a call a word you own only passively
appears on screen to be placed in the conversation, and Odile builds an
opening for it without ever saying it. She corrects by recasting mid-conversation, never
by lecturing. How many cards a conversation may leave behind is not a fixed cap but a
budget sized against how many reviews the day actually gets through, throttled by the pile
that has not been started yet — so the two halves of the day stay the same size. Everything she learns — strengths, weaknesses, interests, personal facts you
reveal, per-skill CEFR levels — lands in an inspectable, editable memory; open weaknesses
become quiet focus targets for the next call, and SM-2 scheduling decides when each card
returns. New profiles start with three getting-to-know-you calls that establish level and
gaps; multiple local profiles per device, with optional
token-based cross-device sync. Access works either with the access code (OpenAI key stays
in Netlify secrets) or with your own key pasted once into the browser.

Built by [Marco Meyer](https://marcomeyer.net) for his own French, and written almost
entirely in collaboration with [Claude](https://claude.com/claude-code).

**Try it now: https://causerie-public.netlify.app** — bring your own OpenAI key; it is
pasted once and stays in your browser, and audio flows browser↔OpenAI directly. Or run
your own instance (Netlify + an OpenAI key, about five minutes): see [SETUP.md](SETUP.md).

## Architecture

```
index.html                  Vite entry
src/
  main.tsx                  bootstrap + window.causerie debug/test API
  app.tsx                   root component: view state, call → analysis → review flow
  types.ts                  domain model (Memory, Analysis, SessionRecord, …), schema v1
  styles/global.css         design tokens + all styling
  lib/
    api.ts                  key source (server code vs own key), auth headers, mode detect
    realtime.ts             RealtimeCall: WebRTC to OpenAI Realtime, transcripts, time nudges
    prompts.ts              tutor briefing (verbatim in the memory tab): persona, facts,
                            targets, topic proposal, intro agenda, call-length format
    analysis.ts             post-call analysis: JSON schema (incl. cloze + facts), fallback chain
    merge.ts                applyAnalysis: analysis → memory (statuses, levels, facts, cards, XP)
    srs.ts                  SM-2 scheduling, session builder, cardsFromAnalysis
    budget.ts               how many cards a day may make: review capacity / reviews per
                            card, throttled by the unstarted backlog
    hints.ts                keeps a cloze's hint from naming its own answer (new cards and,
                            once, every card already in a deck)
    wordgoal.ts             the words a call pushes into active use, and whether they landed
    focus.ts  gamify.ts     focus targets; streak/intro-phase/daily-done helpers
    profiles.ts  sync.ts    local multi-profile registry; optional blob sync (token-based)
    tts.ts                  card audio (gpt-4o-mini-tts), cached object URLs
    seed.ts                 seeded starter memory + 12-card deck (test/debug fixture)
    storage.ts              per-profile localStorage persistence + v1→v2 migration
    cefr.ts  topics.ts  langs.ts  utils.ts
  components/               Avatar (Odile), charts (CEFR ladder, history), icons, Toast
  views/                    Onboarding, Today, Call, Review, ReviewSession, Cards,
                            MemoryView, Profiles, Settings
netlify/functions/          serverless surface (plain .mjs, no build step)
  health.mjs                GET /api/health → mode/auth status
  rt-token.mjs              POST /api/rt-token → mints ephemeral Realtime client secrets
  analyze.mjs               POST /api/analyze → proxies chat completions
  tts.mjs                   POST /api/tts → card audio
  user-data.mjs             GET/PUT /api/user-data → profile sync via Netlify Blobs
  lib/config.mjs  auth.mjs  env-first config, access-code / Google ID-token auth
tests/
  unit/                     vitest: cefr scale, merge semantics, focus ranking, parsing, prompts
  e2e/                      Playwright: full UI flows + live SDP handshake + live analysis
```

The daily loop: `Today` builds a `CallSession` (proposed topic, focus targets, intro or
daily mode, target minutes, one or two word goals from `wordgoal.ts`) → `RealtimeCall`
opens WebRTC and injects silent time notes so Odile lands the 3–5 minute format, plus a
note per word goal when it appears on screen → hang up → `analysis.ts` returns a structured
`Analysis` (corrections with cloze material, vocab, facts, level estimate) → `merge.ts`
folds it into `Memory` and `srs.ts` turns it into deck cards, as many as `budget.ts`
allows → `Review` shows transcript + new cards → `ReviewSession` runs its 18 cards with
SM-2 grading and TTS, twice a day → streak counts both halves of the day.

Two runtime modes, detected via `/api/health`: **server** (deployed; OpenAI key lives in
Netlify env vars, requests authorized by access code or Google ID token) and **local**
(dev server or standalone file; key pasted once, stored in that browser). Settings can
force local mode ("Ausweichmodus").

## Development

```
npm install
npm run dev          # Vite dev server → local mode; paste an OpenAI key in onboarding
npm run typecheck
npm test             # vitest unit suite
npm run build        # production build → dist/
npm run build:single # optional one-file flavor → dist-single/index.html
```

For the full server mode locally: `npx netlify-cli dev` (runs functions + Vite together;
set `OPENAI_API_KEY` and `ACCESS_CODE` in your shell or a `.env` Netlify picks up).

End-to-end suite (headless Chromium, fake mic):

```
npm run build
OPENAI_KEY=sk-… npm run test:e2e            # UI flows, seeded memory, review rendering
OPENAI_KEY=sk-… LIVE=1 npm run test:e2e     # + real Realtime SDP handshake + real analysis call
```

`LIVE=1` verifies the session config against the real API (expects SDP 201) and runs one
real analysis; behind an HTTP-only proxy the audio path itself cannot flow (no UDP), so
audible audio needs one manual call in a normal browser.

## Deployment

`netlify.toml` is the contract: Netlify runs `npm run build`, publishes `dist/`, and
bundles `netlify/functions/`. Any of these work:

- connect the repo to Netlify (recommended: push to GitHub, then Netlify → Import project;
  every push deploys),
- `npx netlify-cli deploy --prod` from a checkout,
- drag-and-drop is NOT enough here (functions + build step), use one of the above.

Environment variables (Site configuration → Environment variables):

| var | required | purpose |
|---|---|---|
| `OPENAI_API_KEY` | yes | only place the key lives; functions scope |
| `ACCESS_CODE` | yes* | auth gate. *Without it (and without Google auth) every request is refused — the gate fails closed |
| `GOOGLE_CLIENT_ID` | optional | switches auth to Google Sign-In |
| `ALLOWED_EMAILS` | optional | comma-separated allowlist for Google auth |
| `ALLOW_OPEN` | optional | `true` disables auth (don't) |
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | optional | your own Supabase project (accounts, ledger, usage log); unset = account-less mode |

Build-time (Vite, `.env.local`): `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (the
same Supabase project for the client), and `VITE_ADMIN_EMAILS` — comma-separated
addresses offered the admin usage screen; mirror of the RLS policy in `docs/SCHEMA.sql`,
which is what actually guards the data.

## Extension points

- **New target language**: add it to `LANGS` in `lib/langs.ts` and give it topics in
  `lib/topics.ts`. Prompts and analysis are language-parametric already.
- **New analysis dimension** (e.g. pronunciation scores): extend `AN_SCHEMA` +
  `Analysis` in `types.ts`, merge it in `merge.ts`, render it in `views/Review.tsx`.
- **Different models**: allowlists live in `lib/langs.ts` (client) and the two functions
  (server); settings expose them.
- **Memory schema changes**: bump `Memory.v`, translate old shapes in
  `storage.ts:migrate` — existing users' localStorage survives.
- **Deck tuning**: scheduling lives in `srs.ts` (plain SM-2). Session size and sessions per
  day are settings; everything downstream of them — the new cards a session starts, the
  cards a conversation may leave behind — is derived in `budget.ts` from
  `REVIEWS_PER_NEW_CARD`, so moving the review rhythm moves the card factory with it.
  Which cards a given budget buys is `cardsFromAnalysis`'s selection, not a cap.
- **Sync backend**: `user-data.mjs` is a thin blob store; swap for a real DB without
  touching the client beyond `lib/sync.ts`.

## Data storage, privacy & cost

Every profile's full state — all conversation transcripts, analyses, the deck, facts,
levels — lives in per-profile localStorage AND, by default on server deployments, is
continuously persisted server-side: after every change the whole profile is pushed
(debounced) to Netlify Blobs as one JSON document keyed by the profile's sync token
(`user-data.mjs`). That token doubles as the cross-device login. Boot pulls the newer
copy (last write wins). Users can switch server persistence off per profile
(Profile → Server-Speicherung); in own-key mode without an access code the functions
are unreachable, so data stays device-only. This is a document store, not a queryable
database — right for one-document-per-profile; swap `user-data.mjs` + `lib/sync.ts`
for Postgres/Supabase if you ever need queries across users or real accounts.

Audio flows browser↔OpenAI directly (WebRTC); nothing else sees the data.

Cost: Realtime re-sends the whole conversation as input on every turn, so a call gets
more expensive per minute the longer it runs. Most of those repeat tokens come back as
`cached_tokens` and bill at a fraction of the full rate ($0.40 against $32 per 1M audio
input), which is why the ledger tracks the cached split — `conversation_costs.meta` holds
it — instead of pricing every input token at list. Budget roughly $0.5–1.5 per 10-minute
call plus cents for analysis, verbatim pass and card audio. Settings → Voix & appel offers
`gpt-realtime-2.1-mini` (about a quarter of the price, weaker at catching errors live) as
an opt-in; the standard model stays the default.

Turn detection: semantic VAD at `low` eagerness. Learners pause mid-sentence to retrieve a
word, and stock silence-based endpointing treats that as the end of the turn, which splits
one spoken sentence into several and costs transcription accuracy on every fragment. The
noisy-environment mode still needs acoustic VAD but waits 1.4 s. Whatever the live VAD
does, `src/lib/stitch.ts` merges consecutive same-role items back into one turn before the
transcript is stored, and the continuous verbatim re-transcription of the raw mic recording
is stored alongside it (`SessionRecord.verbatim`, shown at the foot of the review).

## Acknowledgements & inspiration

Causerie is an independent, non-commercial hobby project, but its ideas have parents.
The personalized flashcards — cards built from the learner's own life, mistakes and
vocabulary, run on spaced repetition — follow the philosophy of Gabriel Wyner's book
*Fluent Forever*. The idea of practicing speaking with an animated character over a
call was inspired by Duolingo's Video Call feature. The scheduling is plain SM-2, from
the SuperMemo lineage that Anki also builds on.

Causerie is not affiliated with, endorsed by, or sponsored by Duolingo, Inc., Fluent
Forever, Inc., or Gabriel Wyner, and contains no code, artwork, or content from their
products. "Duolingo" and "Fluent Forever" are trademarks of their respective owners,
used here only to identify sources of inspiration. All characters and artwork in
Causerie, including Odile, are original.

## Author & contact

Marco Meyer — [marcomeyer.net](https://marcomeyer.net). Written almost entirely with
[Claude](https://claude.com/claude-code) (Anthropic's Claude Code); the commit messages
document that collaboration. Questions and ideas: open a GitHub issue, or reach me via
the website.

## License

[MIT](LICENSE). Use it, fork it, teach yourself something with it.
