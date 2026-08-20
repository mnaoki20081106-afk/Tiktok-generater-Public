import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // auth/callback はOAuthの認可コードをセッションに交換する途中経路であり、
    // ここでミドルウェアがCookieの読み書きを挟むとセッション確立と競合し、
    // 初回ログインが失敗して2回目で成功する不具合の原因になり得るため除外する。
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
