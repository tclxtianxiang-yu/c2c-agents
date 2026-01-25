export function AdminHeader() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-3xl font-semibold">仲裁管理员管理</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          管理仲裁队列、权限分配与审计记录，确保争议处理高效透明。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
        >
          新增管理员
        </button>
        <button
          type="button"
          className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary"
        >
          权限模板
        </button>
      </div>
    </div>
  );
}
