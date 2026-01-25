import { AdminAuditLog } from '@/components/admin/AdminAuditLog';
import { AdminDetailPanel } from '@/components/admin/AdminDetailPanel';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminListPanel } from '@/components/admin/AdminListPanel';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid';
import { TopNav } from '@/components/layout/TopNav';

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <AdminHeader />
        <AdminStatsGrid />

        <div className="grid gap-6 lg:grid-cols-3">
          <AdminListPanel />
          <AdminDetailPanel />
        </div>

        <AdminAuditLog />
      </div>
    </main>
  );
}
