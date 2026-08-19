'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteSite } from './actions';

export function DeleteSiteButton({ id, slug }: { id: string; slug: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`「${slug}」を削除します。元に戻せません。よろしいですか？`)) return;
    startTransition(() => {
      deleteSite(id);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50"
    >
      <Trash2 size={13} />
      削除
    </button>
  );
}
