-- ASCEND · initial schema
-- Run once in Supabase → SQL Editor. Safe to re-run (idempotent).
--
-- Security model
--   * The UI is public; every row of state belongs to exactly one auth user.
--   * Row Level Security on every table: a user can only touch rows where user_id = auth.uid().
--   * Defense in depth: writes additionally require is_owner(), so even if sign-ups were
--     accidentally enabled, a stranger's account could not store anything.

-- ---------------------------------------------------------------------------
-- Owner guard
-- ---------------------------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'piyumalm912@gmail.com'
$$;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- app_state: small key/value settings (plan, start date, channel names, checklists)
-- ---------------------------------------------------------------------------
create table if not exists public.app_state (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key        text        not null check (char_length(key) between 1 and 100),
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ---------------------------------------------------------------------------
-- scorecard_days: one row per day, items = {"wake":true,...}
-- ---------------------------------------------------------------------------
create table if not exists public.scorecard_days (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  day        date        not null,
  items      jsonb       not null default '{}'::jsonb,
  score      smallint    not null default 0 check (score between 0 and 50),
  note       text,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- reminders: one-off or recurring notifications (created by you or by the AI)
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  title      text        not null check (char_length(title) between 1 and 200),
  body       text,
  fire_at    timestamptz not null,
  repeat     text        check (repeat in ('daily', 'weekdays', 'weekly')),
  source     text        not null default 'user' check (source in ('user', 'ai', 'timetable')),
  status     text        not null default 'pending' check (status in ('pending', 'sent', 'done', 'cancelled')),
  sent_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reminders_due_idx on public.reminders (status, fire_at);

-- ---------------------------------------------------------------------------
-- stat_events: anything you log (Fiverr orders, reviews, earnings, content stats, study hours)
-- ---------------------------------------------------------------------------
create table if not exists public.stat_events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text        not null check (char_length(kind) between 1 and 50),
  value       numeric,
  data        jsonb       not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists stat_events_kind_idx on public.stat_events (user_id, kind, occurred_at desc);

-- ---------------------------------------------------------------------------
-- push_subscriptions: Web Push endpoints (browser / installed PWA)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  device     text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ai_messages / ai_reports: assistant chat history and generated reports
-- ---------------------------------------------------------------------------
create table if not exists public.ai_messages (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  role       text        not null check (role in ('user', 'assistant', 'tool')),
  content    text        not null,
  meta       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_time_idx on public.ai_messages (user_id, created_at desc);

create table if not exists public.ai_reports (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('briefing', 'weekly', 'nudge')),
  content    text        not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists app_state_touch on public.app_state;
create trigger app_state_touch before update on public.app_state
  for each row execute function public.touch_updated_at();

drop trigger if exists scorecard_touch on public.scorecard_days;
create trigger scorecard_touch before update on public.scorecard_days
  for each row execute function public.touch_updated_at();

drop trigger if exists reminders_touch on public.reminders;
create trigger reminders_touch before update on public.reminders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['app_state', 'scorecard_days', 'reminders', 'stat_events',
                           'push_subscriptions', 'ai_messages', 'ai_reports']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_select on public.%I', t);
    execute format('drop policy if exists owner_insert on public.%I', t);
    execute format('drop policy if exists owner_update on public.%I', t);
    execute format('drop policy if exists owner_delete on public.%I', t);
    execute format('create policy owner_select on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (user_id = auth.uid() and public.is_owner())', t);
    execute format('create policy owner_update on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_owner())', t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Realtime: phone and laptop update each other live
-- ---------------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.app_state;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.scorecard_days; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.reminders;      exception when duplicate_object then null; end;
end
$$;
