import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types';

/**
 * Google OAuthのリダイレクト先。認可コードをセッションに交換する。
 *
 * 交換で発行されるセッションCookieは、先にリダイレクト先を確定したNextResponseへ
 * 直接書き込む(lib/supabase/server.ts の next/headers 経由のcookies().set()に頼ると、
 * その後で別途 NextResponse.redirect() を作って返した際にCookieが引き継がれず、
 * ログインは成功しているのにセッションが確立されないままリダイレクトされてしまう
 * ことがある。ミドルウェアが確実に動いているのと同じ、レスポンスへ直接書き込む方式に統一する)。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const cookieStore = await cookies();
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('ログインに失敗しました')}`);
}
