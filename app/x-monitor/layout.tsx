import { StudioHeader } from '@/components/StudioHeader';
import { XMonitorAutoRefresh } from '@/components/XMonitorAutoRefresh';

export default function XMonitorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-shell xmon-shell">
      <StudioHeader current="x-monitor" />
      <XMonitorAutoRefresh />
      {children}
    </div>
  );
}
