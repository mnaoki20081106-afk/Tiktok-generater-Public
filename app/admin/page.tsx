import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin';
import { AdminSurpriseForm } from './admin-surprise-form';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');

  const admin = createAdminClient();
  const { data: config } = await admin.from('surprise_config').select('*').eq('id', 1).maybeSingle();

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-12">
      <Link href="/dashboard" className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={14} />
        マイサイト一覧に戻る
      </Link>
      <h1 className="mb-2 text-xl font-semibold text-slate-900">サプライズ抽選設定</h1>
      <p className="mb-8 text-sm leading-relaxed text-slate-500">
        訪問者が公開ページの「TikTokを開く」ボタンをタップした際、指定した確率でユーザー入力のURLの代わりに
        当たりURLへ遷移させます。サイト作成者本人の端末・同一アカウントでログイン済みの端末からのアクセスは、
        常にユーザーが入力した本来のURLへ遷移します(自作自演での不正取得を防ぐため)。
      </p>
      <AdminSurpriseForm config={config} />
    </main>
  );
}
