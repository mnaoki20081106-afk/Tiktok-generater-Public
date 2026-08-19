import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import { DashboardForm } from './dashboard-form';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = host?.startsWith('localhost') ? 'http' : 'https';
  const siteUrlOrigin = `${protocol}://${host}`;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">ダッシュボード</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <DashboardForm userId={user.id} site={site} siteUrlOrigin={siteUrlOrigin} />
    </main>
  );
}
