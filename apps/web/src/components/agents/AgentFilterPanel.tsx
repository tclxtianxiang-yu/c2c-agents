'use client';

import type { TaskType } from '@c2c-agents/shared';
import { AgentStatus } from '@c2c-agents/shared';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/utils/formatCurrency';
import { TASK_TYPE_LABELS } from '@/utils/taskLabels';
import type { AgentFilterValues } from './AgentFilters';

type AgentFilterPanelProps = {
  values: AgentFilterValues;
  onChange: (values: AgentFilterValues) => void;
  taskContext?: {
    type: TaskType;
    tags: string[];
    reward: string;
  };
};

const availableTags = ['Solidity', 'Audit', 'Python', 'Rust', 'DeFi', 'NFT'];

export function AgentFilterPanel({ values, onChange, taskContext }: AgentFilterPanelProps) {
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');

  useEffect(() => {
    if (values.minPrice) {
      const min = (Number(values.minPrice) / 1e6).toString();
      setMinPriceInput(min);
    }
  }, [values.minPrice]);

  useEffect(() => {
    if (values.maxPrice) {
      const max = (Number(values.maxPrice) / 1e6).toString();
      setMaxPriceInput(max);
    }
  }, [values.maxPrice]);

  const handleMinPriceChange = (input: string) => {
    setMinPriceInput(input);
    const num = Number.parseFloat(input);
    if (!Number.isNaN(num) && num >= 0) {
      onChange({ ...values, minPrice: (num * 1e6).toString() });
    } else if (input === '') {
      onChange({ ...values, minPrice: undefined });
    }
  };

  const handleMaxPriceChange = (input: string) => {
    setMaxPriceInput(input);
    const num = Number.parseFloat(input);
    if (!Number.isNaN(num) && num >= 0) {
      onChange({ ...values, maxPrice: (num * 1e6).toString() });
    } else if (input === '') {
      onChange({ ...values, maxPrice: undefined });
    }
  };

  const toggleTag = (tag: string) => {
    const currentTags = values.tags ?? [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    onChange({ ...values, tags: newTags });
  };

  return (
    <>
      {/* Current Task Card */}
      {taskContext && (
        <div className="bg-gradient-to-br from-card to-muted p-4 rounded-xl border border-border shadow-lg">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
            <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
            Current Task
          </div>
          <h3 className="text-foreground font-bold text-sm mb-1">
            {TASK_TYPE_LABELS[taskContext.type] ?? taskContext.type}
          </h3>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
            <span className="text-muted-foreground text-sm">Budget</span>
            <span className="text-primary font-bold font-mono">
              {formatCurrency(taskContext.reward)} USDC
            </span>
          </div>
          {taskContext.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {taskContext.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded text-[10px] bg-border text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-6">
        {/* Availability */}
        <div className="flex flex-col gap-3">
          <h4 className="text-foreground text-sm font-semibold">Availability</h4>
          <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-muted-foreground text-sm group-hover:text-foreground transition-colors">
              Show only Idle
            </span>
            <div className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={values.status === AgentStatus.Idle}
                onChange={(e) => {
                  onChange({
                    ...values,
                    status: e.target.checked ? AgentStatus.Idle : undefined,
                  });
                }}
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-background after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </div>
          </label>
        </div>

        {/* Price Range */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h4 className="text-foreground text-sm font-semibold">Price Range</h4>
            <span className="text-xs text-muted-foreground">USDC</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                $
              </span>
              <input
                type="number"
                value={minPriceInput}
                onChange={(e) => handleMinPriceChange(e.target.value)}
                className="w-full bg-card border border-border rounded-lg py-2 pl-6 pr-2 text-sm text-foreground focus:border-primary focus:ring-0 placeholder:text-muted-foreground"
                placeholder="Min"
                min="0"
              />
            </div>
            <span className="text-muted-foreground">-</span>
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                $
              </span>
              <input
                type="number"
                value={maxPriceInput}
                onChange={(e) => handleMaxPriceChange(e.target.value)}
                className="w-full bg-card border border-border rounded-lg py-2 pl-6 pr-2 text-sm text-foreground focus:border-primary focus:ring-0 placeholder:text-muted-foreground"
                placeholder="Max"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Skills & Tags */}
        <div className="flex flex-col gap-3">
          <h4 className="text-foreground text-sm font-semibold">Skills & Tags</h4>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const isSelected = values.tags?.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30'
                      : 'bg-card border border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
