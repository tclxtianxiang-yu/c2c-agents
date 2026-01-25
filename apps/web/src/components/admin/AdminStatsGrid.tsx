const stats = [
  {
    label: '在线管理员 (Active)',
    value: '12',
    hint: '/ 18 总数',
  },
  {
    label: '待分配案件 (Queue)',
    value: '27',
    hint: '+5 新增',
    hintClassName: 'text-amber-500 font-semibold',
  },
  {
    label: '今日已处理 (Resolved)',
    value: '34',
    hint: '本周累计: 221',
  },
  {
    label: 'SLA 超时 (Breached)',
    value: '3',
    hint: '需优先处理',
    hintClassName: 'text-destructive font-semibold',
  },
];

export function AdminStatsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold">{stat.value}</p>
            <span className={`text-xs text-muted-foreground ${stat.hintClassName ?? ''}`}>
              {stat.hint}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
