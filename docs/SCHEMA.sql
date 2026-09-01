-- Causerie · Supabase schema
--
-- Run in the Supabase SQL editor (Dashboard → SQL → New query). Idempotent: safe to run
-- again after a change.
--
-- Everything the browser touches goes through row-level security under the CALLER's own
-- JWT — the app ships a publishable key and no server secret, so RLS is not a nicety here,
-- it is the whole access model. Two rules matter and both are enforced below rather than
-- in the client: a user may write only their own rows, and exactly one address may read
-- everybody's. The admin screen in the app checks the same address before it OFFERS
-- itself, but that check is decoration; this file is the one that counts.


/* ---------------------------------------------------------------------------
   user_events — who signed up when, came back when, and did what for how long
   --------------------------------------------------------------------------- */

create table if not exists public.user_events (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  -- Denormalised on purpose: auth.users is not readable from the client, so without this
  -- the admin screen could show activity but never say whose.
  email       text,
  -- 'login' | 'call' | 'review' | 'signup'
  kind        text        not null,
  -- Duration of the act itself, where it has one. Minutes spent in a call are the number
  -- that means something; time with the app merely open is not.
  seconds     integer,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists user_events_created_idx on public.user_events (created_at desc);
create index if not exists user_events_user_idx    on public.user_events (user_id, created_at desc);

alter table public.user_events enable row level security;

-- The admin address, in one place. PUT YOUR OWN ADDRESS HERE before running this, and
-- mirror it in VITE_ADMIN_EMAILS (see .env.example) so the app offers the admin screen;
-- this policy is what actually decides whether the rows come back.
create or replace function public.is_causerie_admin() returns boolean
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('admin@example.com')
$$;

drop policy if exists user_events_insert_own on public.user_events;
create policy user_events_insert_own on public.user_events
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_events_read_own on public.user_events;
create policy user_events_read_own on public.user_events
  for select to authenticated
  using (user_id = auth.uid());

-- The one policy that makes the stats screen possible, and the only way to read another
-- user's rows. Note there is deliberately no UPDATE or DELETE policy at all: an event log
-- nobody can rewrite is worth more than a tidy one.
drop policy if exists user_events_read_all_admin on public.user_events;
create policy user_events_read_all_admin on public.user_events
  for select to authenticated
  using (public.is_causerie_admin());


/* ---------------------------------------------------------------------------
   conversation_costs — the per-call ledger (already in use; here for the record)
   --------------------------------------------------------------------------- */

-- The admin screen reads the whole ledger, not just its own rows, so the same rule is
-- extended to it. The existing per-user policies are left alone.
drop policy if exists conversation_costs_read_all_admin on public.conversation_costs;
create policy conversation_costs_read_all_admin on public.conversation_costs
  for select to authenticated
  using (public.is_causerie_admin());
