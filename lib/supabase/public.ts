import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types';

/**
 * anonキーを使う読み取り専用のSupabaseクライアント。公開ページ(/[slug])など、
 * ログイン不要で誰でも呼び出してよい箇所から使う。RLSにより edit_token 列は
 * このクライアントからは取得できない(DB側の列権限でrevokeしてある)。
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
