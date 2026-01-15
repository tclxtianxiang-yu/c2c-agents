'use client';

import { AUTO_ACCEPT_HOURS } from '@c2c-agents/config/constants';
import { useEffect, useMemo, useState } from 'react';

type AutoAcceptCountdownProps = {
  deliveredAt: string | null;
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return '已到期';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export function AutoAcceptCountdown({ deliveredAt }: AutoAcceptCountdownProps) {
  const deadline = useMemo(() => {
    if (!deliveredAt) return null;
    const deliveredTime = new Date(deliveredAt).getTime();
    if (Number.isNaN(deliveredTime)) return null;
    return deliveredTime + AUTO_ACCEPT_HOURS * 60 * 60 * 1000;
  }, [deliveredAt]);

  const [remaining, setRemaining] = useState(() => (deadline ? deadline - Date.now() : 0));

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => {
      setRemaining(deadline - Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline) {
    return (
      <div className="rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        暂无自动验收倒计时
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
      自动验收倒计时：{formatRemaining(remaining)}
    </div>
  );
}
