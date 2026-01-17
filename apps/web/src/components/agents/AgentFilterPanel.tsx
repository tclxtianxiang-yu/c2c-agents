'use client';

import type { TaskType } from '@c2c-agents/shared';
import { fromMinUnit, toMinUnit } from '@c2c-agents/shared';
import { cn, Input } from '@c2c-agents/ui';
import { useEffect, useState } from 'react';

export type AgentFilterPanelValues = {
  showOnlyIdle?: boolean;
  minPrice?: string;
  maxPrice?: string;
  tags?: string[];
};

export type TaskContext = {
  id: string;
  title: string;
  type: TaskType;
  tags: string[];
  reward: string;
};

type AgentFilterPanelProps = {
  values: AgentFilterPanelValues;
  onChange: (values: AgentFilterPanelValues) => void;
  taskContext?: TaskContext;
  availableTags?: string[];
};

const defaultTags = [
  'Solidity',
  'Audit',
  'Python',
  'Rust',
  'DeFi',
  'NFT',
  'Security',
  'Fast',
  'Basic',
];

function formatDisplayAmount(value: string) {
  const trimmed = value.replace(/\.?0+$/, '');
  return trimmed || '0';
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

export function AgentFilterPanel({
  values,
  onChange,
  taskContext,
  availableTags = defaultTags,
}: AgentFilterPanelProps) {
  const [minInput, setMinInput] = useState('');
  const [maxInput, setMaxInput] = useState('');

  useEffect(() => {
    setMinInput(values.minPrice ? formatDisplayAmount(fromMinUnit(values.minPrice, 6)) : '');
  }, [values.minPrice]);

  useEffect(() => {
    setMaxInput(values.maxPrice ? formatDisplayAmount(fromMinUnit(values.maxPrice, 6)) : '');
  }, [values.maxPrice]);

  const toggleTag = (tag: string) => {
    const currentTags = values.tags ?? [];
    const isSelected = currentTags.includes(tag);
    const nextTags = isSelected
      ? currentTags.filter((item) => item !== tag)
      : [...currentTags, tag];

    onChange({
      ...values,
      tags: nextTags.length ? nextTags : undefined,
    });
  };

  const isIdleOnly = values.showOnlyIdle ?? false;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="space-y-6">
        {taskContext && (
          <div className="rounded-lg border border-border bg-card/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              CURRENT TASK
            </p>
            <p className="mt-2 font-medium text-foreground">{taskContext.title}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Budget</span>
              <span className="font-semibold text-primary">
                {formatDisplayAmount(fromMinUnit(taskContext.reward, 6))} USDC
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {taskContext.tags.map((tag) => (
                <span key={tag} className="rounded-md border border-border px-2 py-1 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Availability</p>
          <label className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Show only Idle</span>
            <button
              type="button"
              role="switch"
              aria-checked={isIdleOnly}
              onClick={() => onChange({ ...values, showOnlyIdle: !isIdleOnly })}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full border border-border transition-colors',
                isIdleOnly ? 'bg-primary/20' : 'bg-background'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-foreground transition-transform',
                  isIdleOnly ? 'translate-x-4 bg-primary' : 'translate-x-1 bg-muted-foreground'
                )}
              />
            </button>
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Price Range</p>
            <span className="text-xs text-muted-foreground">USDC</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="$ Min"
              value={minInput}
              onChange={(event) => {
                const nextValue = event.target.value;
                setMinInput(nextValue);
                onChange({
                  ...values,
                  minPrice: parseMinUnit(nextValue),
                });
              }}
              className="h-9"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              placeholder="$ Max"
              value={maxInput}
              onChange={(event) => {
                const nextValue = event.target.value;
                setMaxInput(nextValue);
                onChange({
                  ...values,
                  maxPrice: parseMinUnit(nextValue),
                });
              }}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Skills & Tags</p>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const isSelected = values.tags?.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
