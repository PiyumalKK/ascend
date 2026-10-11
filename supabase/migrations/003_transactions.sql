-- ASCEND · personal money tracking (expenses and income). Private: owner-only read and write.

create table if not exists public.transactions (
  id          uuid          primary key default gen_random_uuid(),
  user_id     uuid          not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text          not null default 'expense' check (kind in ('expense', 'income')),
  amount      numeric(14,2) not null check (amount > 0 and amount < 1000000000),
  currency    text          not null default 'LKR' check (currency ~ '^[A-Z]{3}$'),
  category    text          not null check (char_length(category) between 1 and 40),
  note        text          check (char_length(note) <= 300),
  occurred_on date          not null default ((now() at time zone 'Asia/Colombo')::date),
  source      text          not null default 'manual' check (source in ('manual', 'ai', 'voice')),
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, occurred_on desc);

drop trigger if exists transactions_touch on public.transactions;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

alter table public.transactions enable row level security;

drop policy if exists owner_select on public.transactions;
drop policy if exists owner_insert on public.transactions;
drop policy if exists owner_update on public.transactions;
drop policy if exists owner_delete on public.transactions;

create policy owner_select on public.transactions for select to authenticated using (user_id = auth.uid() and public.is_owner());
create policy owner_insert on public.transactions for insert to authenticated with check (user_id = auth.uid() and public.is_owner());
create policy owner_update on public.transactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_owner());
create policy owner_delete on public.transactions for delete to authenticated using (user_id = auth.uid() and public.is_owner());

do $$
begin
  begin alter publication supabase_realtime add table public.transactions; exception when duplicate_object then null; end;
end
$$;
