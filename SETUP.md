# Causerie · Running your own instance

Two ways to use Causerie. The **own-key** way needs no server at all: run the app (or
open a deployed instance), choose "with my own OpenAI key" at onboarding, paste a key
once — it stays in that browser. The **server** way puts the key in Netlify so the
people you share the URL with never see a key; that is what this guide sets up.

## Deploy (≈5 minutes)

1. Fork/clone this repo, then either connect it to Netlify (Import project; every push
   deploys) or deploy from a checkout: `npx netlify-cli deploy --prod`.
2. Site configuration → Environment variables:

   | var | required | purpose |
   |---|---|---|
   | `OPENAI_API_KEY` | yes | the only place the key lives (functions scope) |
   | `ACCESS_CODE` | yes* | the auth gate. *Without it (and without Google auth) every request is refused — the gate fails closed. |
   | `GOOGLE_CLIENT_ID` | optional | switches auth to Google Sign-In |
   | `ALLOWED_EMAILS` | optional | comma-separated allowlist for Google auth |
   | `ALLOW_OPEN` | optional | `true` disables auth entirely (don't) |

3. Redeploy, open the site, enter the access code at onboarding. iPhone: Share → "Add
   to Home Screen" makes it an installable app.

Cost lands on the OpenAI key: very roughly $0.5–1.5 per 10-minute call plus cents for
the analysis and card audio (details at the foot of the README). Keep the access code
private — anyone holding it converses on your key.

## The daily rhythm

1. During the day: one 3–5 minute call with Odile, on the topic she proposes or one you
   name in the first sentence.
2. After hang-up: transcript with corrections; your mistakes and new words become cards.
3. Evening: one review session (~18 cards, with audio); spacing is automatic.
4. "Memory" shows everything she knows about you — level, gaps, facts, the verbatim
   tutor briefing — all editable.

New profiles start with three getting-to-know-you calls that establish level and gaps.
Profiles live under the round initial top-right; the optional device sync code (shown
there) is also the cross-device login.

## Optional: accounts, sync & usage log (Supabase)

Without this the app runs account-less and everything lives in the browser (plus the
token-based blob sync). To add real accounts, a cost ledger and the usage log, create
your own Supabase project:

1. Point the app at it: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env.local`
   (build time), and the same two values as `SUPABASE_URL` + `SUPABASE_ANON_KEY` in the
   Netlify environment (functions). Unset means Supabase stays off — a fork never sends
   its users to somebody else's database.
2. Supabase → SQL Editor → paste `docs/SCHEMA.sql` → Run (idempotent). **First edit the
   admin address** in `is_causerie_admin` — that RLS policy is what actually guards the
   rows.
3. Mirror the same address in `VITE_ADMIN_EMAILS` (`.env.local`, see `.env.example`) so
   the app offers the screen: Settings → "Utilisateurs (admin)".

## Optional: reading your data from the terminal

`scripts/causerie.mjs` reads the same data the app holds, without a browser:

```
cp .env.example .env.local     # fill in; .env.local is gitignored
node scripts/causerie.mjs sessions 10      # the last conversations, compact
node scripts/causerie.mjs transcript       # the latest conversation in full
node scripts/causerie.mjs costs 30         # the cost ledger
node scripts/causerie.mjs events 90        # the usage log (admins: everyone)
```

The script holds no secrets of its own and writes nothing; it signs in exactly as the
browser does and prints JSON.

Development, tests, architecture: see README.md.
