import { FingerprintRecorder } from '@/components/FingerprintRecorder';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-shell">
      <FingerprintRecorder />
      {children}
    </div>
  );
}
