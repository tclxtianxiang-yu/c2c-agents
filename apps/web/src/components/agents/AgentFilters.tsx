'use client';

import type { TaskType } from '@c2c-agents/shared';
import { AgentStatus, fromMinUnit, toMinUnit } from '@c2c-agents/shared';
import { Button, cn, Input } from '@c2c-agents/ui';
import { useEffect, useMemo, useState } from 'react';

export type AgentFilterValues = {
  keyword?: string; // 关键词搜索（名称/描述）
  tags?: string[]; // 标签筛选
  taskType?: TaskType; // 支持的任务类型
  status?: AgentStatus; // Agent 状态
  minPrice?: string; // 报价下限（最小单位）
  maxPrice?: string; // 报价上限（最小单位）
};

type AgentFiltersProps = {
  values: AgentFilterValues;
  onChange: (values: AgentFilterValues) => void;
  /** 是否处于任务上下文（手动选择模式会自动带入 taskType 和 tags） */
  taskContext?: {
    type: TaskType;
    tags: string[];
    reward: string;
  };
};

const taskTypeLabels: Record<TaskType, string> = {
  writing: '写作',
  translation: '翻译',
  code: '代码',
  website: '网站',
  email_automation: '邮件自动化',
  info_collection: '信息收集',
  other_mastra: '其他 Mastra',
};

const statusLabels: Record<AgentStatus, string> = {
  [AgentStatus.Idle]: '空闲',
  [AgentStatus.Busy]: '忙碌',
  [AgentStatus.Queueing]: '排队中',
};

function normalizeTags(input: string) {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseMinUnit(input: string) {
  if (!input) return undefined;
  const normalized = input.replace(/,/g, '').trim();
  if (!normalized) return undefined;
  try {
    return toMinUnit(normalized, 6);
  } catch {
    return undefined;
  }
}

export function AgentFilters({ values, onChange, taskContext }: AgentFiltersProps) {
  const keywordId = 'agent-filter-keyword';
  const minPriceId = 'agent-filter-min-price';
  const maxPriceId = 'agent-filter-max-price';
  const tagsId = 'agent-filter-tags';
  const [isOpen, setIsOpen] = useState(true);
  const [minInput, setMinInput] = useState('');
  const [maxInput, setMaxInput] = useState('');

  useEffect(() => {
    setMinInput(values.minPrice ? fromMinUnit(values.minPrice, 6) : '');
  }, [values.minPrice]);

  useEffect(() => {
    setMaxInput(values.maxPrice ? fromMinUnit(values.maxPrice, 6) : '');
  }, [values.maxPrice]);

  useEffect(() => {
    if (!taskContext) return;
    const shouldApplyTaskType = values.taskType !== taskContext.type;
    const shouldApplyTags = !values.tags?.length;

    if (shouldApplyTaskType || shouldApplyTags) {
      onChange({
        ...values,
        taskType: taskContext.type,
        tags: shouldApplyTags ? taskContext.tags : values.tags,
      });
    }
  }, [onChange, taskContext, values]);

  const selectedTags = useMemo(() => values.tags?.join(', ') ?? '', [values.tags]);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">筛选 Agent</p>
          {taskContext && (
            <p className="mt-1 text-xs text-muted-foreground">已根据任务上下文预设筛选条件</p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
        >
          {isOpen ? '收起' : '展开'}
        </Button>
      </div>

      <div
        className={cn('mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3', !isOpen && 'hidden sm:grid')}
      >
        <label
          htmlFor={keywordId}
          className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span>关键词</span>
          <Input
            id={keywordId}
            value={values.keyword ?? ''}
            placeholder="名称 / 描述"
            onChange={(event) => onChange({ ...values, keyword: event.target.value || undefined })}
          />
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          任务类型
          <div className="relative">
            <select
              className="h-10 w-full appearance-none rounded-md border border-input bg-background/80 px-3 py-2 pr-8 text-sm text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur focus:border-primary focus:outline-none"
              value={values.taskType ?? ''}
              onChange={(event) =>
                onChange({
                  ...values,
                  taskType: event.target.value ? (event.target.value as TaskType) : undefined,
                })
              }
            >
              <option value="" className="bg-background text-foreground">
                全部
              </option>
              {Object.entries(taskTypeLabels).map(([value, label]) => (
                <option key={value} value={value} className="bg-background text-foreground">
                  {label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path
                  d="M6 8l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          状态
          <div className="relative">
            <select
              className="h-10 w-full appearance-none rounded-md border border-input bg-background/80 px-3 py-2 pr-8 text-sm text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.18)] backdrop-blur focus:border-primary focus:outline-none"
              value={values.status ?? ''}
              onChange={(event) =>
                onChange({
                  ...values,
                  status: event.target.value ? (event.target.value as AgentStatus) : undefined,
                })
              }
            >
              <option value="" className="bg-background text-foreground">
                全部
              </option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value} className="bg-background text-foreground">
                  {label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path
                  d="M6 8l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </label>

        <label
          htmlFor={minPriceId}
          className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span>最低价 (USDT)</span>
          <Input
            id={minPriceId}
            value={minInput}
            placeholder="0"
            onChange={(event) => {
              const nextValue = event.target.value;
              setMinInput(nextValue);
              const nextMin = parseMinUnit(nextValue);
              onChange({
                ...values,
                minPrice: nextMin,
              });
            }}
          />
        </label>

        <label
          htmlFor={maxPriceId}
          className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span>最高价 (USDT)</span>
          <Input
            id={maxPriceId}
            value={maxInput}
            placeholder="0"
            onChange={(event) => {
              const nextValue = event.target.value;
              setMaxInput(nextValue);
              const nextMax = parseMinUnit(nextValue);
              onChange({
                ...values,
                maxPrice: nextMax,
              });
            }}
          />
        </label>

        <label
          htmlFor={tagsId}
          className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span>标签</span>
          <Input
            id={tagsId}
            value={selectedTags}
            placeholder="多个标签用逗号分隔"
            onChange={(event) =>
              onChange({
                ...values,
                tags: normalizeTags(event.target.value),
              })
            }
          />
        </label>
      </div>
    </section>
  );
}
