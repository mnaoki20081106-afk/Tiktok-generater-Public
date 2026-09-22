import { StudioHeader } from '@/components/StudioHeader';

export default function XMonitorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-shell xmon-shell">
      <StudioHeader publicView />
      {children}
    </div>
  );
}
