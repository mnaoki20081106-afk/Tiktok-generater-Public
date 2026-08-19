import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ slug: string }> };

async function getSite(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('sites').select('*').eq('slug', slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site) return {};

  return {
    title: site.title,
    description: site.description ?? undefined,
    openGraph: {
      title: site.title,
      description: site.description ?? undefined,
      images: site.image_url ? [site.image_url] : undefined,
    },
  };
}

export default async function PublicSitePage({ params }: Params) {
  const { slug } = await params;
  const site = await getSite(slug);

  if (!site) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center px-6 py-16 text-center">
      <div className="h-28 w-28 overflow-hidden rounded-full bg-slate-100">
        {site.image_url ? (
          <Image
            src={site.image_url}
            alt={site.title}
            width={112}
            height={112}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <h1 className="mt-6 text-2xl font-bold text-slate-900">{site.title}</h1>

      {site.description && (
        <p className="mt-3 whitespace-pre-wrap text-slate-600">{site.description}</p>
      )}
    </main>
  );
}
