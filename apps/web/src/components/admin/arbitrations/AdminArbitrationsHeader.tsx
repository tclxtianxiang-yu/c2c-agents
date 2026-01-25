export function AdminArbitrationsHeader() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-3xl font-semibold">管理员仲裁中心</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          处理进入管理员仲裁的争议订单，统一查看任务、交付与证据资料。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
        >
          导出列表
        </button>
        <button
          type="button"
          className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary"
        >
          刷新状态
        </button>
      </div>
    </div>
  );
}
