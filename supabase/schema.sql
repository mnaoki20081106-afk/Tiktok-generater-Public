-- Supabase SQL Editor で実行してください。
-- Googleログイン(Supabase Auth)必須。1ユーザーが複数サイトを作成できる。

-- 1) sites テーブル作成
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  title text not null default '',
  description text default '',
  image_url text,
  content_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 1ユーザーが複数サイトを持てるので user_id にはユニーク制約を付けない
create index if not exists sites_user_id_idx on public.sites (user_id);
create index if not exists sites_slug_idx on public.sites (slug);

-- 2) Row Level Security を有効化
alter table public.sites enable row level security;

-- 3) ポリシー
-- 公開ページ(/[slug])は誰でも閲覧できる必要があるため、SELECTは全員に許可
drop policy if exists "sites are viewable by everyone" on public.sites;
create policy "sites are viewable by everyone"
  on public.sites for select
  using (true);

-- 作成・更新・削除は本人の行のみ
drop policy if exists "users can insert their own site" on public.sites;
create policy "users can insert their own site"
  on public.sites for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update their own site" on public.sites;
create policy "users can update their own site"
  on public.sites for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete their own site" on public.sites;
create policy "users can delete their own site"
  on public.sites for delete
  using (auth.uid() = user_id);

-- 4) Storage: プロフィール画像用バケット
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

-- 画像は誰でも閲覧可能(公開ページに表示するため)
drop policy if exists "site-images are publicly accessible" on storage.objects;
create policy "site-images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'site-images');

-- アップロード・更新・削除は、自分のuser_idをパスの先頭に持つファイルのみ許可
-- (アプリ側では `${user.id}/xxxx.png` というパスでアップロードする)
drop policy if exists "users can upload their own images" on storage.objects;
create policy "users can upload their own images"
  on storage.objects for insert
  with check (
    bucket_id = 'site-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users can update their own images" on storage.objects;
create policy "users can update their own images"
  on storage.objects for update
  using (
    bucket_id = 'site-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users can delete their own images" on storage.objects;
create policy "users can delete their own images"
  on storage.objects for delete
  using (
    bucket_id = 'site-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
