const permissions = [
  { label: '强制退款', tone: 'text-emerald-600', icon: 'check' },
  { label: '终止/放款', tone: 'text-emerald-600', icon: 'check' },
  { label: '复核仲裁', tone: 'text-emerald-600', icon: 'check' },
  { label: '暂停权限', tone: 'text-amber-600', icon: 'warning' },
];

const queueItems = [
  {
    title: '#4921: Python Scraping Bot',
    subtitle: '冻结 0.5 ETH · 2 hours ago',
    status: '待处理',
    statusClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  },
  {
    title: '#4899: NFT Art Generation',
    subtitle: '冻结 0.15 ETH · 5 hours ago',
    status: '调查中',
    statusClassName: 'border-blue-500/30 bg-blue-500/10 text-blue-600',
  },
];

export function AdminDetailPanel() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">当前选中</p>
            <h3 className="mt-2 text-lg font-semibold">Ariana Chen</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              钱包地址:
              <span className="ml-1 font-mono text-primary">0x8f...3a21</span>
            </p>
          </div>
          <span className="material-symbols-outlined text-muted-foreground">open_in_new</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">角色权限</p>
            <p className="mt-2 text-sm font-semibold">Lead Arbiter</p>
            <p className="mt-1 text-xs text-muted-foreground">可强制退款与放款</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">本周命中率</p>
            <p className="mt-2 text-sm font-semibold">96.4%</p>
            <p className="mt-1 text-xs text-muted-foreground">争议复核通过</p>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-semibold">当前排队案件</h4>
          <div className="mt-3 flex flex-col gap-2">
            {queueItems.map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${item.statusClassName}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-semibold">权限范围</h4>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {permissions.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2"
              >
                <span className={`material-symbols-outlined text-sm ${item.tone}`}>
                  {item.icon}
                </span>
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex-1 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
          >
            调整权限
          </button>
          <button
            type="button"
            className="flex-1 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive"
          >
            暂时停用
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">调整权限将记录审计日志</p>
      </div>
    </div>
  );
}
