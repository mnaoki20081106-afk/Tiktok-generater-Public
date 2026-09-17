'use client';

import { useTransition } from 'react';
import { Loader2, Plus } from 'lucide-react';
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
      className="studio-primary"
    >
      {isPending ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          作成中...
        </>
      ) : (
        <>
          <Plus size={16} />
          新しいサイトを作成
        </>
      )}
    </button>
  );
}
