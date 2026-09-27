import { FingerprintRecorder } from '@/components/FingerprintRecorder';
import { StudioHeader } from '@/components/StudioHeader';
import { getCurrentXMonitorAccess } from '@/lib/x-monitor-access';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentXMonitorAccess();

  return (
    <div className="studio-shell">
      <FingerprintRecorder />
      <StudioHeader current="dashboard" xMonitorLocked={!access.allowed} />
      {children}
    </div>
  );
}
