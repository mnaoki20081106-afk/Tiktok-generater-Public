import { FingerprintRecorder } from '@/components/FingerprintRecorder';
import { StudioHeader } from '@/components/StudioHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-shell">
      <FingerprintRecorder />
      <StudioHeader />
      {children}
    </div>
  );
}
