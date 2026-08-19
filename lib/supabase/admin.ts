import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

/**
 * service_roleキーを使うSupabaseクライアント。RLSを完全にバイパスするため、
 * Server Action / Route Handlerなど「サーバー上でのみ実行されるコード」からのみ import すること。
 * クライアントコンポーネントに渡したり、ブラウザに送るレスポンスに含めたりしては絶対にいけない。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY が設定されていません(.env.local / Vercelの環境変数を確認してください)'
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
