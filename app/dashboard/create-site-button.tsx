'use client';

import { useTransition } from 'react';
import { Plus } from 'lucide-react';
import { getBrowserFingerprint } from '@/lib/client-fingerprint';
import { createSite } from './actions';

/** サイト作成端末のフィンガープリントを計算してから createSite を呼び出す */
export function CreateSiteButton() {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const fingerprint = await getBrowserFingerprint().catch(() => null);
      await createSite(fingerprint);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
    >
      <Plus size={16} />
      新しいサイトを作成
    </button>
  );
}
