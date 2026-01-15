type PaymentStatusBannerProps = {
  status: 'idle' | 'pending' | 'success' | 'error';
  message?: string;
};

const statusConfig = {
  idle: {
    className: 'border-border bg-muted text-muted-foreground',
    label: '等待支付确认',
  },
  pending: {
    className: 'border-warning/40 bg-warning/15 text-warning',
    label: '支付确认中...',
  },
  success: {
    className: 'border-success/40 bg-success/15 text-success',
    label: '支付确认成功',
  },
  error: {
    className: 'border-destructive/40 bg-destructive/15 text-destructive',
    label: '支付确认失败',
  },
};

export function PaymentStatusBanner({ status, message }: PaymentStatusBannerProps) {
  const config = statusConfig[status];

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${config.className}`}>
      <strong className="mr-2 font-semibold">{config.label}</strong>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
