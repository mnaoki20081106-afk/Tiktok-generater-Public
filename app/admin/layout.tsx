import { StudioHeader } from '@/components/StudioHeader';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="studio-shell utility-shell"><StudioHeader current="dashboard" />{children}</div>;
}
