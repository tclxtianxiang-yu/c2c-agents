export function AdminArbitrationSummary() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">任务信息</h3>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="text-foreground">标题：</span>Python Scraping Bot
          </p>
          <p>
            <span className="text-foreground">类型：</span>code · data
          </p>
          <p>
            <span className="text-foreground">发布方：</span>0x12...8A
          </p>
          <p>
            <span className="text-foreground">接单方：</span>0x45...9B
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">订单与资金</h3>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="text-foreground">冻结金额：</span>0.5 ETH
          </p>
          <p>
            <span className="text-foreground">平台费率：</span>15%
          </p>
          <p>
            <span className="text-foreground">交付时间：</span>2026-01-24 14:30
          </p>
          <p>
            <span className="text-foreground">争议类型：</span>退款争议
          </p>
        </div>
      </div>
    </div>
  );
}
