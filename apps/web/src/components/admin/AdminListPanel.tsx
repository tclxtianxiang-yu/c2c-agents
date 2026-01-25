const filters = ['在线', '忙碌', '暂停', '超时'];

const adminRows = [
  {
    name: 'Ariana Chen',
    wallet: '0x8f...3a21',
    role: 'Lead Arbiter',
    stats: '今日 8 / 本周 41',
    progress: 64,
    statusLabel: '在线',
    statusClassName: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
    avatarClassName: 'bg-primary/10 text-primary',
    rowClassName: 'border-primary bg-primary/5 hover:bg-primary/10',
  },
  {
    name: 'Leo Park',
    wallet: '0x3b...91c2',
    role: 'Arbiter',
    stats: '今日 5 / 本周 29',
    progress: 46,
    statusLabel: '忙碌',
    statusClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
    avatarClassName: 'bg-muted text-amber-500',
    rowClassName: 'border-transparent hover:bg-muted/40',
  },
  {
    name: 'Sara Wei',
    wallet: '0x77...de10',
    role: 'Arbiter',
    stats: '今日 2 / 本周 13',
    progress: 24,
    statusLabel: '暂停',
    statusClassName: 'border-border bg-muted text-muted-foreground',
    avatarClassName: 'bg-muted text-purple-500',
    rowClassName: 'border-transparent hover:bg-muted/40',
  },
];

export function AdminListPanel() {
  return (
    <div className="flex flex-col gap-4 lg:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            search
          </span>
          <input
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            placeholder="搜索管理员、钱包地址、角色..."
            type="text"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {filters.map((label, index) => (
            <button
              key={label}
              type="button"
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${
                index === 0
                  ? 'border border-primary/40 bg-primary/10 text-primary'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  管理员
                </th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  角色
                </th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  处理量
                </th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  状态
                </th>
                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {adminRows.map((row) => (
                <tr
                  key={row.wallet}
                  className={`group cursor-pointer border-l-2 transition-colors ${row.rowClassName}`}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex size-9 items-center justify-center rounded-full font-semibold ${row.avatarClassName}`}
                      >
                        {row.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{row.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{row.wallet}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        row.role === 'Lead Arbiter'
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {row.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-muted-foreground">{row.stats}</div>
                    <div className="mt-2 h-1.5 w-32 rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${row.progress}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${row.statusClassName}`}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="material-symbols-outlined text-xl text-muted-foreground">
                      chevron_right
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">显示 1-3 / 共 18</p>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground">
            加载更多 <span className="material-symbols-outlined text-sm">expand_more</span>
          </button>
        </div>
      </div>
    </div>
  );
}
