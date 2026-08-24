-- ============================================================
--  ZIA'S COMMAND CENTRE — cloud sync schema
--  Run this ONCE in: Supabase → skyview project → SQL Editor
--  Safe to re-run (idempotent).
-- ============================================================

-- One table holds ideas, tasks, projects and leads.
-- 'kind' separates them; 'data' holds the object exactly as the app uses it.
create table if not exists public.cc_items (
  id          text        primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  kind        text        not null check (kind in ('idea','task','project','lead')),
  data        jsonb       not null,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now()
);

create index if not exists cc_items_user_kind_idx on public.cc_items (user_id, kind);
create index if not exists cc_items_updated_idx   on public.cc_items (user_id, updated_at desc);

-- ------------------------------------------------------------
-- Row Level Security: each user sees ONLY their own rows.
-- Without this the public anon key would expose data.
-- ------------------------------------------------------------
alter table public.cc_items enable row level security;

drop policy if exists cc_items_select on public.cc_items;
create policy cc_items_select on public.cc_items
  for select using (auth.uid() = user_id);

drop policy if exists cc_items_insert on public.cc_items;
create policy cc_items_insert on public.cc_items
  for insert with check (auth.uid() = user_id);

drop policy if exists cc_items_update on public.cc_items;
create policy cc_items_update on public.cc_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists cc_items_delete on public.cc_items;
create policy cc_items_delete on public.cc_items
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Keep updated_at honest on every write (used for sync merge)
-- ------------------------------------------------------------
create or replace function public.cc_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists cc_items_touch on public.cc_items;
create trigger cc_items_touch
  before insert or update on public.cc_items
  for each row execute function public.cc_touch();

-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------
select
  (select count(*) from pg_policies
     where schemaname='public' and tablename='cc_items')          as policies_created,
  (select relrowsecurity from pg_class
     where oid='public.cc_items'::regclass)                       as rls_enabled;
