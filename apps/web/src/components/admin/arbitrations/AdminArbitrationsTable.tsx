import Link from 'next/link';

const rows = [
  {
    id: '4921',
    task: 'Python Scraping Bot',
    parties: '0x12...8A vs 0x45...9B',
    amount: '0.5 ETH',
    type: '退款争议',
    enteredAt: '2 hours ago',
    status: '仲裁中',
    statusClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  },
  {
    id: '4899',
    task: 'NFT Art Generation',
    parties: '0x88...1C vs 0x22...4D',
    amount: '0.15 ETH',
    type: '交付争议',
    enteredAt: '5 hours ago',
    status: '待复核',
    statusClassName: 'border-blue-500/30 bg-blue-500/10 text-blue-600',
  },
  {
    id: '4852',
    task: 'Translation Model Tuning',
    parties: '0x99...FA vs 0x11...BB',
    amount: '1.2 ETH',
    type: '中断争议',
    enteredAt: '1 day ago',
    status: '仲裁中',
    statusClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  },
];

export function AdminArbitrationsTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                订单
              </th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                任务
              </th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                双方
              </th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                冻结金额
              </th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                类型
              </th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                状态
              </th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                进入时间
              </th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer transition-colors hover:bg-muted/40">
                <td className="p-4 text-sm font-semibold text-foreground">#{row.id}</td>
                <td className="p-4 text-sm text-foreground">{row.task}</td>
                <td className="p-4 text-xs font-mono text-muted-foreground">{row.parties}</td>
                <td className="p-4 text-sm font-semibold text-foreground">{row.amount}</td>
                <td className="p-4 text-xs text-muted-foreground">{row.type}</td>
                <td className="p-4">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${row.statusClassName}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="p-4 text-xs text-muted-foreground">{row.enteredAt}</td>
                <td className="p-4 text-right">
                  <Link
                    href={`/admin/arbitrations/${row.id}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    查看详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">显示 1-3 / 共 27</p>
        <button type="button" className="text-sm text-muted-foreground hover:text-foreground">
          加载更多 <span className="material-symbols-outlined text-sm">expand_more</span>
        </button>
      </div>
    </div>
  );
}
