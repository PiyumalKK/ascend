-- ASCEND · store AI analyses and news digests alongside briefings and weekly reports.
alter table public.ai_reports add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.ai_reports drop constraint if exists ai_reports_kind_check;
alter table public.ai_reports add constraint ai_reports_kind_check
  check (kind in ('briefing', 'weekly', 'nudge', 'insights', 'news'));
create index if not exists ai_reports_kind_time_idx on public.ai_reports (user_id, kind, created_at desc);
do $$
begin
  begin alter publication supabase_realtime add table public.ai_reports; exception when duplicate_object then null; end;
end
$$;
