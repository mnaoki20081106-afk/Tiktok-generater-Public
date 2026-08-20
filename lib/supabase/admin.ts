import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

/**
 * RLSを完全にバイパスするService Roleクライアント。
 * サプライズ抽選の当選確率・当たりURル(surprise_config)や known_devices は
 * 一般ユーザーに読み書きさせてはいけない設定値のため、anonキー(RLS前提)ではなく
 * こちらを使う。サーバー専用コード(Route Handler / Server Action)以外から
 * 絶対にimportしないこと。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません(.env.local を確認してください)');
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
