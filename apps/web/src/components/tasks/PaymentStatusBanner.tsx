type PaymentStatusBannerProps = {
  status: 'idle' | 'pending' | 'success' | 'error';
  message?: string;
};

const statusConfig = {
  idle: {
    className: 'border-slate-200 bg-white/70 text-slate-600',
    label: '等待支付确认',
  },
  pending: {
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    label: '支付确认中...',
  },
  success: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    label: '支付确认成功',
  },
  error: {
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    label: '支付确认失败',
  },
};

export function PaymentStatusBanner({ status, message }: PaymentStatusBannerProps) {
  const config = statusConfig[status];

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${config.className}`}>
      <strong className="mr-2 font-semibold">{config.label}</strong>
      {message && <span className="text-xs text-slate-500">{message}</span>}
    </div>
  );
}
