'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export function XMonitorAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let lastRefreshAt = Date.now();

    const refresh = () => {
      lastRefreshAt = Date.now();
      router.refresh();
    };

    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    const refreshIfStale = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastRefreshAt >= REFRESH_INTERVAL_MS
      ) {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('focus', refreshIfStale);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfStale);
      window.removeEventListener('focus', refreshIfStale);
    };
  }, [router]);

  return null;
}
