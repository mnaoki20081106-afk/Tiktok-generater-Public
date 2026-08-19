import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { DashboardForm } from '../dashboard-form';

export default async function EditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: site } = await admin.from('sites').select('*').eq('edit_token', token).maybeSingle();

  if (!site) {
    notFound();
  }

  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = host?.startsWith('localhost') ? 'http' : 'https';
  const siteUrlOrigin = `${protocol}://${host}`;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">サイトを編集</h1>
        <p className="text-sm text-slate-500">
          このページのURLがあなた専用の編集リンクです。ブックマークしておいてください(他人に教えると誰でも編集できてしまいます)。
        </p>
      </div>

      <DashboardForm editToken={token} site={site} siteUrlOrigin={siteUrlOrigin} />
    </main>
  );
}
