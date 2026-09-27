import { StudioHeader } from '@/components/StudioHeader';
import { XMonitorAutoRefresh } from '@/components/XMonitorAutoRefresh';
import { getCurrentXMonitorAccess } from '@/lib/x-monitor-access';

export default async function XMonitorLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentXMonitorAccess();

  return (
    <div className="studio-shell xmon-shell">
      <StudioHeader current="x-monitor" xMonitorLocked={!access.allowed} />
      {access.allowed && <XMonitorAutoRefresh />}
      {children}
    </div>
  );
}
