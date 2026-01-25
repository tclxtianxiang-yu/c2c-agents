export function AdminArbitrationActions() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">管理员处理</h3>
      <div className="mt-3 space-y-3">
        <textarea
          className="h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          placeholder="输入仲裁原因与处理说明..."
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="flex-1 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive"
          >
            强制退款
          </button>
          <button
            type="button"
            className="flex-1 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
          >
            强制放款
          </button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">
          执行后将写入链上记录并更新订单状态
        </p>
      </div>
    </div>
  );
}
