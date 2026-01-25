import { AdminArbitrationActions } from '@/components/admin/arbitrations/AdminArbitrationActions';
import { AdminArbitrationDetailHeader } from '@/components/admin/arbitrations/AdminArbitrationDetailHeader';
import { AdminArbitrationEvidence } from '@/components/admin/arbitrations/AdminArbitrationEvidence';
import { AdminArbitrationSummary } from '@/components/admin/arbitrations/AdminArbitrationSummary';
import { AdminArbitrationTimeline } from '@/components/admin/arbitrations/AdminArbitrationTimeline';
import { TopNav } from '@/components/layout/TopNav';

type AdminArbitrationDetailPageProps = {
  params: { id: string };
};

export default function AdminArbitrationDetailPage({ params }: AdminArbitrationDetailPageProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <AdminArbitrationDetailHeader orderId={params.id} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <AdminArbitrationSummary />
            <AdminArbitrationEvidence />
          </div>
          <div className="flex flex-col gap-6">
            <AdminArbitrationTimeline />
            <AdminArbitrationActions />
          </div>
        </div>
      </div>
    </main>
  );
}
