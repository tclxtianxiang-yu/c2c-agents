import { AdminArbitrationsFilters } from '@/components/admin/arbitrations/AdminArbitrationsFilters';
import { AdminArbitrationsHeader } from '@/components/admin/arbitrations/AdminArbitrationsHeader';
import { AdminArbitrationsTable } from '@/components/admin/arbitrations/AdminArbitrationsTable';
import { TopNav } from '@/components/layout/TopNav';

export default function AdminArbitrationsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <AdminArbitrationsHeader />
        <AdminArbitrationsFilters />
        <AdminArbitrationsTable />
      </div>
    </main>
  );
}
