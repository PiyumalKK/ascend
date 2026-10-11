-- ASCEND · editable site content with full version history
-- Every edit (AI, manual, undo) inserts a new immutable row; the newest row is what the site shows.
-- Public read (the UI is public), owner-only insert, no update/delete (history cannot be rewritten).

create table if not exists public.content_versions (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  content    jsonb       not null,
  summary    text        not null default '' check (char_length(summary) <= 500),
  source     text        not null default 'manual' check (source in ('seed', 'ai', 'manual', 'restore')),
  created_at timestamptz not null default now(),
  constraint content_is_object check (jsonb_typeof(content) = 'object'),
  constraint content_size check (pg_column_size(content) < 1000000)
);

create index if not exists content_versions_latest_idx on public.content_versions (id desc);

alter table public.content_versions enable row level security;

drop policy if exists content_public_read on public.content_versions;
drop policy if exists content_owner_insert on public.content_versions;

create policy content_public_read on public.content_versions
  for select to anon, authenticated using (true);

create policy content_owner_insert on public.content_versions
  for insert to authenticated with check (user_id = auth.uid() and public.is_owner());

-- Realtime: edits appear instantly on every open device.
do $$
begin
  begin alter publication supabase_realtime add table public.content_versions; exception when duplicate_object then null; end;
end
$$;
