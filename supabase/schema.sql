-- Supabase SQL Editor で実行してください。
-- このアプリはSupabase Authを使わない(ログイン機能なし)。
-- 各サイトは作成時に発行される edit_token(推測不可能なUUID)を知っている人だけが
-- 編集できる、「秘密の編集リンク」方式。
--
-- 書き込み(作成・更新・画像アップロード)はすべてNext.jsのServer Action経由で
-- service_roleキー(サーバー専用シークレット。ブラウザには絶対に渡さない)を使って行う。
-- service_roleはRLSを無視できるため、ブラウザ(anonキー)からの直接の書き込みは
-- 全て禁止しておけば、そもそもRLSポリシーで edit_token の一致を検証する必要がない。

-- 1) sites テーブル作成
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  edit_token uuid not null default gen_random_uuid(),
  slug text not null unique,
  title text not null default '',
  description text default '',
  image_url text,
  content_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists sites_edit_token_key on public.sites (edit_token);
create index if not exists sites_slug_idx on public.sites (slug);

-- 2) Row Level Security を有効化
alter table public.sites enable row level security;

-- 3) ポリシー: 閲覧(SELECT)のみ全員に許可。INSERT/UPDATE/DELETEのポリシーは
--    一切定義しない = anon/authenticatedロールからは常に拒否される。
--    (service_roleはRLSをバイパスするため、Server Action経由の書き込みには影響しない)
drop policy if exists "sites are viewable by everyone" on public.sites;
create policy "sites are viewable by everyone"
  on public.sites for select
  using (true);

-- 4) 列レベルのアクセス制御: edit_token列は anon/authenticated には絶対に見せない。
--    (RLSは行単位の制御しかできないため、秘密の列を隠すには列権限を別途絞る必要がある)
revoke select on public.sites from anon, authenticated;
grant select (id, slug, title, description, image_url, content_data, created_at)
  on public.sites to anon, authenticated;

-- アプリのコードでは公開ページ・一覧系のクエリで `select('*')` を使わず、
-- 必ず上記の公開カラムを明示的に指定すること(edit_tokenはservice_role経由でのみ読む)。

-- 5) Storage: プロフィール画像用バケット
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

-- 画像は誰でも閲覧可能(公開ページに表示するため)
drop policy if exists "site-images are publicly accessible" on storage.objects;
create policy "site-images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'site-images');

-- アップロード・更新・削除のポリシーは定義しない = anonからの直接アップロードは拒否。
-- 画像アップロードもServer Action経由でservice_roleキーを使って行う。
