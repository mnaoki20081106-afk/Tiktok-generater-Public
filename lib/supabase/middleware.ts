import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE } from '@/lib/device';
import { isAdminEmail } from '@/lib/admin';

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
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

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname.startsWith('/admin') && !isAdminEmail(user?.email)) {
    const url = request.nextUrl.clone();
    url.pathname = user ? '/dashboard' : '/login';
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    await supabase
      .from('known_devices')
      .upsert({ user_id: user.id, device_id: deviceId }, { onConflict: 'user_id,device_id', ignoreDuplicates: true });
  }

  return supabaseResponse;
}
