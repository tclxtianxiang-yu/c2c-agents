import type { Task } from '@c2c-agents/shared';
import { OrderStatus } from '@c2c-agents/shared';
import { TaskStatusBadge } from './TaskStatusBadge';

export type TaskSummary = Pick<
  Task,
  'id' | 'title' | 'type' | 'expectedReward' | 'status' | 'currentStatus'
>;

function formatMinUnit(amount: string, decimals = 6): string {
  const normalized = amount.padStart(decimals + 1, '0');
  const integer = normalized.slice(0, -decimals);
  const fraction = normalized.slice(-decimals);
  return `${Number(integer).toLocaleString()}.${fraction}`;
}

const typeLabels: Record<string, string> = {
  writing: '写作',
  translation: '翻译',
  code: '代码',
  website: '网站',
  email_automation: '邮件自动化',
  info_collection: '信息收集',
  other_mastra: '其他 Mastra',
};

type TaskCardProps = {
  task: TaskSummary;
};

export function TaskCard({ task }: TaskCardProps) {
  const isStandby = task.currentStatus === OrderStatus.Standby;
  const isPairing = task.currentStatus === OrderStatus.Pairing;
  const actionLabel = isStandby ? '自动匹配 (Auto Match)' : isPairing ? '确认匹配' : '查看状态';

  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <TaskStatusBadge taskStatus={task.status} orderStatus={task.currentStatus} />
        <span className="text-xs text-slate-400">#{task.id.slice(0, 6)}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white leading-snug line-clamp-2">
        {task.title}
      </h3>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/70">
        {typeLabels[task.type] ?? task.type}
      </p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
          {formatMinUnit(task.expectedReward)}
        </span>
        <span className="text-xs font-semibold text-slate-400">USDT</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-300">
          {task.status}
        </span>
        {task.currentStatus && (
          <span className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-300">
            {task.currentStatus}
          </span>
        )}
      </div>
      <div className="mt-auto pt-6">
        <button
          type="button"
          className="w-full rounded-xl bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
        >
          {actionLabel}
        </button>
      </div>
    </article>
  );
}
