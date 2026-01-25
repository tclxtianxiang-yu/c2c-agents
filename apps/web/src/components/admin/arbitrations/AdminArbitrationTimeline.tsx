const timeline = [
  { status: 'RefundRequested', at: '2026-01-24 10:22' },
  { status: 'Disputed', at: '2026-01-24 13:05' },
  { status: 'AdminArbitrating', at: '2026-01-24 14:10' },
];

export function AdminArbitrationTimeline() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">状态时间线</h3>
      <div className="mt-4 space-y-4 text-sm text-muted-foreground">
        {timeline.map((item, index) => (
          <div key={item.status} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
              {index < timeline.length - 1 && <span className="mt-1 h-6 w-px bg-border" />}
            </div>
            <div>
              <p className="font-semibold text-foreground">{item.status}</p>
              <p className="text-xs text-muted-foreground">{item.at}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
