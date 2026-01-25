const logs = [
  {
    title: '权限升级',
    name: 'Ariana Chen · Lead Arbiter',
    time: '2 mins ago · 0x8f...3a21',
  },
  {
    title: '恢复账号',
    name: 'Leo Park · Arbiter',
    time: '1 hour ago · 0x3b...91c2',
  },
  {
    title: 'SLA 标记',
    name: 'Sara Wei · Arbiter',
    time: 'Yesterday · 0x77...de10',
  },
];

export function AdminAuditLog() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold">最近审计记录</h4>
        <button
          type="button"
          className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
        >
          导出
        </button>
      </div>
      <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
        {logs.map((log) => (
          <div key={log.title} className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-sm font-semibold text-foreground">{log.title}</p>
            <p className="mt-1">{log.name}</p>
            <p className="mt-2 text-xs text-muted-foreground">{log.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
