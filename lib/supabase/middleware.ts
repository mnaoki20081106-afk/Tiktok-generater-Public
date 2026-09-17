import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE } from '@/lib/device';
import { isAdminEmail } from '@/lib/admin';
import { hashClientIp } from '@/lib/request-identity';

/**
 * セッションCookieのrefreshを行い、必要に応じて未ログインユーザーを/loginへ誘導する。
 * あわせて、
 * - 端末識別用Cookie(dvid)が無ければ発行する(サプライズ抽選の端末判定に使う)
 * - ログイン中ユーザーがdashboard配下にアクセスした際、その端末をknown_devicesへ記録する
 * - /admin配下はADMIN_EMAILSに含まれるメールアドレスのユーザーのみ通す
 */
export async function updateSession(request: NextRequest) {
  const existingDeviceId = request.cookies.get(DEVICE_COOKIE)?.value;
  const deviceId = existingDeviceId ?? randomUUID();
  const isNewDevice = !existingDeviceId;
  if (isNewDevice) {
    request.cookies.set(DEVICE_COOKIE, deviceId);
  }

  let supabaseResponse = NextResponse.next({ request });
  const applyDeviceCookie = (res: NextResponse) => {
    if (isNewDevice) {
      res.cookies.set(DEVICE_COOKIE, deviceId, {
        maxAge: DEVICE_COOKIE_MAX_AGE,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      });
    }
  };
  applyDeviceCookie(supabaseResponse);

  // setAllは1リクエスト中に複数回呼ばれることがある(セッションのrefreshとは別に
  // 追加のCookie書き込みが走るケースがある)。そのたびにNextResponseを作り直すだけだと、
  // 直前のsetAllで書き込んだCookieが新しいレスポンスに引き継がれず消えてしまい、
  // ブラウザにリフレッシュ後のセッションCookieが渡らないままになる
  // (=次回アクセス時に強制ログアウトされる)不具合があったため、
  // これまでにsetAllされた全Cookieを毎回累積して再適用するようにする。
  const allCookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          allCookiesToSet.push(...cookiesToSet);
          supabaseResponse = NextResponse.next({ request });
          allCookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          applyDeviceCookie(supabaseResponse);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 認証確認で更新・削除されたCookieは、リダイレクト時にも必ず返す。
  const redirectWithCookies = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = '';
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  };

  // Cookieの存在だけでなく、Supabaseで確認した有効なログインを再利用する。
  // Server ActionのPOSTを横取りしないよう、ページ表示時だけ移動する。
  if (
    user &&
    (request.method === 'GET' || request.method === 'HEAD') &&
    (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/login')
  ) {
    return redirectWithCookies('/dashboard');
  }

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return redirectWithCookies('/login');
  }

  if (request.nextUrl.pathname.startsWith('/admin') && !isAdminEmail(user?.email)) {
    return redirectWithCookies(user ? '/dashboard' : '/login');
  }

  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const ipHash = hashClientIp(request.headers);
    await Promise.all([
      supabase
        .from('known_devices')
        .upsert({ user_id: user.id, device_id: deviceId }, { onConflict: 'user_id,device_id', ignoreDuplicates: true }),
      ipHash
        ? supabase
            .from('known_ip_hashes')
            .upsert({ user_id: user.id, ip_hash: ipHash }, { onConflict: 'user_id,ip_hash', ignoreDuplicates: true })
        : Promise.resolve(),
    ]);
  }

  return supabaseResponse;
}
