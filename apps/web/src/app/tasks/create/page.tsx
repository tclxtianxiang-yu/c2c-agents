'use client';

import { toMinUnit } from '@c2c-agents/shared/utils';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { PaymentStatusBanner } from '../../../components/tasks/PaymentStatusBanner';
import { apiFetch } from '../../../lib/api';

const USDT_DECIMALS = 6;
const PLATFORM_FEE_RATE = 0.15;

type CreateTaskResponse = {
  id: string;
  status: string;
};

type ConfirmResponse = {
  taskId: string;
  orderId: string;
  status: string;
  confirmations: number;
};

function formatAmount(value: string): string {
  const parsed = Number(value || '0');
  if (Number.isNaN(parsed)) return '0.00';
  return parsed.toFixed(2);
}

export default function CreateTaskPage() {
  const { address, isConnected } = useAccount();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('website');
  const [tags, setTags] = useState('');
  const [promptData, setPromptData] = useState('');
  const [attachments, setAttachments] = useState('');
  const [reward, setReward] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle'
  );
  const [paymentMessage, setPaymentMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const tagList = useMemo(
    () =>
      tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags]
  );

  const rewardAmount = formatAmount(reward);
  const feeAmount = formatAmount(String(Number(reward || '0') * PLATFORM_FEE_RATE));
  const totalAmount = formatAmount(String(Number(reward || '0') * (1 + PLATFORM_FEE_RATE)));

  const handleCreate = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const expectedReward = toMinUnit(reward || '0', USDT_DECIMALS);
      const response = await apiFetch<CreateTaskResponse>('/tasks', {
        method: 'POST',
        headers: {
          'x-user-id': address,
        },
        body: JSON.stringify({
          title,
          description,
          type,
          tags: tagList,
          attachments: attachments
            .split(',')
            .map((file) => file.trim())
            .filter(Boolean),
          expectedReward,
        }),
      });
      setTaskId(response.id);
      setPaymentStatus('idle');
      setPaymentMessage(undefined);
    } catch (error) {
      setPaymentStatus('error');
      setPaymentMessage(error instanceof Error ? error.message : '创建任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!taskId || !address) return;
    setPaymentStatus('pending');
    setPaymentMessage(undefined);
    try {
      const response = await apiFetch<ConfirmResponse>(`/tasks/${taskId}/payments/confirm`, {
        method: 'POST',
        headers: {
          'x-user-id': address,
        },
        body: JSON.stringify({
          payTxHash: txHash,
        }),
      });
      setPaymentStatus('success');
      setPaymentMessage(`确认数 ${response.confirmations}`);
    } catch (error) {
      setPaymentStatus('error');
      setPaymentMessage(error instanceof Error ? error.message : '支付确认失败');
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link className="flex items-center gap-2" href="/">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                AI
              </div>
              <h2 className="text-lg font-bold tracking-tight">Web3 AI Agents</h2>
            </Link>
            <nav className="hidden items-center md:flex">
              <Link
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                href="/"
              >
                Home
              </Link>
              <Link
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                href="/"
              >
                Marketplace
              </Link>
              <span className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground">
                Post Task
              </span>
              <span className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground">
                Governance
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden lg:block">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                ⌕
              </span>
              <input
                className="h-9 w-64 rounded-lg border border-input bg-card pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="Search tasks..."
                type="text"
              />
            </div>
            <div className="hidden h-5 w-px bg-border md:block" />
            <ConnectButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link className="hover:text-primary" href="/">
            Home
          </Link>
          <span>/</span>
          <span className="text-foreground">Post New Task</span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">发布新任务</h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Create a task for AI agents, set your bounty in USDT, and let the decentralized network
            handle the rest.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-8 flex flex-col gap-8">
            <section className="flex flex-col gap-6">
              <h3 className="flex items-center gap-2 text-xl font-bold text-foreground">
                <span className="text-primary">⛭</span>
                基本信息
              </h3>
              {!isConnected && (
                <div className="rounded-lg border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning">
                  请先连接 Sepolia 钱包再发布任务。
                </div>
              )}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">任务标题</span>
                <input
                  className="h-12 rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="e.g., Generate a marketing strategy for a DeFi protocol"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">任务描述</span>
                <textarea
                  className="min-h-[160px] rounded-lg border border-input bg-card p-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="Describe the task requirements, expected output format, and any constraints in detail..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">任务类型</span>
                <select
                  className="h-12 rounded-lg border border-input bg-card px-4 text-base text-foreground focus:border-primary focus:outline-none"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                >
                  <option value="writing">写作</option>
                  <option value="translation">翻译</option>
                  <option value="code">代码</option>
                  <option value="website">网站</option>
                  <option value="email_automation">邮件自动化</option>
                  <option value="info_collection">信息收集</option>
                  <option value="other_mastra">其他 Mastra</option>
                </select>
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">任务标签 (Tags)</span>
                <div className="flex min-h-[48px] flex-wrap gap-2 rounded-lg border border-input bg-card p-2 focus-within:border-primary">
                  {tagList.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary"
                    >
                      #{tag}
                    </span>
                  ))}
                  <input
                    className="min-w-[140px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    placeholder="Add tag + Enter..."
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                  />
                </div>
              </div>
            </section>

            <div className="h-px w-full bg-border" />

            <section className="flex flex-col gap-6">
              <h3 className="flex items-center gap-2 text-xl font-bold text-foreground">
                <span className="text-primary">✦</span>
                特定数据 / Prompt
              </h3>
              <label className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Raw Data Input</span>
                  <span className="text-xs text-muted-foreground">JSON / CSV / Text</span>
                </div>
                <textarea
                  className="min-h-[140px] rounded-lg border border-input bg-muted p-4 font-mono text-sm text-success placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder='{
  "context": "web3_market_analysis",
  "parameters": {
    "duration": "7d",
    "assets": ["ETH", "SOL"]
  }
}'
                  value={promptData}
                  onChange={(event) => setPromptData(event.target.value)}
                />
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  附件上传 (Images, Docs, PPT)
                </span>
                <div className="flex h-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/60 text-sm text-muted-foreground">
                  Drag & drop files here or <span className="text-primary">browse</span>
                </div>
                <input
                  className="h-11 rounded-lg border border-input bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="file-uuid-1, file-uuid-2"
                  value={attachments}
                  onChange={(event) => setAttachments(event.target.value)}
                />
              </div>
            </section>
          </div>

          <aside className="lg:col-span-4">
            <div className="sticky top-24 rounded-lg border border-border bg-card p-6 shadow-xl">
              <h3 className="mb-6 flex items-center gap-2 text-lg font-bold">
                <span className="text-warning">$</span>
                赏金设定
              </h3>
              <div className="flex flex-col gap-6">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Reward Amount
                  </span>
                  <div className="relative flex items-center">
                    <input
                      className="h-14 w-full rounded-lg border border-input bg-background pl-4 pr-20 text-xl font-bold text-foreground focus:border-primary focus:outline-none"
                      placeholder="0.00"
                      type="number"
                      value={reward}
                      onChange={(event) => setReward(event.target.value)}
                    />
                    <div className="absolute right-3 flex items-center gap-2 text-sm font-bold">
                      <span className="h-6 w-6 rounded-full bg-success" />
                      USDT
                    </div>
                  </div>
                </label>
                <div className="rounded-lg border border-border bg-background/70 p-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Task Reward</span>
                    <span className="font-mono text-foreground">{rewardAmount} USDT</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Platform Fee</span>
                    <span className="font-mono">{feeAmount} USDT</span>
                  </div>
                  <div className="my-4 h-px bg-border" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">费用精算 (Total)</span>
                    <span className="font-mono text-primary">{totalAmount} USDT</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading || !isConnected}
                  className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? '创建中...' : '支付并发布 →'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={!taskId || !txHash || !isConnected}
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  确认支付
                </button>

                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-muted-foreground">Pay Tx Hash</span>
                  <input
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    value={txHash}
                    onChange={(event) => setTxHash(event.target.value.trim())}
                    placeholder="0x..."
                  />
                </label>

                <PaymentStatusBanner status={paymentStatus} message={paymentMessage} />

                {taskId && (
                  <Link
                    className="text-sm font-semibold text-primary underline"
                    href={`/tasks/${taskId}`}
                  >
                    前往任务详情
                  </Link>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © 2026 Web3 AI Agents Platform. All rights reserved.
      </footer>
    </main>
  );
}
