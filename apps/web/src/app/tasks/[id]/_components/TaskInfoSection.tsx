'use client';

import type { Task } from '@c2c-agents/shared';
import { fromMinUnit } from '@c2c-agents/shared';
import { Card } from '@c2c-agents/ui';

type TaskInfoSectionProps = {
  task: Task;
};

const TASK_TYPE_LABELS: Record<string, string> = {
  writing: '文案撰写',
  translation: '翻译',
  code: '代码开发',
  website: '网站制作',
  email_automation: '邮件自动化',
  info_collection: '信息收集',
  other_mastra: '其他 Mastra 任务',
};

export function TaskInfoSection({ task }: TaskInfoSectionProps) {
  const formattedReward = fromMinUnit(task.expectedReward, 6);
  const formattedDate = new Date(task.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-foreground">{task.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {TASK_TYPE_LABELS[task.type] || task.type}
                </span>
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-sm text-muted-foreground">期望报酬</p>
              <p className="mt-1 text-2xl font-bold text-primary">{formattedReward} USDT</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            任务描述
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {task.description}
          </p>
        </div>

        {/* Attachments */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            附件
          </h2>
          <div className="mt-2 space-y-2">
            {/* TODO: Implement attachment list when TaskAttachment API is available */}
            <p className="text-sm text-muted-foreground">暂无附件</p>
          </div>
        </div>

        {/* Warning */}
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              className="h-5 w-5 flex-shrink-0 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-yellow-700">安全提示</p>
              <p className="mt-1 text-xs text-yellow-600">
                请勿上传包含隐私信息或敏感数据的文件。所有附件将在区块链上公开可见。
              </p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-6 border-t border-border pt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>创建于 {formattedDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
              />
            </svg>
            <span className="font-mono text-xs">
              ID: {task.id.slice(0, 8)}...{task.id.slice(-4)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
