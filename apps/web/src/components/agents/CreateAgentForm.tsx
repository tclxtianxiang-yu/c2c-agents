'use client';

import type { TaskType } from '@c2c-agents/shared';
import { toMinUnit } from '@c2c-agents/shared/utils';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useUserId } from '@/lib/useUserId';
import { TASK_TYPE_LABELS } from '@/utils/taskLabels';

const USDT_DECIMALS = 6;

type CreateAgentResponse = {
  id: string;
  name: string;
  status: string;
};

type CreateAgentFormProps = {
  onClose?: () => void;
  onSuccess?: () => void;
};

export function CreateAgentForm({ onClose, onSuccess }: CreateAgentFormProps) {
  const { userId, isConnected } = useUserId('B');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [mastraUrl, setMastraUrl] = useState('');
  const [tags, setTags] = useState('');
  const [supportedTaskTypes, setSupportedTaskTypes] = useState<TaskType[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const taskTypeOptions = Object.entries(TASK_TYPE_LABELS);

  const toggleTaskType = (type: TaskType) => {
    setSupportedTaskTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    );
  };

  const handleCreate = async () => {
    if (!userId) {
      setError('请先连接钱包');
      return;
    }

    // 验证必填字段
    if (!name.trim()) {
      setError('Agent 名称不能为空');
      return;
    }
    if (!description.trim()) {
      setError('Agent 描述不能为空');
      return;
    }
    if (!mastraUrl.trim()) {
      setError('Mastra Cloud URL 不能为空');
      return;
    }
    if (supportedTaskTypes.length === 0) {
      setError('请至少选择一个支持的任务类型');
      return;
    }

    const minPriceNum = Number.parseFloat(minPrice);
    const maxPriceNum = Number.parseFloat(maxPrice);

    if (Number.isNaN(minPriceNum) || minPriceNum < 0) {
      setError('最低报价必须是非负数');
      return;
    }
    if (Number.isNaN(maxPriceNum) || maxPriceNum < 0) {
      setError('最高报价必须是非负数');
      return;
    }
    if (minPriceNum > maxPriceNum) {
      setError('最低报价不能大于最高报价');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tagList = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      await apiFetch<CreateAgentResponse>('/agents', {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
        body: JSON.stringify({
          name,
          description,
          avatarUrl: avatarUrl.trim() || undefined,
          mastraUrl: mastraUrl.trim(),
          tags: tagList.length > 0 ? tagList : undefined,
          supportedTaskTypes,
          minPrice: toMinUnit(minPrice, USDT_DECIMALS),
          maxPrice: toMinUnit(maxPrice, USDT_DECIMALS),
        }),
      });

      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          onClose?.();
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建 Agent 失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">创建新 Agent</h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            将您的 AI Agent 注册到市场，设置报价范围，开始接受任务订单。
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            关闭
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        {/* Left Column - Form */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Basic Info */}
          <section className="flex flex-col gap-6">
            <h3 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <span className="text-primary">⛭</span>
              基本信息
            </h3>

            {!isConnected && (
              <div className="rounded-lg border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning">
                请先连接 Sepolia 钱包再创建 Agent。
              </div>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Agent 名称 <span className="text-destructive">*</span>
              </span>
              <input
                className="h-12 rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="例如：智能合约审计专家"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Agent 描述 <span className="text-destructive">*</span>
              </span>
              <textarea
                className="min-h-[160px] rounded-lg border border-input bg-card p-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="详细描述您的 Agent 的能力、擅长领域和特点..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">头像 URL</span>
              <input
                className="h-12 rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="https://example.com/avatar.png（可选）"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </label>
          </section>

          {/* Mastra Integration */}
          <section className="flex flex-col gap-6">
            <h3 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <span className="text-primary">🔗</span>
              Mastra Cloud 集成
            </h3>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Mastra Cloud URL <span className="text-destructive">*</span>
              </span>
              <input
                className="h-12 rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="https://mastra.cloud/your-agent"
                value={mastraUrl}
                onChange={(e) => setMastraUrl(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                您的 Agent 在 Mastra Cloud 的部署地址
              </span>
            </label>
          </section>

          {/* Capabilities */}
          <section className="flex flex-col gap-6">
            <h3 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <span className="text-primary">⚡</span>
              能力配置
            </h3>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                支持的任务类型 <span className="text-destructive">*</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {taskTypeOptions.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleTaskType(value as TaskType)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      supportedTaskTypes.includes(value as TaskType)
                        ? 'bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30'
                        : 'bg-card border border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">标签</span>
              <input
                className="h-12 rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="例如：Solidity, Security, DeFi（多个标签用逗号分隔）"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">标签数量不超过 10 个</span>
            </label>
          </section>

          {/* Pricing */}
          <section className="flex flex-col gap-6">
            <h3 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <span className="text-primary">💰</span>
              报价设置
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  最低报价 (USDT) <span className="text-destructive">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-12 rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="50"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  最高报价 (USDT) <span className="text-destructive">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-12 rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="500"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </label>
            </div>
            <span className="text-xs text-muted-foreground">
              设置您接受任务的价格范围，系统会根据任务预算为您匹配合适的订单
            </span>
          </section>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-border bg-card p-6 lg:sticky lg:top-24">
            <h3 className="mb-4 text-lg font-bold text-foreground">创建摘要</h3>

            <div className="flex flex-col gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent 名称:</span>
                <span className="font-medium text-foreground">{name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">支持任务类型:</span>
                <span className="font-medium text-foreground">
                  {supportedTaskTypes.length > 0 ? supportedTaskTypes.length : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">标签数量:</span>
                <span className="font-medium text-foreground">
                  {tags ? tags.split(',').filter(Boolean).length : 0}
                </span>
              </div>

              <div className="my-2 border-t border-border" />

              <div className="flex justify-between">
                <span className="text-muted-foreground">最低报价:</span>
                <span className="font-semibold text-foreground">
                  {minPrice ? `${minPrice} USDT` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">最高报价:</span>
                <span className="font-semibold text-foreground">
                  {maxPrice ? `${maxPrice} USDT` : '—'}
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-600">
                ✓ Agent 创建成功！
              </div>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || success || !isConnected}
              className="mt-6 w-full rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '创建中...' : success ? '创建成功' : '创建 Agent'}
            </button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              创建后您的 Agent 将出现在市场中
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
