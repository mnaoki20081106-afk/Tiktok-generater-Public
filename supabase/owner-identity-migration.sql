-- 作成者本人をサプライズ抽選から除外するための追加マイグレーション。
-- Supabase SQL Editorで1回実行してください。IPの生値は保存しません。

create table if not exists public.site_owner_signals (
  site_id uuid primary key references public.sites (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text,
  fingerprint text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists site_owner_signals_user_id_idx on public.site_owner_signals (user_id);
create index if not exists site_owner_signals_ip_hash_idx on public.site_owner_signals (ip_hash);
alter table public.site_owner_signals enable row level security;

insert into public.site_owner_signals (site_id, user_id, device_id, fingerprint)
select id, user_id, creator_device_id, creator_fingerprint from public.sites
on conflict (site_id) do nothing;

create table if not exists public.known_ip_hashes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, ip_hash)
);

create index if not exists known_ip_hashes_user_id_idx on public.known_ip_hashes (user_id);
create index if not exists known_ip_hashes_ip_hash_idx on public.known_ip_hashes (ip_hash);
alter table public.known_ip_hashes enable row level security;

drop policy if exists "users can register their own ip hashes" on public.known_ip_hashes;
create policy "users can register their own ip hashes"
  on public.known_ip_hashes for insert
  with check (auth.uid() = user_id);
