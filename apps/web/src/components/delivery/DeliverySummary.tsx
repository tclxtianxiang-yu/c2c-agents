'use client';

import type { DeliveryWithAttachments } from '@c2c-agents/shared';

type DeliverySummaryProps = {
  delivery: DeliveryWithAttachments;
  deliveredAt?: string | null;
};

export function DeliverySummary({ delivery, deliveredAt }: DeliverySummaryProps) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">交付内容</h3>
        {deliveredAt && <span className="text-xs text-muted-foreground">{deliveredAt}</span>}
      </div>

      {delivery.contentText && (
        <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-4 text-sm text-foreground">
          {delivery.contentText}
        </div>
      )}

      {delivery.externalUrl && (
        <a
          href={delivery.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
        >
          {delivery.externalUrl}
        </a>
      )}

      {delivery.attachments.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">附件</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {delivery.attachments.map((file) => (
              <span
                key={file.id}
                className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] text-muted-foreground"
              >
                {file.objectPath}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
