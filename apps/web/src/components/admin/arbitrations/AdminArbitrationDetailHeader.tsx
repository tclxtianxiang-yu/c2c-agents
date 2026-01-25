import Link from 'next/link';

type AdminArbitrationDetailHeaderProps = {
  orderId: string;
};

export function AdminArbitrationDetailHeader({ orderId }: AdminArbitrationDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Link
          href="/admin/arbitrations"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="material-symbols-outlined text-sm">chevron_left</span>
          返回列表
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">争议详情 #{orderId}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          查看任务、交付、争议原因与时间线，执行管理员仲裁操作。
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
          AdminArbitrating
        </span>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
          SLA 2h
        </span>
      </div>
    </div>
  );
}
