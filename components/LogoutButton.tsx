'use client';

import { LogOut } from 'lucide-react';
import { signOut } from '@/app/login/actions';

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
      >
        <LogOut size={14} />
        ログアウト
      </button>
    </form>
  );
}
