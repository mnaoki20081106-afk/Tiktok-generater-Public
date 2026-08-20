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

-- 5) サプライズ抽選機能: 公開ページの「TikTokを開く」ボタンを、指定した確率で
--    ユーザー入力のURLではなく運営が指定する当たりURL(PayPayのリンク等)へ差し替える。
--    ただし作成者本人の端末・同一アカウントでログイン済みの端末からのアクセスは
--    常にユーザー入力のURLへ100%遷移させ、自作自演での不正取得を防ぐ。

-- 5-1) sites にサイト作成端末を記録する列を追加(作成者本人の端末を判定するため)
alter table public.sites add column if not exists creator_device_id text;

-- 5-2) ログイン済みユーザーが利用した端末を記録するテーブル(同一アカウントの端末判定用)
create table if not exists public.known_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists known_devices_user_id_idx on public.known_devices (user_id);

alter table public.known_devices enable row level security;

-- ログイン中の本人が、自分の端末として自分自身を登録できる
drop policy if exists "users can register their own devices" on public.known_devices;
create policy "users can register their own devices"
  on public.known_devices for insert
  with check (auth.uid() = user_id);

-- 自分の端末一覧の閲覧は本人のみ
drop policy if exists "users can view their own devices" on public.known_devices;
create policy "users can view their own devices"
  on public.known_devices for select
  using (auth.uid() = user_id);

-- サプライズ抽選時の「他人のサイトに対する同一アカウント端末判定」はService Roleキー
-- (RLSをバイパスする管理者専用クライアント)で行うため、それ以外の公開ポリシーは追加しない

-- 5-3) サプライズ抽選のグローバル設定(当選確率・当たりURL)。id=1固定のシングルトン行。
--    RLSを有効化した上でポリシーを一切追加しないことで、anon/authenticatedキーからの
--    読み書きを完全に禁止する(Service Roleキーを使うサーバーコードのみアクセス可能)。
--    これにより、当選確率や当たりURLは一般ユーザー・サイト作成者からは見えない/操作できない。
create table if not exists public.surprise_config (
  id smallint primary key default 1,
  enabled boolean not null default false,
  probability numeric(5, 2) not null default 0 check (probability >= 0 and probability <= 100),
  prize_url text,
  updated_at timestamptz not null default now(),
  constraint surprise_config_singleton check (id = 1)
);

insert into public.surprise_config (id, enabled, probability, prize_url)
values (1, false, 0, null)
on conflict (id) do nothing;

alter table public.surprise_config enable row level security;
